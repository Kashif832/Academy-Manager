import { defineConfig, devices } from '@playwright/test'

// Browser E2E for critical flows. Runs against a PRODUCTION build + real
// PostgreSQL (start Postgres with `npm run db:pg:start`, seed with
// `npm run prisma:seed && npm run seed:super-admin`). The webServer block boots
// `npm run start` (needs a prior `npm run build`) and reuses an already-running
// server locally.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
