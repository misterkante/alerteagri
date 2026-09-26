import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sniffImage } from '../domain/exports';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { resolveProducer } from '../common/acting-for';
import { pestClusterReached, PEST_WINDOW_DAYS } from '../domain/pest';
import { AlertsService } from '../alerts/alerts.service';
import { CreateReportDto } from './dto/create-report.dto';
import { FAW_SYMPTOMS } from './reports.constants';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateReportDto) {
    const existing = await this.prisma.pestReport.findUnique({
      where: { clientId: dto.clientId },
    });
    if (existing) return existing;
    const { target, actingForId } = await resolveProducer(
      this.prisma,
      actor,
      dto.forUserId,
    );
    const report = await this.prisma.pestReport.create({
      data: {
        clientId: dto.clientId,
        reporterId: actor.userId,
        actingForId,
        communeId: target.communeId,
        cropId: dto.cropId,
        symptom: dto.symptom,
        lat: dto.lat,
        lon: dto.lon,
      },
    });
    await this.audit.log(
      actor.userId,
      'report.create',
      'PestReport',
      report.id,
      { symptom: dto.symptom },
      actingForId,
    );
    return report;
  }

  async validate(
    agentId: string,
    id: string,
    decision: 'VALIDATED' | 'REJECTED',
    now = new Date(),
  ) {
    const report = await this.prisma.pestReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Signalement introuvable');
    const updated = await this.prisma.pestReport.update({
      where: { id },
      data: { status: decision, validatedById: agentId, validatedAt: now },
    });
    await this.audit.log(
      agentId,
      `report.${decision.toLowerCase()}`,
      'PestReport',
      id,
    );
    if (
      decision !== 'VALIDATED' ||
      !FAW_SYMPTOMS.includes(report.symptom) ||
      report.cropId !== 'mais'
    )
      return { report: updated, alerts: [] };
    const rule = await this.prisma.alertRule.findUniqueOrThrow({
      where: { id: 'chenille-legionnaire' },
    });
    const since = new Date(now.getTime() - PEST_WINDOW_DAYS * 86400000);
    const recent = await this.prisma.pestReport.findMany({
      where: {
        communeId: report.communeId,
        cropId: 'mais',
        symptom: { in: FAW_SYMPTOMS },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!rule.active || !pestClusterReached(recent, rule.threshold, now))
      return { report: updated, alerts: [] };
    const validated = recent.filter((r) => r.status === 'VALIDATED');
    const alerts = await this.alerts.raisePestCluster(
      report.communeId,
      'mais',
      validated[0].createdAt,
      validated.length,
    );
    return { report: updated, alerts };
  }

  async attachPhoto(
    actor: AuthenticatedUser,
    id: string,
    file: { buffer: Buffer; size: number },
  ) {
    const r = await this.prisma.pestReport.findUnique({ where: { id } });
    if (!r || (r.reporterId !== actor.userId && r.actingForId !== actor.userId))
      throw new NotFoundException('Signalement introuvable');
    const mime = sniffImage(file.buffer);
    if (!mime)
      throw new BadRequestException(
        'Le fichier n’est pas une photo reconnue (JPEG, PNG ou WebP)',
      );
    await this.prisma.pestReport.update({
      where: { id },
      data: { photo: file.buffer, photoMime: mime },
    });
    await this.audit.log(actor.userId, 'report.photo', 'PestReport', id, {
      bytes: file.size,
    });
    return { id, mime, bytes: file.size };
  }

  async photo(id: string) {
    const r = await this.prisma.pestReport.findUnique({
      where: { id },
      select: { photo: true, photoMime: true },
    });
    if (!r?.photo || !r.photoMime) throw new NotFoundException('Pas de photo');
    return r;
  }

  // Exact coordinates are only returned to staff; producers see the commune only.
  async list(viewer: AuthenticatedUser, communeId?: string) {
    const staff = ['AGENT', 'ADMIN', 'ADVISOR'].includes(viewer.role);
    const reports = await this.prisma.pestReport.findMany({
      where: { communeId },
      include: {
        commune: { select: { name: true } },
        crop: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return reports.map(({ photo, ...r }) => {
      const out = { ...r, hasPhoto: !!photo };
      return staff || r.reporterId === viewer.userId
        ? out
        : { ...out, lat: null, lon: null, reporterId: null, actingForId: null };
    });
  }
}
