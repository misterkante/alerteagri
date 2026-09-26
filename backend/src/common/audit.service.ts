import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(
    actorId: string,
    action: string,
    entity: string,
    entityId?: string,
    data?: Prisma.InputJsonValue,
    actingForId?: string,
  ) {
    return this.prisma.auditLog.create({
      data: { actorId, action, entity, entityId, data, actingForId },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
