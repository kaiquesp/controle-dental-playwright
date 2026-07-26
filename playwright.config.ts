import { defineConfig, devices } from '@playwright/test';
import { AUTH_FILE } from './tests/support/auth-state';
import { e2eEnv, logE2eTarget } from './tests/support/env';

logE2eTarget();

const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT?.trim();
const connectOptions = wsEndpoint ? { wsEndpoint } : undefined;

if (connectOptions) {
  console.log(`[E2E] browser remoto: ${wsEndpoint.replace(/token=[^&]+/i, 'token=***')}`);
}

const chromeUse = {
  ...devices['Desktop Chrome'],
  ...(connectOptions ? { connectOptions } : {}),
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: e2eEnv.baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  outputDir: 'test-results',
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      timeout: 180_000,
      use: connectOptions ? { connectOptions } : {},
    },
    {
      name: 'public',
      testMatch: /public\/.+\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...chromeUse,
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'authenticated',
      testMatch: /authenticated\/.+\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...chromeUse,
        storageState: AUTH_FILE,
      },
    },
  ],
});
