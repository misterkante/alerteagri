import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { evaluateClimateRule, ClimateKind } from '../domain/climate-rules';
import { neighborIds, MAX_NEIGHBORS } from '../domain/geo';
import { fillMessage as fill } from '../domain/messages';
import { RuleDto } from './dto/rule.dto';
import { SMS_PROVIDER, SmsProvider } from './sms.provider';

const CLIMATE_KINDS: AlertKind[] = [
  'HEAVY_RAIN',
  'DRY_SPELL',
  'HEAT',
  'DISEASE_HUMIDITY',
];
export const MAX_ATTEMPTS = 3;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async evaluateClimate(now = new Date()) {
    const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z');
    const rules = await this.prisma.alertRule.findMany({
      where: { active: true, kind: { in: CLIMATE_KINDS } },
    });
    const communes = await this.prisma.commune.findMany({
      select: { id: true },
    });
    let created = 0;
    for (const c of communes) {
      const days = await this.prisma.weatherDaily.findMany({
        where: { communeId: c.id, date: { gte: today } },
        orderBy: { date: 'asc' },
      });
      for (const rule of rules) {
        const r = evaluateClimateRule(
          {
            kind: rule.kind as ClimateKind,
            threshold: rule.threshold,
            windowDays: rule.windowDays,
          },
          days,
        );
        if (!r.triggered) continue;
        const alert = await this.createAlert(
          rule.id,
          c.id,
          r.periodKey,
          r.measured,
          rule.threshold,
          fill(rule.message, { measured: Math.round(r.measured * 10) / 10 }),
          now,
        );
        if (alert) created++;
      }
    }
    return { created };
  }

  async raisePestCluster(
    communeId: string,
    cropId: string,
    firstSignalAt: Date,
    measured: number,
  ) {
    const rule = await this.prisma.alertRule.findUniqueOrThrow({
      where: { id: 'chenille-legionnaire' },
    });
    const communes = await this.prisma.commune.findMany({
      select: { id: true, lat: true, lon: true },
    });
    const targets = [
      communeId,
      ...neighborIds(communes, communeId, rule.neighborKm, MAX_NEIGHBORS),
    ];
    const week = `${firstSignalAt.toISOString().slice(0, 10)}:${cropId}`;
    const alerts = [];
    for (const id of targets) {
      const message =
        id === communeId ? rule.message : `${rule.message} (foyer à proximité)`;
      const a = await this.createAlert(
        rule.id,
        id,
        `${communeId}:${week}`,
        measured,
        rule.threshold,
        message,
        firstSignalAt,
        cropId,
      );
      if (a) alerts.push(a);
    }
    return alerts;
  }

  async raisePostHarvest(
    communeId: string,
    userId: string,
    advice: string,
    humidity: number,
  ) {
    const rule = await this.prisma.alertRule.findUniqueOrThrow({
      where: { id: 'post-recolte' },
    });
    const periodKey = `${new Date().toISOString().slice(0, 10)}:${userId}`;
    const alert = await this.prisma.alert.upsert({
      where: {
        ruleId_communeId_periodKey: { ruleId: rule.id, communeId, periodKey },
      },
      update: {},
      create: {
        kind: 'POSTHARVEST',
        ruleId: rule.id,
        communeId,
        periodKey,
        measured: humidity,
        threshold: rule.threshold,
        message: fill(rule.message, { advice }),
        firstSignalAt: new Date(),
      },
    });
    await this.dispatch(alert.id, [userId]);
    return alert;
  }

  private async createAlert(
    ruleId: string,
    communeId: string,
    periodKey: string,
    measured: number,
    threshold: number,
    message: string,
    firstSignalAt: Date,
    cropId?: string,
  ) {
    const existing = await this.prisma.alert.findUnique({
      where: { ruleId_communeId_periodKey: { ruleId, communeId, periodKey } },
    });
    if (existing) return null;
    const rule = await this.prisma.alertRule.findUniqueOrThrow({
      where: { id: ruleId },
    });
    const alert = await this.prisma.alert.create({
      data: {
        kind: rule.kind,
        ruleId,
        communeId,
        periodKey,
        measured,
        threshold,
        message,
        firstSignalAt,
        cropId,
      },
    });
    await this.dispatch(alert.id);
    return alert;
  }

  async dispatch(alertId: string, onlyUserIds?: string[]) {
    const alert = await this.prisma.alert.findUniqueOrThrow({
      where: { id: alertId },
      include: { commune: true },
    });
    const users = await this.prisma.user.findMany({
      where: onlyUserIds
        ? { id: { in: onlyUserIds } }
        : { communeId: alert.communeId, role: { in: ['PRODUCER', 'ADVISOR'] } },
    });
    const body = `AlerteAgri ${alert.commune.name} : ${alert.message} Confirmez la lecture dans le menu AlerteAgri.`;
    await this.prisma.notification.createMany({
      data: users.map((u) => ({ alertId, userId: u.id, body })),
      skipDuplicates: true,
    });
    const pending = await this.prisma.notification.findMany({
      where: {
        alertId,
        status: { in: ['QUEUED', 'FAILED'] },
        attempts: { lt: MAX_ATTEMPTS },
      },
      include: { user: true },
    });
    for (const n of pending) await this.deliver(n.id, n.user.phone, n.body);
  }

  // Each message is retried on its own; one failing phone never blocks the others.
  async deliver(
    notificationId: string,
    phone: string,
    body: string,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.sms.send(phone, body);
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: { status: 'SENT', sentAt: new Date(), attempts: attempt },
        });
        return true;
      } catch {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: { status: 'FAILED', attempts: attempt },
        });
        if (attempt < MAX_ATTEMPTS)
          await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      }
    }
    return false;
  }

  // Notifications that do not come from an alert rule (reminders, regulations): one per (kind, refId, user).
  async notifyDirect(
    kind: 'RAPPEL' | 'REGLEMENTATION',
    refId: string,
    userIds: string[],
    body: string,
  ) {
    if (!userIds.length) return 0;
    const { count } = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ kind, refId, userId, body })),
      skipDuplicates: true,
    });
    const pending = await this.prisma.notification.findMany({
      where: { kind, refId, status: 'QUEUED' },
      include: { user: true },
    });
    for (const n of pending) await this.deliver(n.id, n.user.phone, n.body);
    return count;
  }

  async acknowledge(notificationId: string, userId: string, action?: string) {
    const n = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!n || n.userId !== userId)
      throw new NotFoundException('Message introuvable');
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'READ',
        readAt: n.readAt ?? new Date(),
        action: action ?? n.action,
      },
    });
  }

  async acknowledgeLatest(userId: string) {
    const n = await this.prisma.notification.findFirst({
      where: { userId, readAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return n ? this.acknowledge(n.id, userId, 'confirmé par USSD') : null;
  }

  async close(alertId: string, agentId: string) {
    const a = await this.prisma.alert.findUnique({ where: { id: alertId } });
    if (!a) throw new NotFoundException('Alerte introuvable');
    if (a.status === 'CLOSED') return a;
    await this.audit.log(agentId, 'alert.close', 'Alert', alertId);
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { status: 'CLOSED', closedAt: new Date(), closedById: agentId },
    });
  }

  myNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      include: {
        alert: {
          select: { kind: true, message: true, status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  outbox() {
    return this.prisma.notification.findMany({
      include: { user: { select: { phone: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async list(
    filter: { communeId?: string; status?: 'OPEN' | 'CLOSED' },
    scopeCommuneId?: string,
  ) {
    if (
      scopeCommuneId &&
      filter.communeId &&
      filter.communeId !== scopeCommuneId
    )
      throw new ForbiddenException('Hors de votre commune');
    const alerts = await this.prisma.alert.findMany({
      where: {
        communeId: scopeCommuneId ?? filter.communeId,
        status: filter.status,
      },
      include: {
        commune: { select: { name: true, pole: true } },
        notifications: { select: { status: true, readAt: true, action: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return alerts.map(({ notifications, ...a }) => ({
      ...a,
      loop: {
        sent: notifications.filter(
          (n) => n.status !== 'QUEUED' && n.status !== 'FAILED',
        ).length,
        failed: notifications.filter((n) => n.status === 'FAILED').length,
        read: notifications.filter((n) => n.readAt).length,
        actions: notifications.filter((n) => n.action).length,
        signalToAlertMin: Math.round(
          (a.createdAt.getTime() - a.firstSignalAt.getTime()) / 60000,
        ),
        alertToCloseMin: a.closedAt
          ? Math.round((a.closedAt.getTime() - a.createdAt.getTime()) / 60000)
          : null,
      },
    }));
  }

  rules() {
    return this.prisma.alertRule.findMany({ orderBy: { id: 'asc' } });
  }

  async updateRule(id: string, dto: RuleDto, agentId: string) {
    if (!(await this.prisma.alertRule.findUnique({ where: { id } })))
      throw new NotFoundException('Règle inconnue');
    const rule = await this.prisma.alertRule.update({
      where: { id },
      data: dto,
    });
    await this.audit.log(agentId, 'rule.update', 'AlertRule', id, { ...dto });
    return rule;
  }

  // A commune account only ever sees its own alerts, whatever filter it sends.
  async listFor(
    userId: string,
    filter: { communeId?: string; status?: 'OPEN' | 'CLOSED' },
  ) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.list(filter, me.role === 'COMMUNE' ? me.communeId : undefined);
  }
}
