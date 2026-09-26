import {
  Body,
  Controller,
  Get,
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
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContentKind } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { InputDto } from './dto/input.dto';
import { UploadedAudio } from './content.types';
import { MAX_AUDIO_BYTES } from './content.constants';
import { ContentDto } from './dto/content.dto';
import { ContentService } from './content.service';
import { VoiceDto } from './dto/voice.dto';

const VOICE_LIMIT = () => Number(process.env.VOICE_LIMIT_PER_MIN ?? 4);

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

  @Get('cms/voices')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN', 'ADVISOR')
  voices() {
    return this.content.voices();
  }

  // The speech provider accepts 5 requests a minute; this route stays under it by default.
  @Post('cms/contents/:id/voice/:lang')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN', 'ADVISOR')
  @Throttle({ default: { limit: VOICE_LIMIT, ttl: 60_000 } })
  voice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('lang') lang: string,
    @Body() dto: VoiceDto,
  ) {
    return this.content.generateVoice(user.userId, id, lang, dto);
  }

  @Post('cms/inputs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  upsertInput(@CurrentUser() user: AuthenticatedUser, @Body() dto: InputDto) {
    return this.content.upsertInput(user.userId, dto);
  }
}
