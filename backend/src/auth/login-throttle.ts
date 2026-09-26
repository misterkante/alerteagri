import { ExecutionContext } from '@nestjs/common';
import { ThrottlerOptions } from '@nestjs/throttler';
import { toBeninPhone } from '../domain/phone';

// A 4-digit PIN has 10 000 values: attempts on one account must be scarce. They are counted per
// account and address, so a room sharing one wifi (a training, a jury) is not locked out together.
export const LOGIN_LIMIT = () => Number(process.env.LOGIN_LIMIT_PER_MIN ?? 5);
// All accounts together, per address: stops one machine from trying a PIN across many accounts.
export const LOGIN_IP_LIMIT = () =>
  Number(process.env.LOGIN_IP_LIMIT_PER_MIN ?? 30);

const AUTH_ROUTES = ['/auth/login', '/auth/register'];

export const accountThrottler: ThrottlerOptions = {
  name: 'account',
  ttl: 60_000,
  limit: LOGIN_LIMIT,
  skipIf: (context: ExecutionContext) =>
    !AUTH_ROUTES.includes(
      context.switchToHttp().getRequest<{ path: string }>().path,
    ),
  getTracker: (req: Record<string, unknown>) => {
    const body = (req.body ?? {}) as { phone?: unknown };
    // Every way of writing one number counts against the same account.
    const phone = toBeninPhone(body.phone) ?? String(body.phone ?? '');
    return `${String(req.ip)}:${phone}`;
  },
};
