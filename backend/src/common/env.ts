// Checked once at boot: a missing secret stops the process instead of failing one request later.
const REQUIRED: Record<string, number> = {
  DATABASE_URL: 1,
  JWT_SECRET: 16,
  RECEIPT_SECRET: 16,
};

export function missingEnv(env: NodeJS.ProcessEnv): string[] {
  return Object.entries(REQUIRED)
    .filter(([name, min]) => (env[name] ?? '').length < min)
    .map(([name]) => name);
}
