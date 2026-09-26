import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';

// Resolves who an action is for. A producer acts only for themself; an advisor may act for a producer of their commune.
export async function resolveProducer(
  prisma: PrismaService,
  actor: AuthenticatedUser,
  forUserId?: string,
) {
  const self = await prisma.user.findUnique({ where: { id: actor.userId } });
  if (!self) throw new NotFoundException('Compte introuvable');
  if (!forUserId || forUserId === self.id) {
    if (self.role !== 'PRODUCER' && self.role !== 'ADVISOR')
      throw new ForbiddenException(
        'Action réservée aux producteurs et conseillers',
      );
    return { target: self, actingForId: undefined as string | undefined };
  }
  if (self.role !== 'ADVISOR')
    throw new ForbiddenException(
      'Seul un conseiller peut agir au nom d’un producteur',
    );
  const target = await prisma.user.findUnique({ where: { id: forUserId } });
  if (
    !target ||
    target.role !== 'PRODUCER' ||
    target.communeId !== self.communeId
  ) {
    throw new ForbiddenException(
      'Ce producteur n’est pas suivi par ce conseiller',
    );
  }
  return { target, actingForId: target.id };
}
