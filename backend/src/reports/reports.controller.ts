import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { MAX_PHOTO_BYTES } from './reports.constants';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

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
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('communeId') communeId?: string,
  ) {
    return this.reports.list(user, communeId);
  }

  @Post(':id/photo')
  @Roles('PRODUCER', 'ADVISOR')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES } }),
  )
  photoUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_PHOTO_BYTES })],
      }),
    )
    file: { buffer: Buffer; size: number },
  ) {
    return this.reports.attachPhoto(user, id, file);
  }

  @Get(':id/photo')
  @Roles('AGENT', 'ADMIN', 'ADVISOR')
  async photo(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.reports.photo(id);
    res.set({
      'Content-Type': r.photoMime!,
      'Cache-Control': 'private, max-age=3600',
    });
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
