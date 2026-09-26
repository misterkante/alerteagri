import { Controller, Get, Injectable, Module, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { protectedValueFcfa } from '../domain/value';

export const GDIZ_CAPACITY_T = { anacarde: 120000, soja: 260000, coton: 40000 };
export const GDIZ_SOURCE = 'Capacités installées GDIZ 2026 (La Nouvelle Tribune, Nasuba), cahier des charges SIPI-Bénin art. 6';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(viewer: AuthenticatedUser, pole?: number) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: viewer.userId } });
    const scope = me.role === 'COMMUNE' ? { id: me.communeId } : pole ? { pole } : {};
    const communes = await this.prisma.commune.findMany({
      where: scope,
      include: {
        alerts: { where: { status: 'OPEN' }, select: { id: true, kind: true } },
        reports: { select: { status: true, createdAt: true }, where: { createdAt: { gte: new Date(Date.now() - 14 * 86400000) } } },
      },
    });
    const lastRun = await this.prisma.weatherRun.findFirst({ where: { ok: true }, orderBy: { finishedAt: 'desc' } });
    return {
      lastWeatherRun: lastRun?.finishedAt ?? null,
      communes: communes.map((c) => ({
        id: c.id, name: c.name, department: c.department, pole: c.pole, lat: c.lat, lon: c.lon,
        openAlerts: c.alerts.length, alertKinds: [...new Set(c.alerts.map((a) => a.kind))],
        reportsPending: c.reports.filter((r) => r.status === 'PENDING').length,
        reportsValidated: c.reports.filter((r) => r.status === 'VALIDATED').length,
      })),
    };
  }

  // Estimate only: declared area x reference yield x average reference price.
  async protectedValue(viewer: AuthenticatedUser) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: viewer.userId } });
    const alerts = await this.prisma.alert.findMany({ where: { status: 'OPEN', ...(me.role === 'COMMUNE' ? { communeId: me.communeId } : {}) }, include: { commune: true } });
    const prices = await this.prisma.referencePrice.groupBy({ by: ['cropId'], _avg: { pricePerKg: true } });
    const priceOf = (cropId: string) => prices.find((p) => p.cropId === cropId)?._avg.pricePerKg ?? 0;
    const out = [];
    for (const a of alerts) {
      const parcels = await this.prisma.parcel.findMany({ where: { communeId: a.communeId, ...(a.cropId ? { cropId: a.cropId } : {}) }, include: { crop: true } });
      const valueFcfa = parcels.reduce((s, p) => s + protectedValueFcfa(p.areaHa, p.crop.yieldKgPerHa, priceOf(p.cropId)), 0);
      out.push({ alertId: a.id, commune: a.commune.name, kind: a.kind, parcels: parcels.length, areaHa: parcels.reduce((s, p) => s + p.areaHa, 0), valueFcfa });
    }
    return { estimate: true, method: 'surface déclarée × rendement de référence indicatif × prix de référence moyen', alerts: out };
  }

  async gdizSupply() {
    const parcels = await this.prisma.parcel.findMany({ where: { cropId: { in: Object.keys(GDIZ_CAPACITY_T) } }, include: { crop: true } });
    return {
      source: GDIZ_SOURCE,
      note: 'Production attendue calculée sur les seules parcelles déclarées dans AlerteAgri.',
      crops: Object.entries(GDIZ_CAPACITY_T).map(([cropId, capacityT]) => {
        const own = parcels.filter((p) => p.cropId === cropId);
        const expectedT = own.reduce((s, p) => s + (p.areaHa * p.crop.yieldKgPerHa) / 1000, 0);
        return { cropId, capacityT, expectedT: Math.round(expectedT * 10) / 10, declaredParcels: own.length, coverage: capacityT ? expectedT / capacityT : 0 };
      }),
    };
  }
}

@ApiTags('tableau de bord')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('AGENT', 'ADMIN', 'COMMUNE')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser, @Query('pole') pole?: string) {
    return this.dashboard.overview(user, pole ? Number(pole) : undefined);
  }

  @Get('protected-value')
  protectedValue(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.protectedValue(user);
  }

  @Get('gdiz')
  @Roles('AGENT', 'ADMIN')
  gdiz() {
    return this.dashboard.gdizSupply();
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
