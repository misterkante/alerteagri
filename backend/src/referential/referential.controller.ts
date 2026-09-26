import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { ReferentialService } from './referential.service';
import { WindowDto } from './dto/window.dto';

@ApiTags('referentiel')
@Controller()
export class ReferentialController {
  constructor(private readonly referential: ReferentialService) {}

  @Put('crops/:id/windows')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'ADMIN')
  setWindow(
    @Param('id') cropId: string,
    @Body() dto: WindowDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.referential.setWindow(cropId, dto, user.userId);
  }

  @Get('communes')
  communes() {
    return this.referential.communes();
  }

  @Get('communes/:id/neighbors')
  neighbors(@Param('id') id: string) {
    return this.referential.neighbors(id);
  }

  @Get('crops')
  crops() {
    return this.referential.crops();
  }
}
