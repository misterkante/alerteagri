import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { LotDto } from './dto/lot.dto';
import { ParcelDto } from './dto/parcel.dto';
import { TraceService } from './trace.service';

@ApiTags('tracabilite')
@Controller()
export class TraceController {
  constructor(private readonly trace: TraceService) {}

  @Post('parcels')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCER', 'ADVISOR')
  parcel(@CurrentUser() user: AuthenticatedUser, @Body() dto: ParcelDto) {
    return this.trace.parcel(user, dto);
  }

  @Get('parcels/mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCER', 'ADVISOR')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.trace.mine(user);
  }

  @Post('parcels/reminders/run')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  run() {
    return this.trace.runReminders();
  }

  @Get('parcels/:id/steps')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  steps(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.trace.steps(user, id);
  }

  @Get('parcels/:id/water')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  water(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.trace.water(user, id);
  }

  @Post('lots')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVISOR', 'AGENT')
  lot(@CurrentUser() user: AuthenticatedUser, @Body() dto: LotDto) {
    return this.trace.lot(user, dto);
  }

  @Get('lots/:code')
  publicLot(@Param('code') code: string) {
    return this.trace.publicLot(code);
  }
}
