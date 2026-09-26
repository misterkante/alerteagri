import { BadRequestException, Body, Controller, Get, Module, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IsIn, IsInt, Matches, Max, Min } from 'class-validator';
import { Zone } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { AuditService } from '../common/audit.service';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { neighborIds, NEIGHBOR_KM, MAX_NEIGHBORS } from '../domain/geo';

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

class WindowDto {
  @IsIn(['NORD', 'SUD']) zone: Zone;
  @IsInt() @Min(1) @Max(2) season: number;
  @Matches(MMDD, { message: 'Date au format MM-JJ' }) start: string;
  @Matches(MMDD, { message: 'Date au format MM-JJ' }) end: string;
}

@ApiTags('referentiel')
@Controller()
export class ReferentialController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Put('crops/:id/windows')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  async setWindow(@Param('id') cropId: string, @Body() dto: WindowDto, @CurrentUser() user: AuthenticatedUser) {
    if (dto.start >= dto.end) throw new BadRequestException('La fin de la période doit suivre son début');
    if (!(await this.prisma.crop.findUnique({ where: { id: cropId } }))) throw new NotFoundException('Culture inconnue');
    const w = await this.prisma.cropWindow.upsert({
      where: { cropId_zone_season: { cropId, zone: dto.zone, season: dto.season } },
      update: { startMmDd: dto.start, endMmDd: dto.end },
      create: { cropId, zone: dto.zone, season: dto.season, startMmDd: dto.start, endMmDd: dto.end },
    });
    await this.audit.log(user.userId, 'window.update', 'CropWindow', w.id, { ...dto });
    return w;
  }

  @Get('communes')
  communes() {
    return this.prisma.commune.findMany({ orderBy: [{ department: 'asc' }, { name: 'asc' }] });
  }

  @Get('communes/:id/neighbors')
  async neighbors(@Param('id') id: string) {
    const all = await this.prisma.commune.findMany({ select: { id: true, name: true, lat: true, lon: true } });
    if (!all.some((c) => c.id === id)) throw new NotFoundException('Commune inconnue');
    const ids = neighborIds(all, id, NEIGHBOR_KM, MAX_NEIGHBORS);
    return all.filter((c) => ids.includes(c.id)).map(({ id: cid, name }) => ({ id: cid, name }));
  }

  @Get('crops')
  crops() {
    return this.prisma.crop.findMany({ include: { windows: true }, orderBy: { name: 'asc' } });
  }
}

@Module({ controllers: [ReferentialController] })
export class ReferentialModule {}
