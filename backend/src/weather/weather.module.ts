import { Controller, Get, Module, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WeatherService } from './weather.service';

@ApiTags('meteo')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get('status')
  status() {
    return this.weather.lastSuccess();
  }

  @Get(':communeId')
  async series(@Param('communeId') communeId: string) {
    return { source: 'Open-Meteo', lastRun: await this.weather.lastSuccess(), days: await this.weather.series(communeId) };
  }

  @Post('refresh')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  refresh() {
    return this.weather.refresh();
  }
}

@Module({ controllers: [WeatherController], providers: [WeatherService], exports: [WeatherService] })
export class WeatherModule {}
