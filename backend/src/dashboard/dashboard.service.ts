import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { protectedValueFcfa } from '../domain/value';
import { droughtIndex, MAX_PAYOUT_FCFA_PER_HA } from '../domain/season';
import {
  DROUGHT_WINDOW_DAYS,
  GDIZ_CAPACITY_T,
  GDIZ_SOURCE,
} from './dashboard.constants';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(viewer: AuthenticatedUser, pole?: number) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: viewer.userId },
    });
    const scope =
      me.role === 'COMMUNE' ? { id: me.communeId } : pole ? { pole } : {};
    const communes = await this.prisma.commune.findMany({
      where: scope,
      include: {
        alerts: { where: { status: 'OPEN' }, select: { id: true, kind: true } },
        reports: {
          select: { status: true, createdAt: true },
          where: { createdAt: { gte: new Date(Date.now() - 14 * 86400000) } },
        },
      },
    });
    const lastRun = await this.prisma.weatherRun.findFirst({
      where: { ok: true },
      orderBy: { finishedAt: 'desc' },
    });
    return {
      lastWeatherRun: lastRun?.finishedAt ?? null,
      communes: communes.map((c) => ({
        id: c.id,
        name: c.name,
        department: c.department,
        pole: c.pole,
        lat: c.lat,
        lon: c.lon,
        openAlerts: c.alerts.length,
        alertKinds: [...new Set(c.alerts.map((a) => a.kind))],
        reportsPending: c.reports.filter((r) => r.status === 'PENDING').length,
        reportsValidated: c.reports.filter((r) => r.status === 'VALIDATED')
          .length,
      })),
    };
  }

  // Estimate only: declared area x reference yield x average reference price.
  async protectedValue(viewer: AuthenticatedUser) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: viewer.userId },
    });
    const alerts = await this.prisma.alert.findMany({
      where: {
        status: 'OPEN',
        ...(me.role === 'COMMUNE' ? { communeId: me.communeId } : {}),
      },
      include: { commune: true },
    });
    const prices = await this.prisma.referencePrice.groupBy({
      by: ['cropId'],
      _avg: { pricePerKg: true },
    });
    const priceOf = (cropId: string) =>
      prices.find((p) => p.cropId === cropId)?._avg.pricePerKg ?? 0;
    const out = [];
    for (const a of alerts) {
      const parcels = await this.prisma.parcel.findMany({
        where: {
          communeId: a.communeId,
          ...(a.cropId ? { cropId: a.cropId } : {}),
        },
        include: { crop: true },
      });
      const valueFcfa = parcels.reduce(
        (s, p) =>
          s +
          protectedValueFcfa(p.areaHa, p.crop.yieldKgPerHa, priceOf(p.cropId)),
        0,
      );
      out.push({
        alertId: a.id,
        commune: a.commune.name,
        kind: a.kind,
        parcels: parcels.length,
        areaHa: parcels.reduce((s, p) => s + p.areaHa, 0),
        valueFcfa,
      });
    }
    return {
      estimate: true,
      method:
        'surface déclarée × rendement de référence indicatif × prix de référence moyen',
      alerts: out,
    };
  }

  // Season window: the last 30 observed days, the same data for everyone, so the index is reproducible.
  async drought(now = new Date()) {
    const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');
    const since = new Date(today.getTime() - DROUGHT_WINDOW_DAYS * 86400000);
    const sums = await this.prisma.weatherDaily.groupBy({
      by: ['communeId'],
      where: { isForecast: false, date: { gte: since, lt: today } },
      _sum: { rainMm: true, et0Mm: true },
    });
    const communes = await this.prisma.commune.findMany({
      select: { id: true, name: true, pole: true },
    });
    return {
      simulation: true,
      method: `Pluie cumulée comparée à l’évapotranspiration de référence (ET0) sur ${DROUGHT_WINDOW_DAYS} jours ; versement indicatif jusqu’à ${MAX_PAYOUT_FCFA_PER_HA.toLocaleString('fr-FR')} FCFA par hectare`,
      communes: sums
        .map((s) => {
          const c = communes.find((x) => x.id === s.communeId);
          const rain = Math.round((s._sum.rainMm ?? 0) * 10) / 10;
          const et0 = Math.round((s._sum.et0Mm ?? 0) * 10) / 10;
          return {
            communeId: s.communeId,
            name: c?.name,
            pole: c?.pole,
            rainMm: rain,
            et0Mm: et0,
            ...droughtIndex(rain, et0),
          };
        })
        .sort(
          (a, b) => b.index - a.index || a.communeId.localeCompare(b.communeId),
        ),
    };
  }

  async gdizSupply() {
    const parcels = await this.prisma.parcel.findMany({
      where: { cropId: { in: Object.keys(GDIZ_CAPACITY_T) } },
      include: { crop: true },
    });
    return {
      source: GDIZ_SOURCE,
      note: 'Production attendue calculée sur les seules parcelles déclarées dans AlerteAgri.',
      crops: Object.entries(GDIZ_CAPACITY_T).map(([cropId, capacityT]) => {
        const own = parcels.filter((p) => p.cropId === cropId);
        const expectedT = own.reduce(
          (s, p) => s + (p.areaHa * p.crop.yieldKgPerHa) / 1000,
          0,
        );
        return {
          cropId,
          capacityT,
          expectedT: Math.round(expectedT * 10) / 10,
          declaredParcels: own.length,
          coverage: capacityT ? expectedT / capacityT : 0,
        };
      }),
    };
  }
}
