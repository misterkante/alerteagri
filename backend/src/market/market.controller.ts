import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { OrderDto } from './dto/order.dto';
import { GroupListingDto } from './dto/group-listing.dto';
import { ListingDto } from './dto/listing.dto';
import { MarketService } from './market.service';

@ApiTags('marche (API ouverte)')
@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get('listings')
  listings(
    @Query('cropId') cropId?: string,
    @Query('communeId') communeId?: string,
  ) {
    return this.market.listings(cropId, communeId);
  }

  @Get('prices')
  prices(@Query('cropId') cropId?: string) {
    return this.market.prices(cropId);
  }

  @Post('listings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PRODUCER', 'ADVISOR')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: ListingDto) {
    return this.market.createListing(user, dto);
  }

  @Post('group-listings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVISOR')
  group(@CurrentUser() user: AuthenticatedUser, @Body() dto: GroupListingDto) {
    return this.market.createGroupListing(user, dto);
  }

  @Post('orders')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUYER')
  order(@CurrentUser() user: AuthenticatedUser, @Body() dto: OrderDto) {
    return this.market.order(user, dto);
  }

  @Get('orders/me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('BUYER')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.market.myOrders(user.userId);
  }
}
