import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { DashboardService } from './dashboard.service';

@ApiTags('tableau de bord')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('AGENT', 'ADMIN', 'COMMUNE')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('pole') pole?: string,
  ) {
    return this.dashboard.overview(user, pole ? Number(pole) : undefined);
  }

  @Get('protected-value')
  protectedValue(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.protectedValue(user);
  }

  @Get('drought')
  @Roles('AGENT', 'ADMIN')
  drought() {
    return this.dashboard.drought();
  }

  @Get('gdiz')
  @Roles('AGENT', 'ADMIN')
  gdiz() {
    return this.dashboard.gdizSupply();
  }
}
