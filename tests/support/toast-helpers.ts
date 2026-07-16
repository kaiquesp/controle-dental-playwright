import { expect, type Page } from '@playwright/test';

export async function expectToast(page: Page, pattern: RegExp, timeout = 10_000): Promise<void> {
  const toast = page.locator('.p-toast-message, .p-toast .p-toast-message-content').filter({ hasText: pattern });
  await expect(toast.first()).toBeVisible({ timeout });
}

export async function expectNoErrorToast(page: Page): Promise<void> {
  const errorToast = page.locator('.p-toast-message-error, .p-toast .p-toast-message-error');
  await expect(errorToast).toHaveCount(0);
}
