import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { HarvestDto } from './dto/harvest.dto';
import { AdviceService } from './advice.service';

@ApiTags('conseils')
@Controller('advice')
export class AdviceController {
  constructor(private readonly advice: AdviceService) {}

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
  harvest(@CurrentUser() user: AuthenticatedUser, @Body() dto: HarvestDto) {
    return this.advice.declareHarvest(user, dto);
  }
}
