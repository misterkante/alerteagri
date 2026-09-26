import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { randomBytes } from 'node:crypto';
import { IsDate, IsLatitude, IsLongitude, IsNumber, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { resolveProducer } from '../common/acting-for';
import { EXPORT_DECREE } from '../domain/market';

const EUDR_CROPS = ['soja'];
const PUBLIC_COORD_DECIMALS = 3;

class ParcelDto {
  @IsString() cropId: string;
  @IsNumber() @Min(0.01) @Max(500) areaHa: number;
  @IsLatitude() lat: number;
  @IsLongitude() lon: number;
  @IsOptional() @IsString() forUserId?: string;
}

class LotDto {
  @IsString() parcelId: string;
  @Type(() => Date) @IsDate() harvestDate: Date;
  @IsInt() @Min(1) @Max(1_000_000) weightKg: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) humidityPct?: number;
}

@Injectable()
export class TraceService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async parcel(actor: AuthenticatedUser, dto: ParcelDto) {
    const { target, actingForId } = await resolveProducer(this.prisma, actor, dto.forUserId);
    if (!(await this.prisma.crop.findUnique({ where: { id: dto.cropId } }))) throw new BadRequestException('Culture inconnue');
    const p = await this.prisma.parcel.create({ data: { ownerId: target.id, communeId: target.communeId, cropId: dto.cropId, areaHa: dto.areaHa, lat: dto.lat, lon: dto.lon } });
    await this.audit.log(actor.userId, 'parcel.create', 'Parcel', p.id, undefined, actingForId);
    return p;
  }

  async lot(actor: AuthenticatedUser, dto: LotDto) {
    const parcel = await this.prisma.parcel.findUnique({ where: { id: dto.parcelId } });
    if (!parcel) throw new NotFoundException('Parcelle introuvable');
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (me.role === 'ADVISOR' && me.communeId !== parcel.communeId) throw new ForbiddenException('Parcelle hors de votre commune');
    const lot = await this.prisma.lot.create({ data: { code: `LOT-${randomBytes(4).toString('hex').toUpperCase()}`, parcelId: parcel.id, harvestDate: dto.harvestDate, weightKg: dto.weightKg, humidityPct: dto.humidityPct } });
    await this.audit.log(actor.userId, 'lot.create', 'Lot', lot.id, { weightKg: dto.weightKg });
    return lot;
  }

  // Public page behind the QR code: origin and compliance, never the producer's identity.
  async publicLot(code: string) {
    const lot = await this.prisma.lot.findUnique({ where: { code }, include: { parcel: { include: { crop: true, commune: true } } } });
    if (!lot) throw new NotFoundException('Lot inconnu');
    const { parcel } = lot;
    const round = (v: number) => Number(v.toFixed(PUBLIC_COORD_DECIMALS));
    return {
      code: lot.code, crop: parcel.crop.name, commune: parcel.commune.name, department: parcel.commune.department,
      harvestDate: lot.harvestDate, weightKg: lot.weightKg, humidityPct: lot.humidityPct, parcelAreaHa: parcel.areaHa,
      parcelLocation: { lat: round(parcel.lat), lon: round(parcel.lon), precision: 'environ 100 m' },
      exportCompliance: parcel.crop.exportBanned ? `Export du produit brut soumis à agrément. ${EXPORT_DECREE}` : 'Pas de restriction d’export connue pour ce produit.',
      eudr: EUDR_CROPS.includes(parcel.crop.id) ? 'Géolocalisation de la parcelle disponible (règlement européen anti-déforestation, applicable au 30 décembre 2026).' : null,
    };
  }
}

@ApiTags('tracabilite')
@Controller()
export class TraceController {
  constructor(private readonly trace: TraceService) {}

  @Post('parcels')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('PRODUCER', 'ADVISOR')
  parcel(@CurrentUser() user: AuthenticatedUser, @Body() dto: ParcelDto) {
    return this.trace.parcel(user, dto);
  }

  @Post('lots')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADVISOR', 'AGENT')
  lot(@CurrentUser() user: AuthenticatedUser, @Body() dto: LotDto) {
    return this.trace.lot(user, dto);
  }

  @Get('lots/:code')
  publicLot(@Param('code') code: string) {
    return this.trace.publicLot(code);
  }
}

@Module({ controllers: [TraceController], providers: [TraceService] })
export class TraceModule {}
