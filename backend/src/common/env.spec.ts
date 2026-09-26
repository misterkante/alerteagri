import { missingEnv } from './env';

describe('startup configuration', () => {
  it('lists every missing or too short secret, and nothing when all are set', () => {
    expect(missingEnv({})).toStrictEqual([
      'DATABASE_URL',
      'JWT_SECRET',
      'RECEIPT_SECRET',
    ]);
    expect(
      missingEnv({
        DATABASE_URL: 'postgresql://x',
        JWT_SECRET: 'short',
        RECEIPT_SECRET: '0123456789abcdef',
      }),
    ).toStrictEqual(['JWT_SECRET']);
    expect(
      missingEnv({
        DATABASE_URL: 'postgresql://x',
        JWT_SECRET: '0123456789abcdef',
        RECEIPT_SECRET: '0123456789abcdef',
      }),
    ).toStrictEqual([]);
  });
});
