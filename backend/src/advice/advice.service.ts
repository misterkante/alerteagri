import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { resolveProducer } from '../common/acting-for';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { sowingAdvice } from '../domain/sowing';
import { postHarvestAdvice, HUMID_PCT } from '../domain/postharvest';
import { AlertsService } from '../alerts/alerts.service';
import { HarvestDto } from './dto/harvest.dto';

const mmdd = (d: Date) => d.toISOString().slice(5, 10);
const fr = (m: string) => `${m.slice(3)}/${m.slice(0, 2)}`;
const MAX_HARVEST_AGE_DAYS = 30;

@Injectable()
export class AdviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly audit: AuditService,
  ) {}

  async sowing(communeId: string, cropId: string, now = new Date()) {
    const commune = await this.prisma.commune.findUnique({
      where: { id: communeId },
    });
    const crop = await this.prisma.crop.findUnique({ where: { id: cropId } });
    if (!commune || !crop)
      throw new NotFoundException('Commune ou culture inconnue');
    const windows = await this.prisma.cropWindow.findMany({
      where: { cropId, zone: commune.zone },
      orderBy: { startMmDd: 'asc' },
    });
    const today = mmdd(now);
    const inWindow = windows.some(
      (w) => w.startMmDd <= today && today <= w.endMmDd,
    );
    const next = windows.find((w) => w.startMmDd > today) ?? windows[0];
    const since = new Date(now.getTime() - 20 * 86400000);
    const days = await this.prisma.weatherDaily.findMany({
      where: { communeId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
    const result = sowingAdvice(days, {
      today: now,
      inWindow,
      nextWindow: next ? fr(next.startMmDd) : null,
    });
    return {
      commune: commune.name,
      crop: crop.name,
      zone: commune.zone,
      ...result,
      windows: windows.map((w) => ({
        season: w.season,
        from: fr(w.startMmDd),
        to: fr(w.endMmDd),
      })),
      source:
        'Critère de Sivakumar (1988) sur la pluie Open-Meteo ; calendrier indicatif à valider par l’ATDA',
      rain: days.map((d) => ({
        date: d.date,
        rainMm: d.rainMm,
        isForecast: d.isForecast,
      })),
    };
  }

  async postHarvest(
    userId: string,
    communeId: string,
    cropId: string,
    harvestDate: Date,
    now = new Date(),
  ) {
    const ageDays = (now.getTime() - harvestDate.getTime()) / 86400000;
    if (ageDays < -1 || ageDays > MAX_HARVEST_AGE_DAYS) {
      throw new BadRequestException(
        `La date de récolte doit être comprise entre il y a ${MAX_HARVEST_AGE_DAYS} jours et demain`,
      );
    }
    const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');
    const forecast = await this.prisma.weatherDaily.findMany({
      where: { communeId, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 5,
    });
    const advice = postHarvestAdvice(cropId, forecast);
    if (advice.code === 'NON_CONCERNE' || advice.code === 'PAS_DE_PREVISION')
      return { ...advice, notified: false };
    const harvest = await this.prisma.harvest.create({
      data: { userId, communeId, cropId, harvestDate, advice: advice.message },
    });
    const humidity = forecast.length
      ? Math.max(...forecast.map((d) => d.humidity))
      : 0;
    let notified = false;
    if (advice.code === 'COUVREZ' || humidity >= HUMID_PCT) {
      await this.alerts.raisePostHarvest(
        communeId,
        userId,
        advice.message,
        humidity,
      );
      notified = true;
    }
    return { ...advice, harvestId: harvest.id, notified };
  }

  // A producer declares a harvest, or an advisor does it for one of the producers they follow.
  async declareHarvest(user: AuthenticatedUser, dto: HarvestDto) {
    const { target, actingForId } = await resolveProducer(
      this.prisma,
      user,
      dto.forUserId,
    );
    const result = await this.postHarvest(
      target.id,
      target.communeId,
      dto.cropId,
      dto.harvestDate,
    );
    await this.audit.log(
      user.userId,
      'harvest.declare',
      'Harvest',
      (result as { harvestId?: string }).harvestId,
      { cropId: dto.cropId },
      actingForId,
    );
    return result;
  }
}
