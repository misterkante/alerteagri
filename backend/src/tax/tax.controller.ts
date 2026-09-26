import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { RateDto } from './dto/rate.dto';
import { CollectDto } from './dto/collect.dto';
import { TaxService } from './tax.service';

@ApiTags('recettes (TDL)')
@Controller()
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Get('tax/rates')
  rates(@Query('communeId') communeId?: string) {
    return this.tax.rates(communeId);
  }

  @Get('receipts/:receiptId')
  verify(@Param('receiptId') receiptId: string, @Query('sig') sig: string) {
    return this.tax.verify(receiptId, sig);
  }

  @Post('tax/orders/:orderId/pay')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUYER')
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    return this.tax.payOrder(user.userId, orderId);
  }

  @Post('tax/collect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMMUNE')
  collect(@CurrentUser() user: AuthenticatedUser, @Body() dto: CollectDto) {
    return this.tax.collect(user.userId, dto);
  }

  @Put('tax/rates')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMMUNE', 'ADMIN')
  setRate(@CurrentUser() user: AuthenticatedUser, @Body() dto: RateDto) {
    return this.tax.setRate(user, dto);
  }

  @Get('tax/reconciliation')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMMUNE', 'ADMIN')
  async reconciliation(@CurrentUser() user: AuthenticatedUser) {
    const { rows, ...summary } = await this.tax.reconciliation(user);
    return { ...summary, rows: rows.slice(-200) };
  }

  @Get('tax/reconciliation.csv')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMMUNE', 'ADMIN')
  async reconciliationCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { rows } = await this.tax.reconciliation(user);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="rapprochement-tdl.csv"',
    });
    return (
      [
        'receiptId,commune,crop,quantityKg,amountFcfa,paidAt,signatureValid',
        ...rows.map((r) =>
          [
            r.receiptId,
            r.communeId,
            r.cropId,
            r.quantityKg,
            r.amountFcfa,
            r.paidAt,
            r.signatureValid,
          ].join(','),
        ),
      ].join('\n') + '\n'
    );
  }

  @Get('tax/revenue')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMMUNE', 'AGENT', 'ADMIN')
  revenue(@CurrentUser() user: AuthenticatedUser) {
    return this.tax.revenue(user);
  }
}
