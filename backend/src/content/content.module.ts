import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseFilePipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContentKind } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { AlertsModule } from '../alerts/alerts.module';
import { AlertsService } from '../alerts/alerts.service';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { toWebVtt } from '../domain/captions';
import { matchInput, normalizeName } from '../domain/inputs';

export interface UploadedAudio {
  buffer: Buffer;
  size: number;
}

export const LANGS = ['fon', 'yoruba', 'bariba', 'dendi', 'francais'];
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const PICTOGRAMS = [
  'bug',
  'sun',
  'ban',
  'flask',
  'receipt',
  'cloud-rain',
  'sprout',
  'wheat',
];

// Audio type is decided by the file's first bytes, never by its name or declared type.
export function sniffAudio(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WAVE'
  )
    return 'audio/wav';
  if (
    buf.subarray(0, 3).toString('ascii') === 'ID3' ||
    (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
  )
    return 'audio/mpeg';
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return 'audio/webm';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4';
  return null;
}

class ContentDto {
  @IsEnum(ContentKind) kind!: ContentKind;
  @IsString() @Length(3, 120) title!: string;
  @IsString() @Length(10, 2000) body!: string;
  @IsIn(PICTOGRAMS) pictogram!: string;
  @IsOptional() @IsString() @Length(3, 300) officialRef?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(11)
  @IsIn(
    [
      'mais',
      'sorgho',
      'riz',
      'manioc',
      'igname',
      'arachide',
      'niebe',
      'soja',
      'coton',
      'anacarde',
      'tomate',
    ],
    { each: true },
  )
  targetCrops?: string[];
}

class InputDto {
  @IsString() @Length(2, 80) name!: string;
  @IsIn(['HOMOLOGATED', 'NOT_HOMOLOGATED']) status!:
    'HOMOLOGATED' | 'NOT_HOMOLOGATED';
  @IsString() @Length(3, 300) source!: string;
  @IsOptional() @IsString() @Length(3, 200) alternative?: string;
}

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

@ApiTags('contenus')
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('contents')
  published(@Query('kind') kind?: ContentKind) {
    return this.content.published(kind);
  }

  @Get('contents/:id/audio/:lang')
  async audio(
    @Param('id') id: string,
    @Param('lang') lang: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const a = await this.content.audio(id, lang);
    res.set({
      'Content-Type': a.mime,
      'Cache-Control': 'public, max-age=86400',
    });
    return new StreamableFile(a.data);
  }

  @Get('contents/:id/captions.vtt')
  async captions(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const vtt = await this.content.captions(id);
    res.set({
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    });
    return vtt;
  }

  @Get('inputs/check')
  check(@Query('name') name: string) {
    return this.content.checkInput(name);
  }

  @Get('cms/contents')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  all() {
    return this.content.all();
  }

  @Post('cms/contents')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: ContentDto) {
    return this.content.create(user.userId, dto);
  }

  @Put('cms/contents/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ContentDto,
  ) {
    return this.content.update(user.userId, id, dto);
  }

  @Post('cms/contents/:id/publish')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.content.setStatus(user.userId, id, 'PUBLISHED');
  }

  @Post('cms/contents/:id/unpublish')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  unpublish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.content.setStatus(user.userId, id, 'DRAFT');
  }

  @Post('cms/contents/:id/audio/:lang')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN', 'ADVISOR')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_AUDIO_BYTES } }),
  )
  audioUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('lang') lang: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_AUDIO_BYTES })],
      }),
    )
    file: UploadedAudio,
  ) {
    return this.content.attachAudio(user.userId, id, lang, file);
  }

  @Post('cms/inputs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  upsertInput(@CurrentUser() user: AuthenticatedUser, @Body() dto: InputDto) {
    return this.content.upsertInput(user.userId, dto);
  }
}

@Module({
  imports: [AlertsModule],
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
