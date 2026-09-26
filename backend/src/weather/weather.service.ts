import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PAST_DAYS = 30;
export const FORECAST_DAYS = 16;
const TIMEOUT_MS = 20000;
const REFRESH_MS = 6 * 3600 * 1000;

interface OpenMeteoDaily {
  time: string[];
  precipitation_sum: (number | null)[];
  temperature_2m_max: (number | null)[];
  relative_humidity_2m_mean: (number | null)[];
  et0_fao_evapotranspiration: (number | null)[];
}

@Injectable()
export class WeatherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeatherService.name);
  private timer?: NodeJS.Timeout;
  fetcher: typeof fetch = (input, init) => fetch(input, init);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.WEATHER_AUTO_REFRESH === 'true') {
      this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async refresh() {
    const run = await this.prisma.weatherRun.create({ data: {} });
    try {
      const communes = await this.prisma.commune.findMany({
        orderBy: { id: 'asc' },
      });
      const url =
        'https://api.open-meteo.com/v1/forecast?' +
        new URLSearchParams({
          latitude: communes.map((c) => c.lat).join(','),
          longitude: communes.map((c) => c.lon).join(','),
          daily:
            'precipitation_sum,temperature_2m_max,relative_humidity_2m_mean,et0_fao_evapotranspiration',
          past_days: String(PAST_DAYS),
          forecast_days: String(FORECAST_DAYS),
          timezone: 'Africa/Porto-Novo',
        });
      const res = await this.fetcher(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const body = await res.json();
      const list: { daily: OpenMeteoDaily }[] = Array.isArray(body)
        ? body
        : [body];
      if (list.length !== communes.length)
        throw new Error(
          `Open-Meteo a renvoyé ${list.length} séries pour ${communes.length} communes`,
        );
      const today = new Date().toISOString().slice(0, 10);
      const rows = list.flatMap((entry, i) =>
        entry.daily.time.map((day, j) => ({
          communeId: communes[i].id,
          date: new Date(`${day}T00:00:00Z`),
          rainMm: entry.daily.precipitation_sum[j] ?? 0,
          tmaxC: entry.daily.temperature_2m_max[j] ?? 0,
          humidity: entry.daily.relative_humidity_2m_mean[j] ?? 0,
          et0Mm: entry.daily.et0_fao_evapotranspiration[j] ?? 0,
          isForecast: day > today,
        })),
      );
      const from = rows.reduce(
        (min, r) => (r.date < min ? r.date : min),
        rows[0].date,
      );
      await this.prisma.$transaction([
        this.prisma.weatherDaily.deleteMany({ where: { date: { gte: from } } }),
        this.prisma.weatherDaily.createMany({ data: rows }),
      ]);
      return this.prisma.weatherRun.update({
        where: { id: run.id },
        data: { ok: true, communes: communes.length, finishedAt: new Date() },
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.logger.error(`Relevé météo échoué : ${error}`);
      return this.prisma.weatherRun.update({
        where: { id: run.id },
        data: { ok: false, error, finishedAt: new Date() },
      });
    }
  }

  lastSuccess() {
    return this.prisma.weatherRun.findFirst({
      where: { ok: true },
      orderBy: { finishedAt: 'desc' },
    });
  }

  series(communeId: string) {
    return this.prisma.weatherDaily.findMany({
      where: { communeId },
      orderBy: { date: 'asc' },
    });
  }
}
