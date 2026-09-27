import { request, type FullConfig } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const API = `http://localhost:${process.env.E2E_API_PORT ?? '3000'}`;
export const STATE_DIR = join(__dirname, '.auth');

// Seeded accounts (backend/prisma/seed.ts). Producers share the public demo PIN;
// staff use SEED_STAFF_PIN, read from the environment or backend/.env, never from the repo.
export const ACCOUNTS = {
  producer: { phone: '+2290197000001', staff: false },
  buyer: { phone: '+2290196000001', staff: false },
  agent: { phone: '+2290190000002', staff: true },
  commune: { phone: '+2290190000003', staff: true },
  advisor: { phone: '+2290190000004', staff: true },
} as const;
export type Role = keyof typeof ACCOUNTS;

export function staffPin(): string {
  if (process.env.SEED_STAFF_PIN) return process.env.SEED_STAFF_PIN;
  try {
    const line = readFileSync(join(__dirname, '..', 'backend', '.env'), 'utf8')
      .split('\n')
      .find((l) => l.startsWith('SEED_STAFF_PIN='));
    if (line) return line.slice('SEED_STAFF_PIN='.length).replace(/^["']|["']$/g, '').trim();
  } catch {
    /* no local env file: CI sets the variable */
  }
  throw new Error('SEED_STAFF_PIN is required to log the staff accounts in');
}

export const pinFor = (role: Role) => (ACCOUNTS[role].staff ? staffPin() : '1234');

export default async function globalSetup(config: FullConfig) {
  const web = config.projects[0].use.baseURL as string;
  const api = await request.newContext({ baseURL: API });
  mkdirSync(STATE_DIR, { recursive: true });
  for (const role of Object.keys(ACCOUNTS) as Role[]) {
    const res = await api.post('/auth/login', { data: { phone: ACCOUNTS[role].phone, pin: pinFor(role) } });
    if (!res.ok()) throw new Error(`login ${role}: HTTP ${res.status()}`);
    const session = await res.json();
    const state = { cookies: [], origins: [{ origin: web, localStorage: [{ name: 'alerteagri:session', value: JSON.stringify(session) }] }] };
    writeFileSync(join(STATE_DIR, `${role}.json`), JSON.stringify(state));
  }
  await api.dispose();
}
