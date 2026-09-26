import {
  Body,
  Controller,
  Get,
  Module,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { resolveProducer } from '../common/acting-for';
import { AlertsModule } from '../alerts/alerts.module';
import { AdviceService } from './advice.service';

class HarvestDto {
  @IsIn([
    'mais',
    'arachide',
    'sorgho',
    'riz',
    'niebe',
    'soja',
    'coton',
    'manioc',
    'igname',
    'anacarde',
    'tomate',
  ])
  cropId!: string;
  @Type(() => Date) @IsDate() harvestDate!: Date;
  @IsOptional() @IsString() forUserId?: string;
}

@ApiTags('conseils')
@Controller('advice')
export class AdviceController {
  constructor(
    private readonly advice: AdviceService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('sowing')
  sowing(
    @Query('communeId') communeId: string,
    @Query('cropId') cropId: string,
  ) {
    return this.advice.sowing(communeId, cropId);
  }

  @Post('harvest')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async harvest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: HarvestDto,
  ) {
    const { target, actingForId } = await resolveProducer(
      this.prisma,
      user,
      dto.forUserId,
    );
    const result = await this.advice.postHarvest(
      target.id,
      target.communeId,
      dto.cropId,
      dto.harvestDate,
    );
    await this.audit.log(
      user.userId,
      'harvest.declare',
      'Harvest',
      (result as { harvestId?: string }).harvestId,
      { cropId: dto.cropId },
      actingForId,
    );
    return result;
  }
}

@Module({
  imports: [AlertsModule],
  controllers: [AdviceController],
  providers: [AdviceService],
  exports: [AdviceService],
})
export class AdviceModule {}
