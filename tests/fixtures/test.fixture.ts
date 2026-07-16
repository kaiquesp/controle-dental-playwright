import { test as base, expect } from '@playwright/test';
import { AppShellPage } from '../pages/app-shell.page';
import { LoginPage } from '../pages/login.page';
import { NotFoundPage } from '../pages/not-found.page';
import { captureFailureScreenshot } from '../support/screenshot-helper';
import { installAllPaymentMocks, installAllPaymentMocksOnContext } from '../support/billing-mocks';
import { installFeatureMocks, installFeatureMocksOnContext } from '../support/feature-mocks';

type AppFixtures = {
  loginPage: LoginPage;
  appShell: AppShellPage;
  notFoundPage: NotFoundPage;
};

export const test = base.extend<AppFixtures>({
  context: async ({ context }, use) => {
    await installAllPaymentMocksOnContext(context);
    await installFeatureMocksOnContext(context);
    await use(context);
  },
  page: async ({ page }, use) => {
    await installAllPaymentMocks(page);
    await installFeatureMocks(page);
    await use(page);
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  appShell: async ({ page }, use) => {
    await use(new AppShellPage(page));
  },
  notFoundPage: async ({ page }, use) => {
    await use(new NotFoundPage(page));
  },
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await captureFailureScreenshot(page, testInfo);
  }
});

export { expect };
