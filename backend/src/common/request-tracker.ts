import { JwtService } from '@nestjs/jwt';

// Signed-in users are counted per account: a whole village behind one operator address must not
// share a quota. Anyone else is counted per client address. A forged token only earns an address count.
export function requestTracker(req: Record<string, unknown>): string {
  const headers = (req.headers ?? {}) as Record<string, string | undefined>;
  const token = headers.authorization?.replace(/^Bearer /, '');
  if (token && process.env.JWT_SECRET) {
    try {
      const payload = new JwtService({
        secret: process.env.JWT_SECRET,
      }).verify<{
        sub?: string;
      }>(token);
      if (payload.sub) return `user:${payload.sub}`;
    } catch {
      /* invalid or expired: fall back to the address */
    }
  }
  return `ip:${String(req.ip)}`;
}
