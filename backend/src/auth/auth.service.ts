import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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

    const pinHash = await bcrypt.hash(dto.pin, PIN_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        name: dto.name,
        role: dto.role,
        commune: dto.commune,
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

  private buildSession(user: { id: string; phone: string; role: any; name: string; commune: string }) {
    const payload: JwtPayload = { sub: user.id, phone: user.phone, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        commune: user.commune,
      },
    };
  }
}
