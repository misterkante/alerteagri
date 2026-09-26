import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { resolveProducer } from '../common/acting-for';
import { checkExport } from '../domain/market';

class ListingDto {
  @IsString() @Length(8, 64) clientId: string;
  @IsString() cropId: string;
  @IsInt() @Min(1) @Max(1_000_000) quantityKg: number;
  @IsInt() @Min(1) @Max(1_000_000) pricePerKg: number;
  @IsOptional() @IsBoolean() forExport?: boolean;
  @IsOptional() @IsString() @Length(1, 60) exportLicense?: string;
  @IsOptional() @IsString() forUserId?: string;
}

class OrderDto {
  @IsString() @Length(8, 64) clientId: string;
  @IsString() listingId: string;
  @IsInt() @Min(1) @Max(1_000_000) quantityKg: number;
}

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  listings(cropId?: string, communeId?: string) {
    return this.prisma.listing.findMany({
      where: { status: 'OPEN', cropId, communeId },
      select: { id: true, cropId: true, communeId: true, quantityKg: true, pricePerKg: true, forExport: true, createdAt: true,
        crop: { select: { name: true } }, commune: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }

  async prices(cropId?: string) {
    return this.prisma.referencePrice.findMany({ where: { cropId }, include: { commune: { select: { name: true } }, crop: { select: { name: true } } }, orderBy: { observedAt: 'desc' } });
  }

  async createListing(actor: AuthenticatedUser, dto: ListingDto) {
    const existing = await this.prisma.listing.findUnique({ where: { clientId: dto.clientId } });
    if (existing) return existing;
    const { target, actingForId } = await resolveProducer(this.prisma, actor, dto.forUserId);
    const crop = await this.prisma.crop.findUnique({ where: { id: dto.cropId } });
    if (!crop) throw new BadRequestException('Culture inconnue');
    const exportCheck = checkExport(crop, !!dto.forExport, dto.exportLicense);
    if (!exportCheck.allowed) throw new BadRequestException(exportCheck.reason);
    const listing = await this.prisma.listing.create({
      data: { clientId: dto.clientId, sellerId: target.id, cropId: crop.id, communeId: target.communeId, quantityKg: dto.quantityKg,
        pricePerKg: dto.pricePerKg, forExport: !!dto.forExport, exportLicense: dto.exportLicense?.trim() || null },
    });
    await this.audit.log(actor.userId, 'listing.create', 'Listing', listing.id, { forExport: listing.forExport }, actingForId);
    return listing;
  }

  // Serializable transaction: two buyers can never reserve more than the listed quantity together.
  async order(actor: AuthenticatedUser, dto: OrderDto) {
    const existing = await this.prisma.order.findUnique({ where: { clientId: dto.clientId } });
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const listing = await tx.listing.findUnique({ where: { id: dto.listingId }, include: { orders: true } });
        if (!listing || listing.status !== 'OPEN') throw new NotFoundException('Offre introuvable');
        if (listing.sellerId === actor.userId) throw new BadRequestException('Vous ne pouvez pas commander votre propre offre');
        const reserved = listing.orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + o.quantityKg, 0);
        if (reserved + dto.quantityKg > listing.quantityKg) throw new ConflictException(`Quantité disponible : ${listing.quantityKg - reserved} kg`);
        return tx.order.create({ data: { clientId: dto.clientId, listingId: listing.id, buyerId: actor.userId, quantityKg: dto.quantityKg } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') throw new ConflictException('Offre modifiée en même temps, réessayez');
      throw e;
    }
  }

  myOrders(userId: string) {
    return this.prisma.order.findMany({ where: { buyerId: userId }, include: { listing: { include: { crop: true, commune: true } }, taxPayment: true }, orderBy: { createdAt: 'desc' } });
  }
}

@ApiTags('marche (API ouverte)')
@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get('listings')
  listings(@Query('cropId') cropId?: string, @Query('communeId') communeId?: string) {
    return this.market.listings(cropId, communeId);
  }

  @Get('prices')
  prices(@Query('cropId') cropId?: string) {
    return this.market.prices(cropId);
  }

  @Post('listings')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('PRODUCER', 'ADVISOR')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: ListingDto) {
    return this.market.createListing(user, dto);
  }

  @Post('orders')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BUYER')
  order(@CurrentUser() user: AuthenticatedUser, @Body() dto: OrderDto) {
    return this.market.order(user, dto);
  }

  @Get('orders/me')
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('BUYER')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.market.myOrders(user.userId);
  }
}

@Module({ controllers: [MarketController], providers: [MarketService] })
export class MarketModule {}
