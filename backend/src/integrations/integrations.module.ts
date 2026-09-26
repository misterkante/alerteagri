import { Controller, Get, Injectable, Module, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { famewsCsv } from '../domain/exports';

export interface TerminalMarketAdapter {
  readonly name: string;
  readonly simulated: boolean;
  sendLots(payload: unknown[]): Promise<'ACCEPTED'>;
}

// SIPI-Bénin publishes no public API yet: this adapter keeps the exact payload a real one would send.
export class SimulatedSipiAdapter implements TerminalMarketAdapter {
  readonly name = 'SIPI-Bénin marché terminal';
  readonly simulated = true;
  async sendLots(): Promise<'ACCEPTED'> {
    return 'ACCEPTED';
  }
}

const FAW_SYMPTOMS = ['feuilles-trouees', 'chenilles', 'sciure-cornet'];

@Injectable()
export class IntegrationsService {
  readonly sipi: TerminalMarketAdapter = new SimulatedSipiAdapter();
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async famews() {
    const reports = await this.prisma.pestReport.findMany({
      where: { status: 'VALIDATED', cropId: 'mais', symptom: { in: FAW_SYMPTOMS } },
      include: { commune: true, crop: true }, orderBy: { createdAt: 'asc' },
    });
    return famewsCsv(reports.map((r) => ({ date: r.createdAt, commune: r.commune.name, department: r.commune.department, lat: r.lat, lon: r.lon, crop: r.crop.name, symptom: r.symptom })));
  }

  async sendLotsToSipi(actorId: string) {
    const lots = await this.prisma.lot.findMany({ include: { parcel: { include: { crop: true, commune: true } } }, orderBy: { createdAt: 'desc' }, take: 500 });
    const payload = lots.map((l) => ({
      lotCode: l.code, crop: l.parcel.crop.id, weightKg: l.weightKg, humidityPct: l.humidityPct, harvestDate: l.harvestDate.toISOString().slice(0, 10),
      origin: { commune: l.parcel.commune.name, department: l.parcel.commune.department, lat: Number(l.parcel.lat.toFixed(3)), lon: Number(l.parcel.lon.toFixed(3)) },
    }));
    const status = await this.sipi.sendLots(payload);
    const log = await this.prisma.integrationLog.create({ data: { target: this.sipi.name, status, simulated: this.sipi.simulated, items: payload.length, payload: payload as unknown as Prisma.InputJsonValue } });
    await this.audit.log(actorId, 'integration.sipi', 'IntegrationLog', log.id, { items: payload.length });
    return log;
  }
}

@ApiTags('interoperabilite')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('AGENT', 'ADMIN')
@Controller()
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService, private readonly prisma: PrismaService) {}

  @Get('exports/famews')
  async famews(@Res({ passthrough: true }) res: Response) {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="famews-benin.csv"' });
    return this.integrations.famews();
  }

  @Post('integrations/sipi/lots')
  sipi(@CurrentUser() user: AuthenticatedUser) {
    return this.integrations.sendLotsToSipi(user.userId);
  }

  @Get('integrations/log')
  log() {
    return this.prisma.integrationLog.findMany({ select: { id: true, target: true, status: true, simulated: true, items: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 });
  }
}

@Module({ controllers: [IntegrationsController], providers: [IntegrationsService] })
export class IntegrationsModule {}
