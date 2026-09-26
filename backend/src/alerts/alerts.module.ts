import {
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { AuditService } from '../common/audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from './alerts.service';
import { InternalOutboxProvider, SMS_PROVIDER } from './sms.provider';

class RuleDto {
  @IsNumber() @Min(0) @Max(1000) threshold!: number;
  @IsInt() @Min(1) @Max(30) windowDays!: number;
  @IsInt() @Min(0) @Max(200) neighborKm!: number;
  @IsBoolean() active!: boolean;
  @IsString() @Length(10, 240) message!: string;
}

class AckDto {
  @IsOptional() @IsString() @Length(1, 120) action?: string;
}

@ApiTags('alertes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('rules')
  @Roles('AGENT', 'ADMIN')
  rules() {
    return this.prisma.alertRule.findMany({ orderBy: { id: 'asc' } });
  }

  @Put('rules/:id')
  @Roles('AGENT', 'ADMIN')
  async updateRule(
    @Param('id') id: string,
    @Body() dto: RuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!(await this.prisma.alertRule.findUnique({ where: { id } })))
      throw new NotFoundException('Règle inconnue');
    const r = await this.prisma.alertRule.update({ where: { id }, data: dto });
    await this.audit.log(user.userId, 'rule.update', 'AlertRule', id, {
      ...dto,
    });
    return r;
  }

  @Get()
  @Roles('AGENT', 'ADMIN', 'COMMUNE')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('communeId') communeId?: string,
    @Query('status') status?: 'OPEN' | 'CLOSED',
  ) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });
    return this.alerts.list(
      { communeId, status },
      me.role === 'COMMUNE' ? me.communeId : undefined,
    );
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

@Module({
  controllers: [AlertsController],
  providers: [
    AlertsService,
    { provide: SMS_PROVIDER, useClass: InternalOutboxProvider },
  ],
  exports: [AlertsService],
})
export class AlertsModule {}
