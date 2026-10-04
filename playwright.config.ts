// Playwright config for the E2E journey in tests/e2e/.
//
// The suite is OPT-IN: it skips itself unless E2E_BASE_URL is set (see the
// spec), because it needs a running app + a real Postgres + a signed-in owner
// account — it drives the actual UI, it does not mock the REST API.
//
//   E2E_BASE_URL=http://localhost:3000 \
//   E2E_OWNER_EMAIL=... E2E_OWNER_PASSWORD=... \
//   npm run test:e2e
//
// No `webServer` block on purpose: starting Next.js here would also need a
// migrated database, which this config cannot assume. Bring your own app.
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  // The journey is one long user flow; keep it on one worker so the fixture
  // customer it creates is not raced by a sibling run.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // Nothing to report until someone runs it with a harness; keep the output out
  // of git regardless (see .gitignore).
  outputDir: 'test-results',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
