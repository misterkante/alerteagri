import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, MaxFileSizeValidator, Module, NotFoundException, Param, ParseFilePipe, Post, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { sniffImage } from '../domain/exports';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsLatitude, IsLongitude, IsOptional, IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { resolveProducer } from '../common/acting-for';
import { pestClusterReached, PEST_WINDOW_DAYS } from '../domain/pest';
import { AlertsModule } from '../alerts/alerts.module';
import { AlertsService } from '../alerts/alerts.service';

export const SYMPTOMS = ['feuilles-trouees', 'chenilles', 'sciure-cornet', 'jaunissement', 'taches', 'fletrissement', 'insectes-piqueurs'] as const;
export const PEST_CROPS = ['mais', 'sorgho', 'riz', 'niebe', 'soja', 'coton', 'arachide', 'manioc', 'tomate'];
const FAW_SYMPTOMS = ['feuilles-trouees', 'chenilles', 'sciure-cornet'];

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export class CreateReportDto {
  @IsString() @Length(8, 64) clientId: string;
  @IsIn(PEST_CROPS) cropId: string;
  @IsIn(SYMPTOMS as unknown as string[]) symptom: string;
  @IsOptional() @IsLatitude() lat?: number;
  @IsOptional() @IsLongitude() lon?: number;
  @IsOptional() @IsString() forUserId?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly alerts: AlertsService) {}

  async create(actor: AuthenticatedUser, dto: CreateReportDto) {
    const existing = await this.prisma.pestReport.findUnique({ where: { clientId: dto.clientId } });
    if (existing) return existing;
    const { target, actingForId } = await resolveProducer(this.prisma, actor, dto.forUserId);
    const report = await this.prisma.pestReport.create({
      data: { clientId: dto.clientId, reporterId: actor.userId, actingForId, communeId: target.communeId, cropId: dto.cropId,
        symptom: dto.symptom, lat: dto.lat, lon: dto.lon },
    });
    await this.audit.log(actor.userId, 'report.create', 'PestReport', report.id, { symptom: dto.symptom }, actingForId);
    return report;
  }

  async validate(agentId: string, id: string, decision: 'VALIDATED' | 'REJECTED', now = new Date()) {
    const report = await this.prisma.pestReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Signalement introuvable');
    const updated = await this.prisma.pestReport.update({ where: { id }, data: { status: decision, validatedById: agentId, validatedAt: now } });
    await this.audit.log(agentId, `report.${decision.toLowerCase()}`, 'PestReport', id);
    if (decision !== 'VALIDATED' || !FAW_SYMPTOMS.includes(report.symptom) || report.cropId !== 'mais') return { report: updated, alerts: [] };
    const rule = await this.prisma.alertRule.findUniqueOrThrow({ where: { id: 'chenille-legionnaire' } });
    const since = new Date(now.getTime() - PEST_WINDOW_DAYS * 86400000);
    const recent = await this.prisma.pestReport.findMany({
      where: { communeId: report.communeId, cropId: 'mais', symptom: { in: FAW_SYMPTOMS }, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });
    if (!rule.active || !pestClusterReached(recent, rule.threshold, now)) return { report: updated, alerts: [] };
    const validated = recent.filter((r) => r.status === 'VALIDATED');
    const alerts = await this.alerts.raisePestCluster(report.communeId, 'mais', validated[0].createdAt, validated.length);
    return { report: updated, alerts };
  }

  async attachPhoto(actor: AuthenticatedUser, id: string, file: { buffer: Buffer; size: number }) {
    const r = await this.prisma.pestReport.findUnique({ where: { id } });
    if (!r || (r.reporterId !== actor.userId && r.actingForId !== actor.userId)) throw new NotFoundException('Signalement introuvable');
    const mime = sniffImage(file.buffer);
    if (!mime) throw new BadRequestException('Le fichier n’est pas une photo reconnue (JPEG, PNG ou WebP)');
    await this.prisma.pestReport.update({ where: { id }, data: { photo: file.buffer, photoMime: mime } });
    await this.audit.log(actor.userId, 'report.photo', 'PestReport', id, { bytes: file.size });
    return { id, mime, bytes: file.size };
  }

  async photo(id: string) {
    const r = await this.prisma.pestReport.findUnique({ where: { id }, select: { photo: true, photoMime: true } });
    if (!r?.photo || !r.photoMime) throw new NotFoundException('Pas de photo');
    return r;
  }

  // Exact coordinates are only returned to staff; producers see the commune only.
  async list(viewer: AuthenticatedUser, communeId?: string) {
    const staff = ['AGENT', 'ADMIN', 'ADVISOR'].includes(viewer.role);
    const reports = await this.prisma.pestReport.findMany({
      where: { communeId }, include: { commune: { select: { name: true } }, crop: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    return reports.map(({ photo, ...r }) => {
      const out = { ...r, hasPhoto: !!photo };
      return staff || r.reporterId === viewer.userId ? out : { ...out, lat: null, lon: null, reporterId: null, actingForId: null };
    });
  }
}

@ApiTags('signalements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @Roles('PRODUCER', 'ADVISOR')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.reports.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('communeId') communeId?: string) {
    return this.reports.list(user, communeId);
  }

  @Post(':id/photo')
  @Roles('PRODUCER', 'ADVISOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES } }))
  photoUpload(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string,
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: MAX_PHOTO_BYTES })] })) file: { buffer: Buffer; size: number }) {
    return this.reports.attachPhoto(user, id, file);
  }

  @Get(':id/photo')
  @Roles('AGENT', 'ADMIN', 'ADVISOR')
  async photo(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const r = await this.reports.photo(id);
    res.set({ 'Content-Type': r.photoMime!, 'Cache-Control': 'private, max-age=3600' });
    return new StreamableFile(r.photo!);
  }

  @Post(':id/validate')
  @Roles('AGENT', 'ADMIN')
  validate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reports.validate(user.userId, id, 'VALIDATED');
  }

  @Post(':id/reject')
  @Roles('AGENT', 'ADMIN')
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    if (!user) throw new ForbiddenException();
    return this.reports.validate(user.userId, id, 'REJECTED');
  }
}

@Module({ imports: [AlertsModule], controllers: [ReportsController], providers: [ReportsService], exports: [ReportsService] })
export class ReportsModule {}
