import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';
import { JwtPayload } from './jwt-payload.interface';

const PIN_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) {
      throw new ConflictException('Ce numero est deja enregistre');
    }

    if (!(await this.prisma.commune.findUnique({ where: { id: dto.communeId } }))) {
      throw new BadRequestException('Commune inconnue');
    }
    const pinHash = await bcrypt.hash(dto.pin, PIN_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        name: dto.name,
        role: dto.role,
        communeId: dto.communeId,
        pinHash,
      },
    });

    return this.buildSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      throw new UnauthorizedException('Numero ou PIN incorrect');
    }

    const pinMatches = await bcrypt.compare(dto.pin, user.pinHash);
    if (!pinMatches) {
      throw new UnauthorizedException('Numero ou PIN incorrect');
    }

    return this.buildSession(user);
  }

  private buildSession(user: { id: string; phone: string; role: Role; name: string; communeId: string }) {
    const payload: JwtPayload = { sub: user.id, phone: user.phone, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        communeId: user.communeId,
      },
    };
  }
}
