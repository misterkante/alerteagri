import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { SimulateDto } from './dto/simulate.dto';
import { UssdDto } from './dto/ussd.dto';
import { UssdService } from './ussd.service';

@ApiTags('ussd')
@Controller('ussd')
export class UssdController {
  constructor(private readonly ussd: UssdService) {}

  // Entry point for a USSD aggregator: text/plain CON/END answers, authenticated by a shared secret.
  @Post()
  @HttpCode(200)
  gateway(
    @Headers('x-ussd-secret') secret: string | undefined,
    @Body() dto: UssdDto,
  ) {
    const expected = process.env.USSD_SECRET ?? '';
    const ok =
      expected.length > 0 &&
      !!secret &&
      secret.length === expected.length &&
      timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
    if (!ok) throw new UnauthorizedException('Passerelle USSD non reconnue');
    return this.ussd.handle(dto.sessionId, dto.phoneNumber, dto.text);
  }

  // Demo phone: runs the same menu, only with the logged-in user's own number.
  @Post('simulate')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async simulate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SimulateDto,
  ) {
    if (process.env.DEMO_MODE !== 'true')
      throw new ForbiddenException('Simulateur désactivé');
    return {
      response: await this.ussd.handle(dto.sessionId, user.phone, dto.text),
    };
  }
}
