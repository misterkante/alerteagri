import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  phone: string;
  role: Role;
}

export interface AuthenticatedUser {
  userId: string;
  phone: string;
  role: Role;
}
