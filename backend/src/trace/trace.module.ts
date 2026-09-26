import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { randomBytes } from 'node:crypto';
import {
  IsDate,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { resolveProducer } from '../common/acting-for';
import { EXPORT_DECREE } from '../domain/market';
import { cropSteps, waterBalance } from '../domain/season';
import { AlertsModule } from '../alerts/alerts.module';
import { AlertsService } from '../alerts/alerts.service';

const EUDR_CROPS = ['soja'];
const PUBLIC_COORD_DECIMALS = 3;

class ParcelDto {
  @IsString() cropId!: string;
  @IsNumber() @Min(0.01) @Max(500) areaHa!: number;
  @IsLatitude() lat!: number;
  @IsLongitude() lon!: number;
  @IsOptional() @Type(() => Date) @IsDate() sownAt?: Date;
  @IsOptional() @IsString() forUserId?: string;
}

class LotDto {
  @IsString() parcelId!: string;
  @Type(() => Date) @IsDate() harvestDate!: Date;
  @IsInt() @Min(1) @Max(1_000_000) weightKg!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) humidityPct?: number;
}

@Injectable()
export class TraceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
  ) {}

  async parcel(actor: AuthenticatedUser, dto: ParcelDto) {
    const { target, actingForId } = await resolveProducer(
      this.prisma,
      actor,
      dto.forUserId,
    );
    if (!(await this.prisma.crop.findUnique({ where: { id: dto.cropId } })))
      throw new BadRequestException('Culture inconnue');
    if (dto.sownAt) {
      const age = (Date.now() - dto.sownAt.getTime()) / 86400000;
      if (age < -1 || age > 365)
        throw new BadRequestException(
          'La date de semis doit être passée et de moins d’un an',
        );
    }
    const p = await this.prisma.parcel.create({
      data: {
        ownerId: target.id,
        communeId: target.communeId,
        cropId: dto.cropId,
        areaHa: dto.areaHa,
        lat: dto.lat,
        lon: dto.lon,
        sownAt: dto.sownAt,
      },
    });
    if (dto.sownAt) {
      await this.prisma.stepReminder.createMany({
        data: cropSteps(dto.cropId, dto.sownAt).map((s) => ({
          parcelId: p.id,
          code: s.code,
          label: s.label,
          due: s.due,
        })),
      });
    }
    await this.audit.log(
      actor.userId,
      'parcel.create',
      'Parcel',
      p.id,
      undefined,
      actingForId,
    );
    return p;
  }

  async lot(actor: AuthenticatedUser, dto: LotDto) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: dto.parcelId },
    });
    if (!parcel) throw new NotFoundException('Parcelle introuvable');
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
    });
    if (me.role === 'ADVISOR' && me.communeId !== parcel.communeId)
      throw new ForbiddenException('Parcelle hors de votre commune');
    const lot = await this.prisma.lot.create({
      data: {
        code: `LOT-${randomBytes(4).toString('hex').toUpperCase()}`,
        parcelId: parcel.id,
        harvestDate: dto.harvestDate,
        weightKg: dto.weightKg,
        humidityPct: dto.humidityPct,
      },
    });
    await this.audit.log(actor.userId, 'lot.create', 'Lot', lot.id, {
      weightKg: dto.weightKg,
    });
    return lot;
  }

  // Owner, an advisor of the same commune, or staff; everyone else gets a 404, not a hint that it exists.
  async visibleParcel(actor: AuthenticatedUser, id: string) {
    const p = await this.prisma.parcel.findUnique({
      where: { id },
      include: { crop: true, commune: true },
    });
    if (!p) throw new NotFoundException('Parcelle introuvable');
    if (p.ownerId === actor.userId || ['AGENT', 'ADMIN'].includes(actor.role))
      return p;
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
    });
    if (me.role === 'ADVISOR' && me.communeId === p.communeId) return p;
    throw new NotFoundException('Parcelle introuvable');
  }

  async mine(actor: AuthenticatedUser) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
    });
    const where =
      me.role === 'ADVISOR' ? { communeId: me.communeId } : { ownerId: me.id };
    return this.prisma.parcel.findMany({
      where,
      include: {
        crop: { select: { name: true } },
        owner: { select: { name: true } },
        lots: { select: { code: true, weightKg: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async steps(actor: AuthenticatedUser, id: string) {
    await this.visibleParcel(actor, id);
    return this.prisma.stepReminder.findMany({
      where: { parcelId: id },
      orderBy: { due: 'asc' },
    });
  }

  async water(actor: AuthenticatedUser, id: string, now = new Date()) {
    const p = await this.visibleParcel(actor, id);
    if (!p.sownAt)
      return {
        balanceMm: null,
        level: 'INCONNU',
        days: 0,
        reason: 'Date de semis non déclarée',
      };
    const days = await this.prisma.weatherDaily.findMany({
      where: { communeId: p.communeId, date: { gte: p.sownAt, lte: now } },
      orderBy: { date: 'asc' },
    });
    return {
      ...waterBalance(days, p.sownAt, now),
      sownAt: p.sownAt,
      source: 'Open-Meteo (pluie et ET0 de la commune)',
    };
  }

  async runReminders(now = new Date()) {
    const due = await this.prisma.stepReminder.findMany({
      where: { sentAt: null, due: { lte: now } },
      include: { parcel: { include: { crop: true } } },
    });
    let sent = 0;
    for (const r of due) {
      const body = `AlerteAgri : ${r.label} pour votre ${r.parcel.crop.name.toLowerCase()} (${r.parcel.areaHa} ha).`;
      sent += await this.alerts.notifyDirect(
        'RAPPEL',
        r.id,
        [r.parcel.ownerId],
        body,
      );
      await this.prisma.stepReminder.update({
        where: { id: r.id },
        data: { sentAt: now },
      });
    }
    return { due: due.length, sent };
  }

  // Public page behind the QR code: origin and compliance, never the producer's identity.
  async publicLot(code: string) {
    const lot = await this.prisma.lot.findUnique({
      where: { code },
      include: { parcel: { include: { crop: true, commune: true } } },
    });
    if (!lot) throw new NotFoundException('Lot inconnu');
    const { parcel } = lot;
    const round = (v: number) => Number(v.toFixed(PUBLIC_COORD_DECIMALS));
    return {
      code: lot.code,
      crop: parcel.crop.name,
      commune: parcel.commune.name,
      department: parcel.commune.department,
      harvestDate: lot.harvestDate,
      weightKg: lot.weightKg,
      humidityPct: lot.humidityPct,
      parcelAreaHa: parcel.areaHa,
      parcelLocation: {
        lat: round(parcel.lat),
        lon: round(parcel.lon),
        precision: 'environ 100 m',
      },
      exportCompliance: parcel.crop.exportBanned
        ? `Export du produit brut soumis à agrément. ${EXPORT_DECREE}`
        : 'Pas de restriction d’export connue pour ce produit.',
      eudr: EUDR_CROPS.includes(parcel.crop.id)
        ? 'Géolocalisation de la parcelle disponible (règlement européen anti-déforestation, applicable au 30 décembre 2026).'
        : null,
    };
  }
}

@ApiTags('tracabilite')
@Controller()
export class TraceController {
  constructor(private readonly trace: TraceService) {}

  @Post('parcels')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCER', 'ADVISOR')
  parcel(@CurrentUser() user: AuthenticatedUser, @Body() dto: ParcelDto) {
    return this.trace.parcel(user, dto);
  }

  @Get('parcels/mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCER', 'ADVISOR')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.trace.mine(user);
  }

  @Post('parcels/reminders/run')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  run() {
    return this.trace.runReminders();
  }

  @Get('parcels/:id/steps')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  steps(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.trace.steps(user, id);
  }

  @Get('parcels/:id/water')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  water(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.trace.water(user, id);
  }

  @Post('lots')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVISOR', 'AGENT')
  lot(@CurrentUser() user: AuthenticatedUser, @Body() dto: LotDto) {
    return this.trace.lot(user, dto);
  }

  @Get('lots/:code')
  publicLot(@Param('code') code: string) {
    return this.trace.publicLot(code);
  }
}

@Module({
  imports: [AlertsModule],
  controllers: [TraceController],
  providers: [TraceService],
})
export class TraceModule {}
