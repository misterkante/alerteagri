import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { UsersService } from './users.service';
import { CreateProducerDto } from './dto/create-producer.dto';

@ApiTags('comptes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.me(user.userId);
  }

  // An advisor enrols producers of their own commune; the enrolment is traced.
  @Post('producers')
  @Roles('ADVISOR')
  enrol(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProducerDto,
  ) {
    return this.users.enrol(user.userId, dto);
  }

  @Get('producers')
  @Roles('ADVISOR', 'AGENT', 'ADMIN')
  producers(@CurrentUser() user: AuthenticatedUser) {
    return this.users.producers(user.userId);
  }
}
