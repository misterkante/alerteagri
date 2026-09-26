import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { resolveProducer } from '../common/acting-for';
import { checkExport } from '../domain/market';
import { OrderDto } from './dto/order.dto';
import { GroupListingDto } from './dto/group-listing.dto';
import { ListingDto } from './dto/listing.dto';

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listings(cropId?: string, communeId?: string) {
    return this.prisma.listing.findMany({
      where: { status: 'OPEN', cropId, communeId },
      select: {
        id: true,
        cropId: true,
        communeId: true,
        quantityKg: true,
        pricePerKg: true,
        forExport: true,
        createdAt: true,
        crop: { select: { name: true } },
        commune: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async prices(cropId?: string) {
    return this.prisma.referencePrice.findMany({
      where: { cropId },
      include: {
        commune: { select: { name: true } },
        crop: { select: { name: true } },
      },
      orderBy: { observedAt: 'desc' },
    });
  }

  async createListing(actor: AuthenticatedUser, dto: ListingDto) {
    const existing = await this.prisma.listing.findUnique({
      where: { clientId: dto.clientId },
    });
    if (existing) return existing;
    const { target, actingForId } = await resolveProducer(
      this.prisma,
      actor,
      dto.forUserId,
    );
    const crop = await this.prisma.crop.findUnique({
      where: { id: dto.cropId },
    });
    if (!crop) throw new BadRequestException('Culture inconnue');
    const exportCheck = checkExport(crop, !!dto.forExport, dto.exportLicense);
    if (!exportCheck.allowed) throw new BadRequestException(exportCheck.reason);
    const listing = await this.prisma.listing.create({
      data: {
        clientId: dto.clientId,
        sellerId: target.id,
        cropId: crop.id,
        communeId: target.communeId,
        quantityKg: dto.quantityKg,
        pricePerKg: dto.pricePerKg,
        forExport: !!dto.forExport,
        exportLicense: dto.exportLicense?.trim() || null,
      },
    });
    await this.audit.log(
      actor.userId,
      'listing.create',
      'Listing',
      listing.id,
      { forExport: listing.forExport },
      actingForId,
    );
    return listing;
  }

  // A cooperative sale: one offer, each share still attributed to its producer.
  async createGroupListing(actor: AuthenticatedUser, dto: GroupListingDto) {
    const existing = await this.prisma.listing.findUnique({
      where: { clientId: dto.clientId },
      include: { shares: true },
    });
    if (existing) return existing;
    const advisor = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
    });
    const ids = [...new Set(dto.shares.map((s) => s.producerId))];
    if (ids.length !== dto.shares.length)
      throw new BadRequestException('Un producteur apparaît deux fois');
    const producers = await this.prisma.user.findMany({
      where: { id: { in: ids } },
    });
    if (
      producers.length !== ids.length ||
      producers.some(
        (p) => p.role !== 'PRODUCER' || p.communeId !== advisor.communeId,
      )
    ) {
      throw new ForbiddenException(
        'Seuls les producteurs de votre commune peuvent être regroupés',
      );
    }
    const crop = await this.prisma.crop.findUnique({
      where: { id: dto.cropId },
    });
    if (!crop) throw new BadRequestException('Culture inconnue');
    const exportCheck = checkExport(crop, !!dto.forExport, dto.exportLicense);
    if (!exportCheck.allowed) throw new BadRequestException(exportCheck.reason);
    const quantityKg = dto.shares.reduce((s, x) => s + x.quantityKg, 0);
    const listing = await this.prisma.listing.create({
      data: {
        clientId: dto.clientId,
        sellerId: advisor.id,
        cropId: crop.id,
        communeId: advisor.communeId,
        quantityKg,
        pricePerKg: dto.pricePerKg,
        forExport: !!dto.forExport,
        exportLicense: dto.exportLicense?.trim() || null,
        shares: { create: dto.shares },
      },
      include: { shares: true },
    });
    await this.audit.log(actor.userId, 'listing.group', 'Listing', listing.id, {
      producers: ids.length,
      quantityKg,
    });
    return listing;
  }

  // Serializable transaction: two buyers can never reserve more than the listed quantity together.
  async order(actor: AuthenticatedUser, dto: OrderDto) {
    const existing = await this.prisma.order.findUnique({
      where: { clientId: dto.clientId },
    });
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const listing = await tx.listing.findUnique({
            where: { id: dto.listingId },
            include: { orders: true },
          });
          if (!listing || listing.status !== 'OPEN')
            throw new NotFoundException('Offre introuvable');
          if (listing.sellerId === actor.userId)
            throw new BadRequestException(
              'Vous ne pouvez pas commander votre propre offre',
            );
          const reserved = listing.orders
            .filter((o) => o.status !== 'CANCELLED')
            .reduce((s, o) => s + o.quantityKg, 0);
          if (reserved + dto.quantityKg > listing.quantityKg)
            throw new ConflictException(
              `Quantité disponible : ${listing.quantityKg - reserved} kg`,
            );
          return tx.order.create({
            data: {
              clientId: dto.clientId,
              listingId: listing.id,
              buyerId: actor.userId,
              quantityKg: dto.quantityKg,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2034'
      )
        throw new ConflictException('Offre modifiée en même temps, réessayez');
      throw e;
    }
  }

  myOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { buyerId: userId },
      include: {
        listing: { include: { crop: true, commune: true } },
        taxPayment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
