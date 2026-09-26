import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { computeTdl, signReceipt, verifyReceipt } from '../domain/tax';
import { RateDto } from './dto/rate.dto';
import { CollectDto } from './dto/collect.dto';

const secret = () => {
  const s = process.env.RECEIPT_SECRET;
  if (!s || s.length < 16)
    throw new Error('RECEIPT_SECRET (16 caractères minimum) est requis');
  return s;
};

const newReceiptId = () =>
  `TDL-${randomBytes(5).toString('hex').toUpperCase()}`;

@Injectable()
export class TaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async rateFor(communeId: string, cropId: string) {
    const rate = await this.prisma.taxRate.findUnique({
      where: { communeId_cropId: { communeId, cropId } },
    });
    if (!rate)
      throw new BadRequestException(
        'Aucun barème TDL pour ce produit dans cette commune',
      );
    return rate;
  }

  private async record(data: {
    clientId: string;
    communeId: string;
    cropId: string;
    quantityKg: number;
    orderId?: string;
    collectorId?: string;
  }) {
    const existing = await this.prisma.taxPayment.findUnique({
      where: { clientId: data.clientId },
    });
    if (existing) return existing;
    const rate = await this.rateFor(data.communeId, data.cropId);
    const amountFcfa = computeTdl(data.quantityKg, rate.fcfaPer100Kg);
    const receiptId = newReceiptId();
    const paidAt = new Date();
    const signature = signReceipt(
      {
        receiptId,
        communeId: data.communeId,
        amountFcfa,
        paidAt: paidAt.toISOString(),
      },
      secret(),
    );
    return this.prisma.taxPayment.create({
      data: { ...data, amountFcfa, receiptId, signature, paidAt },
    });
  }

  async payOrder(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true },
    });
    if (!order || order.buyerId !== buyerId)
      throw new NotFoundException('Commande introuvable');
    const payment = await this.record({
      clientId: `order-${order.id}`,
      communeId: order.listing.communeId,
      cropId: order.listing.cropId,
      quantityKg: order.quantityKg,
      orderId: order.id,
    });
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    });
    await this.audit.log(buyerId, 'tax.pay-order', 'TaxPayment', payment.id, {
      amountFcfa: payment.amountFcfa,
    });
    return { ...payment, simulated: true };
  }

  async collect(collectorId: string, dto: CollectDto) {
    const collector = await this.prisma.user.findUniqueOrThrow({
      where: { id: collectorId },
    });
    const payment = await this.record({
      ...dto,
      communeId: collector.communeId,
      collectorId,
    });
    await this.audit.log(collectorId, 'tax.collect', 'TaxPayment', payment.id, {
      amountFcfa: payment.amountFcfa,
    });
    return payment;
  }

  async verify(receiptId: string, sig: string) {
    const p = await this.prisma.taxPayment.findUnique({
      where: { receiptId },
      include: { commune: { select: { name: true } } },
    });
    if (!p || !sig) return { valid: false };
    const valid = verifyReceipt(
      {
        receiptId,
        communeId: p.communeId,
        amountFcfa: p.amountFcfa,
        paidAt: p.paidAt.toISOString(),
      },
      sig,
      secret(),
    );
    return valid
      ? {
          valid,
          receiptId,
          commune: p.commune.name,
          cropId: p.cropId,
          quantityKg: p.quantityKg,
          amountFcfa: p.amountFcfa,
          paidAt: p.paidAt,
        }
      : { valid: false };
  }

  async reconciliation(actor: AuthenticatedUser) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
    });
    const where = me.role === 'COMMUNE' ? { communeId: me.communeId } : {};
    const rows = await this.prisma.taxPayment.findMany({
      where,
      orderBy: { paidAt: 'asc' },
    });
    const checked = rows.map((p) => ({
      receiptId: p.receiptId,
      communeId: p.communeId,
      cropId: p.cropId,
      quantityKg: p.quantityKg,
      amountFcfa: p.amountFcfa,
      paidAt: p.paidAt.toISOString(),
      signatureValid: verifyReceipt(
        {
          receiptId: p.receiptId,
          communeId: p.communeId,
          amountFcfa: p.amountFcfa,
          paidAt: p.paidAt.toISOString(),
        },
        p.signature,
        secret(),
      ),
    }));
    return {
      communes: [...new Set(checked.map((c) => c.communeId))].sort(),
      count: checked.length,
      totalFcfa: checked
        .filter((c) => c.signatureValid)
        .reduce((s, c) => s + c.amountFcfa, 0),
      invalid: checked.filter((c) => !c.signatureValid).length,
      rows: checked,
    };
  }

  async setRate(actor: AuthenticatedUser, dto: RateDto) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
    });
    if (me.role === 'COMMUNE' && me.communeId !== dto.communeId)
      throw new ForbiddenException(
        'Vous ne gérez que le barème de votre commune',
      );
    const r = await this.prisma.taxRate.upsert({
      where: {
        communeId_cropId: { communeId: dto.communeId, cropId: dto.cropId },
      },
      update: { fcfaPer100Kg: dto.fcfaPer100Kg, illustrative: false },
      create: { ...dto, illustrative: false },
    });
    await this.audit.log(actor.userId, 'tax.rate', 'TaxRate', r.id, {
      fcfaPer100Kg: dto.fcfaPer100Kg,
    });
    return r;
  }

  async revenue(actor: AuthenticatedUser) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
    });
    const where = me.role === 'COMMUNE' ? { communeId: me.communeId } : {};
    const rows = await this.prisma.taxPayment.groupBy({
      by: ['communeId', 'cropId'],
      where,
      _sum: { amountFcfa: true, quantityKg: true },
      _count: true,
    });
    const recent = await this.prisma.taxPayment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      take: 20,
      select: {
        receiptId: true,
        communeId: true,
        cropId: true,
        amountFcfa: true,
        paidAt: true,
        collectorId: true,
        orderId: true,
      },
    });
    return { byCommuneAndCrop: rows, recent };
  }

  rates(communeId?: string) {
    return this.prisma.taxRate.findMany({
      where: { communeId },
      include: {
        crop: { select: { name: true } },
        commune: { select: { name: true } },
      },
    });
  }
}
