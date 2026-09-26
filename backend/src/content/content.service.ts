import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentKind } from '@prisma/client';
import { AlertsService } from '../alerts/alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { toWebVtt } from '../domain/captions';
import { matchInput, normalizeName } from '../domain/inputs';
import { InputDto } from './dto/input.dto';
import { LANGS, sniffAudio } from './content.constants';
import { UploadedAudio } from './content.types';
import { ContentDto } from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly alerts: AlertsService,
  ) {}

  published(kind?: ContentKind) {
    return this.prisma.content.findMany({
      where: { status: 'PUBLISHED', kind },
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        pictogram: true,
        officialRef: true,
        version: true,
        updatedAt: true,
        audios: { select: { lang: true, bytes: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  all() {
    return this.prisma.content.findMany({
      include: {
        audios: { select: { lang: true, bytes: true } },
        versions: {
          select: { version: true, createdAt: true, authorId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(authorId: string, dto: ContentDto) {
    const c = await this.prisma.content.create({ data: { ...dto } });
    await this.prisma.contentVersion.create({
      data: {
        contentId: c.id,
        version: 1,
        title: dto.title,
        body: dto.body,
        authorId,
      },
    });
    await this.audit.log(authorId, 'content.create', 'Content', c.id);
    return c;
  }

  async update(authorId: string, id: string, dto: ContentDto) {
    const current = await this.prisma.content.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Fiche introuvable');
    const version = current.version + 1;
    const [c] = await this.prisma.$transaction([
      this.prisma.content.update({ where: { id }, data: { ...dto, version } }),
      this.prisma.contentVersion.create({
        data: {
          contentId: id,
          version,
          title: dto.title,
          body: dto.body,
          authorId,
        },
      }),
    ]);
    await this.audit.log(authorId, 'content.update', 'Content', id, {
      version,
    });
    return c;
  }

  async setStatus(authorId: string, id: string, status: 'DRAFT' | 'PUBLISHED') {
    const c = await this.prisma.content
      .update({ where: { id }, data: { status } })
      .catch(() => null);
    if (!c) throw new NotFoundException('Fiche introuvable');
    await this.audit.log(
      authorId,
      `content.${status.toLowerCase()}`,
      'Content',
      id,
    );
    let notified = 0;
    if (
      status === 'PUBLISHED' &&
      c.kind === 'REGLEMENTATION' &&
      c.targetCrops.length
    ) {
      const growers = await this.prisma.parcel.findMany({
        where: { cropId: { in: c.targetCrops } },
        select: { ownerId: true },
        distinct: ['ownerId'],
      });
      notified = await this.alerts.notifyDirect(
        'REGLEMENTATION',
        c.id,
        growers.map((g) => g.ownerId),
        `AlerteAgri, nouvelle règle : ${c.title}. ${c.body}`.slice(0, 300),
      );
    }
    return { ...c, notified };
  }

  async attachAudio(
    authorId: string,
    id: string,
    lang: string,
    file: UploadedAudio,
  ) {
    if (!LANGS.includes(lang))
      throw new BadRequestException('Langue non prise en charge');
    if (!(await this.prisma.content.findUnique({ where: { id } })))
      throw new NotFoundException('Fiche introuvable');
    const mime = sniffAudio(file.buffer);
    if (!mime)
      throw new BadRequestException(
        'Le fichier n’est pas un audio reconnu (ogg, mp3, wav, webm, m4a)',
      );
    const data = { mime, bytes: file.size, data: file.buffer };
    await this.prisma.contentAudio.upsert({
      where: { contentId_lang: { contentId: id, lang } },
      update: data,
      create: { contentId: id, lang, ...data },
    });
    await this.audit.log(authorId, 'content.audio', 'Content', id, {
      lang,
      bytes: file.size,
    });
    return { lang, mime, bytes: file.size };
  }

  async audio(id: string, lang: string) {
    const a = await this.prisma.contentAudio.findUnique({
      where: { contentId_lang: { contentId: id, lang } },
    });
    if (!a) throw new NotFoundException('Pas d’audio dans cette langue');
    const c = await this.prisma.content.findUnique({ where: { id } });
    if (c?.status !== 'PUBLISHED')
      throw new NotFoundException('Fiche non publiée');
    return a;
  }

  async captions(id: string) {
    const c = await this.prisma.content.findUnique({ where: { id } });
    if (c?.status !== 'PUBLISHED')
      throw new NotFoundException('Fiche non publiée');
    return toWebVtt(c.title, c.body);
  }

  async checkInput(name: string) {
    const list = await this.prisma.inputProduct.findMany();
    const found = matchInput(name ?? '', list);
    if (!found) {
      return {
        verdict: 'INCONNU',
        message:
          'Produit inconnu de la liste. Ne l’achetez pas sans l’avis de votre conseiller.',
        query: name,
      };
    }
    return {
      verdict: found.status === 'HOMOLOGATED' ? 'HOMOLOGUE' : 'NON_HOMOLOGUE',
      name: found.name,
      source: found.source,
      alternative: found.alternative,
      illustrative: found.illustrative,
      message:
        found.status === 'HOMOLOGATED'
          ? `${found.name} est homologué.`
          : `${found.name} n’est pas homologué : ne l’utilisez pas.`,
    };
  }

  async upsertInput(authorId: string, dto: InputDto) {
    const normalized = normalizeName(dto.name);
    const data = { ...dto, normalized, illustrative: false };
    const p = await this.prisma.inputProduct.upsert({
      where: { normalized },
      update: data,
      create: data,
    });
    await this.audit.log(authorId, 'input.upsert', 'InputProduct', p.id, {
      status: dto.status,
    });
    return p;
  }
}
