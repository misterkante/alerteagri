import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { IntegrationsService } from './integrations.service';

@ApiTags('interoperabilite')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('AGENT', 'ADMIN')
@Controller()
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('exports/famews')
  async famews(@Res({ passthrough: true }) res: Response) {
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="famews-benin.csv"',
    });
    return this.integrations.famews();
  }

  @Post('integrations/sipi/lots')
  sipi(@CurrentUser() user: AuthenticatedUser) {
    return this.integrations.sendLotsToSipi(user.userId);
  }

  @Get('integrations/log')
  log() {
    return this.integrations.log();
  }
}
