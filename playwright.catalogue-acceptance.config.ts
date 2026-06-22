import { defineConfig, devices } from '@playwright/test';

const studioUrl = process.env.AI_STUDIO_URL || 'https://oasis-ai-studio.vercel.app';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/catalogue-final-acceptance.spec.ts',
  timeout: 900_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: 'test-results/catalogue-acceptance-playwright',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/catalogue-acceptance-playwright/report.json' }],
  ],
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 45_000,
    navigationTimeout: 90_000,
    ignoreHTTPSErrors: true,
    baseURL: studioUrl,
  },
  projects: [
    {
      name: 'catalogue-acceptance',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  metadata: { studioUrl },
});
