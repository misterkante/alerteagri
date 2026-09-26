import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PIN_SALT_ROUNDS } from '../auth/auth.constants';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProducerDto } from './dto/create-producer.dto';

// Never the PIN hash: the only fields an account ever exposes.
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  phone: true,
  role: true,
  communeId: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { ...PUBLIC_FIELDS, commune: true },
    });
  }

  async enrol(advisorId: string, dto: CreateProducerDto) {
    const advisor = await this.prisma.user.findUniqueOrThrow({
      where: { id: advisorId },
    });
    if (await this.prisma.user.findUnique({ where: { phone: dto.phone } }))
      throw new ConflictException('Ce numéro est déjà enregistré');
    const producer = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        name: dto.name,
        pinHash: await bcrypt.hash(dto.pin, PIN_SALT_ROUNDS),
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

  // An advisor sees the producers of their commune; agents and admins see all of them.
  async producers(userId: string) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
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
