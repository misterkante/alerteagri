import { Body, Controller, Get, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from './alerts.service';
import { InternalOutboxProvider, SMS_PROVIDER } from './sms.provider';

class AckDto {
  @IsOptional() @IsString() @Length(1, 120) action?: string;
}

@ApiTags('alertes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService, private readonly prisma: PrismaService) {}

  @Get()
  @Roles('AGENT', 'ADMIN', 'COMMUNE')
  async list(@CurrentUser() user: AuthenticatedUser, @Query('communeId') communeId?: string, @Query('status') status?: 'OPEN' | 'CLOSED') {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
    return this.alerts.list({ communeId, status }, me.role === 'COMMUNE' ? me.communeId : undefined);
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
  ack(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: AckDto) {
    return this.alerts.acknowledge(id, user.userId, dto.action);
  }
}

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, { provide: SMS_PROVIDER, useClass: InternalOutboxProvider }],
  exports: [AlertsService],
})
export class AlertsModule {}
