// Refuses a commit that carries an env file or a value shaped like a credential.
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const FORBIDDEN_NAMES = [/^\.env(\..*)?$/, /\.pem$/, /\.key$/, /^id_(rsa|ed25519)$/];
const ALLOWED_NAMES = [/^\.env\.example$/];
const PATTERNS = [
  [/postgres(?:ql)?:\/\/[^:\s/]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1|db\b|postgres\b)/, 'database URL with a password'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\brnd_[A-Za-z0-9]{20,}/, 'Render API key'],
  [/\bsb_secret_[A-Za-z0-9_-]{20,}|\beyJ[A-Za-z0-9_-]{30,}\.eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/, 'Supabase or JWT token'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'GitHub token'],
  [/VERCEL_OIDC_TOKEN\s*=\s*\S{20,}/, 'Vercel token'],
];

const problems = [];
for (const file of process.argv.slice(2)) {
  const name = basename(file);
  if (FORBIDDEN_NAMES.some((r) => r.test(name)) && !ALLOWED_NAMES.some((r) => r.test(name))) {
    problems.push(`${file}: this file must never be committed`);
    continue;
  }
  let text;
  try {
    if (statSync(file).size > 2_000_000) continue;
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const [re, label] of PATTERNS) if (re.test(text)) problems.push(`${file}: looks like a ${label}`);
}
if (problems.length) {
  console.error(`Commit refused, possible secret:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
