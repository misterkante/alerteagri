import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { famewsCsv } from '../domain/exports';
import { FAW_SYMPTOMS } from '../reports/reports.constants';
import {
  SimulatedSipiAdapter,
  TerminalMarketAdapter,
} from './terminal-market.adapter';

@Injectable()
export class IntegrationsService {
  readonly sipi: TerminalMarketAdapter = new SimulatedSipiAdapter();
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async famews() {
    const reports = await this.prisma.pestReport.findMany({
      where: {
        status: 'VALIDATED',
        cropId: 'mais',
        symptom: { in: FAW_SYMPTOMS },
      },
      include: { commune: true, crop: true },
      orderBy: { createdAt: 'asc' },
    });
    return famewsCsv(
      reports.map((r) => ({
        date: r.createdAt,
        commune: r.commune.name,
        department: r.commune.department,
        lat: r.lat,
        lon: r.lon,
        crop: r.crop.name,
        symptom: r.symptom,
      })),
    );
  }

  async sendLotsToSipi(actorId: string) {
    const lots = await this.prisma.lot.findMany({
      include: { parcel: { include: { crop: true, commune: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const payload = lots.map((l) => ({
      lotCode: l.code,
      crop: l.parcel.crop.id,
      weightKg: l.weightKg,
      humidityPct: l.humidityPct,
      harvestDate: l.harvestDate.toISOString().slice(0, 10),
      origin: {
        commune: l.parcel.commune.name,
        department: l.parcel.commune.department,
        lat: Number(l.parcel.lat.toFixed(3)),
        lon: Number(l.parcel.lon.toFixed(3)),
      },
    }));
    const status = await this.sipi.sendLots(payload);
    const log = await this.prisma.integrationLog.create({
      data: {
        target: this.sipi.name,
        status,
        simulated: this.sipi.simulated,
        items: payload.length,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    await this.audit.log(
      actorId,
      'integration.sipi',
      'IntegrationLog',
      log.id,
      { items: payload.length },
    );
    return log;
  }

  log() {
    return this.prisma.integrationLog.findMany({
      select: {
        id: true,
        target: true,
        status: true,
        simulated: true,
        items: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
