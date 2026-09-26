import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { neighborIds, NEIGHBOR_KM, MAX_NEIGHBORS } from '../domain/geo';

@ApiTags('referentiel')
@Controller()
export class ReferentialController {
  constructor(private readonly prisma: PrismaService) {}

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
