import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { MAX_NEIGHBORS, NEIGHBOR_KM, neighborIds } from '../domain/geo';
import { PrismaService } from '../prisma/prisma.service';
import { WindowDto } from './dto/window.dto';

@Injectable()
export class ReferentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  communes() {
    return this.prisma.commune.findMany({
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    });
  }

  // The communes an alert spreads to (Q-01): the nearest ones within NEIGHBOR_KM.
  async neighbors(id: string) {
    const all = await this.prisma.commune.findMany({
      select: { id: true, name: true, lat: true, lon: true },
    });
    if (!all.some((c) => c.id === id))
      throw new NotFoundException('Commune inconnue');
    const ids = neighborIds(all, id, NEIGHBOR_KM, MAX_NEIGHBORS);
    return all
      .filter((c) => ids.includes(c.id))
      .map(({ id: cid, name }) => ({ id: cid, name }));
  }

  crops() {
    return this.prisma.crop.findMany({
      include: { windows: true },
      orderBy: { name: 'asc' },
    });
  }

  async setWindow(cropId: string, dto: WindowDto, agentId: string) {
    if (dto.start >= dto.end)
      throw new BadRequestException(
        'La fin de la période doit suivre son début',
      );
    if (!(await this.prisma.crop.findUnique({ where: { id: cropId } })))
      throw new NotFoundException('Culture inconnue');
    const window = await this.prisma.cropWindow.upsert({
      where: {
        cropId_zone_season: { cropId, zone: dto.zone, season: dto.season },
      },
      update: { startMmDd: dto.start, endMmDd: dto.end },
      create: {
        cropId,
        zone: dto.zone,
        season: dto.season,
        startMmDd: dto.start,
        endMmDd: dto.end,
      },
    });
    await this.audit.log(agentId, 'window.update', 'CropWindow', window.id, {
      ...dto,
    });
    return window;
  }
}
