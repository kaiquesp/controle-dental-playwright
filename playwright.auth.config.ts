import dotenv from 'dotenv';
import path from 'path';
import { defineConfig, devices } from '@playwright/test';
import { e2eEnv } from './tests/support/env';

dotenv.config({ path: path.resolve(__dirname, '.env') });

/** Só login headed (reCAPTCHA manual). Preferir: `npm run test:auth:headed` */
export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  use: {
    ...devices['Desktop Chrome'],
    headless: false,
    baseURL: e2eEnv.baseUrl,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
  ],
});
