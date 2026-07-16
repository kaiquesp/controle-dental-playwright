import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { AUTH_FILE } from './support/auth-state';
import { e2eEnv, requireCredentials, logE2eTarget } from './support/env';
import { LoginPage } from './pages/login.page';
import {
  acceptPendingLegalDocuments,
  prepareSessionForE2eSave,
  waitForPostLoginDestination,
} from './support/onboarding';
import { installAllPaymentMocks, installAllPaymentMocksOnContext } from './support/billing-mocks';
import { installFeatureMocks, installFeatureMocksOnContext } from './support/feature-mocks';

setup.setTimeout(180_000);

setup('login com usuário e senha', async ({ page, context }) => {
  logE2eTarget();
  requireCredentials();
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  await installAllPaymentMocksOnContext(context);
  await installFeatureMocksOnContext(context);
  await installAllPaymentMocks(page);
  await installFeatureMocks(page);

  await context.clearCookies();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  const loginPage = new LoginPage(page);
  await expect(loginPage.title).toBeVisible({ timeout: 30_000 });
  await loginPage.fillCredentials(e2eEnv.userEmail, e2eEnv.userPassword);
  await loginPage.rememberCheckbox.check();
  await loginPage.submit();

  const hasRecaptcha = await loginPage.waitForRecaptcha();
  if (hasRecaptcha) {
    console.warn(
      'reCAPTCHA detectado — resolva manualmente no navegador (use npm run test:headed) e aguarde o redirecionamento.'
    );
  }

  // consentGuard abre o modal LGPD e mantém /login até o aceite.
  await waitForPostLoginDestination(page, 120_000);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

  // Pode reaparecer após navegação se o aceite falhou parcialmente.
  await acceptPendingLegalDocuments(page, 3_000);

  await prepareSessionForE2eSave(page);

  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  expect(
    token,
    'accessToken ausente após login — confira E2E_USER_EMAIL e E2E_USER_PASSWORD no .env'
  ).toBeTruthy();

  await context.storageState({ path: AUTH_FILE });
  console.log(`Sessão salva em ${AUTH_FILE}`);
});
