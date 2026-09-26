import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { AckDto } from './dto/ack.dto';
import { RuleDto } from './dto/rule.dto';
import { AlertsService } from './alerts.service';

@ApiTags('alertes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('rules')
  @Roles('AGENT', 'ADMIN')
  rules() {
    return this.alerts.rules();
  }

  @Put('rules/:id')
  @Roles('AGENT', 'ADMIN')
  updateRule(
    @Param('id') id: string,
    @Body() dto: RuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.alerts.updateRule(id, dto, user.userId);
  }

  @Get()
  @Roles('AGENT', 'ADMIN', 'COMMUNE')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('communeId') communeId?: string,
    @Query('status') status?: 'OPEN' | 'CLOSED',
  ) {
    return this.alerts.listFor(user.userId, { communeId, status });
  }

  @Post('evaluate')
  @Roles('AGENT', 'ADMIN')
  evaluate() {
    return this.alerts.evaluateClimate();
  }

  @Post(':id/close')
  @Roles('AGENT', 'ADMIN')
  close(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.alerts.close(id, user.userId);
  }

  @Get('outbox')
  @Roles('AGENT', 'ADMIN')
  outbox() {
    return this.alerts.outbox();
  }

  @Get('me')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.alerts.myNotifications(user.userId);
  }

  @Post('notifications/:id/ack')
  ack(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AckDto,
  ) {
    return this.alerts.acknowledge(id, user.userId, dto.action);
  }
}
