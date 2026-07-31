import { expect, type Page } from '@playwright/test';

export async function expectToast(page: Page, pattern: RegExp, timeout = 10_000): Promise<void> {
  const toast = page.locator('.p-toast-message, .p-toast .p-toast-message-content').filter({ hasText: pattern });
  await expect(toast.first()).toBeVisible({ timeout });
}

export async function expectNoErrorToast(page: Page): Promise<void> {
  const errorToast = page.locator('.p-toast-message-error, .p-toast .p-toast-message-error');
  await expect(errorToast).toHaveCount(0);
}

export async function expectErrorToast(page: Page, pattern?: RegExp, timeout = 10_000): Promise<void> {
  const errorToast = page.locator(
    '.p-toast-message-error, .p-toast-message-warn, .p-toast .p-toast-message-error, .p-toast .p-toast-message-warn'
  );
  if (pattern) {
    await expect(errorToast.filter({ hasText: pattern }).first()).toBeVisible({ timeout });
    return;
  }
  await expect(errorToast.first()).toBeVisible({ timeout });
}

export async function expectValidationFeedback(page: Page, timeout = 8_000): Promise<void> {
  const signals = page.locator(
    [
      '.p-toast-message-error',
      '.p-toast-message-warn',
      '.p-error',
      'small.p-error',
      '[aria-invalid="true"]',
      '.p-invalid',
      '.ng-invalid.ng-touched',
    ].join(', ')
  );
  await expect(signals.first()).toBeVisible({ timeout });
}
