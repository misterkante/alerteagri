import { defineConfig, devices } from '@playwright/test';

// Browser tests run against the production build of the web app (vite preview, PWA included)
// and the real API on a seeded PostgreSQL. CI provides the database; locally, docker on 5437.
// Another project may already listen on 3000: E2E_API_PORT moves the API elsewhere.
const API_PORT = process.env.E2E_API_PORT ?? '3000';
const API = `http://localhost:${API_PORT}`;
const WEB = 'http://localhost:4173';
const CI = !!process.env.CI;
// A system Chromium can stand in for the bundled one on machines where it cannot be downloaded.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

const mobile = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1280, height: 800 } };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: WEB,
    locale: 'fr-FR',
    timezoneId: 'Africa/Porto-Novo',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'mobile-light', use: { ...devices['Desktop Chrome'], ...mobile, colorScheme: 'light' } },
    { name: 'mobile-dark', use: { ...devices['Desktop Chrome'], ...mobile, colorScheme: 'dark' }, testMatch: /a11y\.spec/ },
    { name: 'desktop-light', use: { ...devices['Desktop Chrome'], ...desktop, colorScheme: 'light' } },
    { name: 'desktop-dark', use: { ...devices['Desktop Chrome'], ...desktop, colorScheme: 'dark' }, testMatch: /a11y\.spec/ },
  ],
  webServer: [
    {
      // Run from backend/ so its .env is the one loaded, exactly as in production.
      command: 'npm run -s build && node dist/src/main',
      cwd: 'backend',
      url: `${API}/health`,
      reuseExistingServer: !CI,
      timeout: 180_000,
      env: {
        PORT: API_PORT,
        CORS_ORIGINS: WEB,
        // One login per role in global setup, but the suite runs four projects.
        LOGIN_LIMIT_PER_MIN: '100',
        RATE_LIMIT_PER_MIN: '10000',
        // The USSD demo phone is part of what is shown; production enables it the same way.
        DEMO_MODE: 'true',
      },
    },
    {
      command: 'npm run -s build && npm run -s preview -- --port 4173 --strictPort',
      cwd: 'frontend',
      url: WEB,
      reuseExistingServer: !CI,
      timeout: 180_000,
      env: { VITE_API_URL: API },
    },
  ],
});
