// Staged files only: formatting is applied, then lint must pass with zero warnings.
// Each app keeps its own tooling, so the binaries are called from its node_modules.
const q = (files) => files.map((f) => JSON.stringify(f)).join(' ');

export default {
  'backend/**/*.ts': (files) => [
    `backend/node_modules/.bin/prettier --write ${q(files)}`,
    `backend/node_modules/.bin/eslint --max-warnings 0 ${q(files)}`,
  ],
  'frontend/**/*.{js,jsx}': (files) => [
    `frontend/node_modules/.bin/prettier --write ${q(files)}`,
    `frontend/node_modules/.bin/eslint --config frontend/eslint.config.js --max-warnings 0 ${q(files)}`,
  ],
  'frontend/src/**/*.css': (files) => `frontend/node_modules/.bin/prettier --write ${q(files)}`,
  // A secret must never reach history, whatever its file name.
  '*': (files) => `node scripts/check-secrets.mjs ${q(files)}`,
};
