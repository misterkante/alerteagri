import {
  Body,
  ConflictException,
  Controller,
  Get,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

class CreateProducerDto {
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'Numéro de téléphone invalide' })
  phone!: string;
  @IsString() @Length(2, 80) name!: string;
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'Le PIN doit contenir 4 chiffres' })
  pin!: string;
}

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  phone: true,
  role: true,
  communeId: true,
  createdAt: true,
} as const;

@ApiTags('comptes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: { ...PUBLIC_FIELDS, commune: true },
    });
  }

  // An advisor enrols producers of their own commune; the enrolment is traced.
  @Post('producers')
  @Roles('ADVISOR')
  async enrol(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProducerDto,
  ) {
    const advisor = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });
    if (await this.prisma.user.findUnique({ where: { phone: dto.phone } }))
      throw new ConflictException('Ce numéro est déjà enregistré');
    const producer = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        name: dto.name,
        pinHash: await bcrypt.hash(dto.pin, 10),
        role: 'PRODUCER',
        communeId: advisor.communeId,
        createdById: advisor.id,
      },
      select: PUBLIC_FIELDS,
    });
    await this.audit.log(
      advisor.id,
      'producer.enrol',
      'User',
      producer.id,
      undefined,
      producer.id,
    );
    return producer;
  }

  @Get('producers')
  @Roles('ADVISOR', 'AGENT', 'ADMIN')
  async producers(@CurrentUser() user: AuthenticatedUser) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
    });
    return this.prisma.user.findMany({
      where: {
        role: 'PRODUCER',
        ...(me.role === 'ADVISOR' ? { communeId: me.communeId } : {}),
      },
      select: PUBLIC_FIELDS,
      orderBy: { name: 'asc' },
    });
  }
}

@Module({ controllers: [UsersController] })
export class UsersModule {}
