import { JwtService } from '@nestjs/jwt';
import { requestTracker } from './request-tracker';

describe('rate limit key', () => {
  const secret = 'test-secret-for-tracker-0123456789';
  beforeAll(() => (process.env.JWT_SECRET = secret));
  const token = (sub: string, key = secret) =>
    new JwtService({ secret: key }).sign({ sub });

  it('counts a signed-in user by account, whatever the address', () => {
    expect(
      requestTracker({
        ip: '1.1.1.1',
        headers: { authorization: `Bearer ${token('u1')}` },
      }),
    ).toBe('user:u1');
    expect(
      requestTracker({
        ip: '2.2.2.2',
        headers: { authorization: `Bearer ${token('u1')}` },
      }),
    ).toBe('user:u1');
  });

  it('counts by address without a token, or with a forged one', () => {
    expect(requestTracker({ ip: '1.1.1.1', headers: {} })).toBe('ip:1.1.1.1');
    expect(
      requestTracker({
        ip: '1.1.1.1',
        headers: {
          authorization: `Bearer ${token('admin', 'another-secret-0123456789')}`,
        },
      }),
    ).toBe('ip:1.1.1.1');
  });
});
