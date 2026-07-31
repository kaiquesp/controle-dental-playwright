import { expect, type Page } from '@playwright/test';

export const COOKIE_BANNER_TITLE = /Cookies e privacidade/i;
export const COOKIE_ACCEPT_ALL_BUTTON = /^Aceitar todos$/i;
export const COOKIE_NECESSARY_ONLY_BUTTON = /^Apenas necessários$/i;

export function cookieConsentBanner(page: Page) {
  return page.locator('app-dc-cookie-consent-banner .dc-cookie-consent-banner, .dc-cookie-consent-banner').first();
}

export function cookieConsentTitle(page: Page) {
  return page.locator('#dc-cookie-consent-title').or(page.getByText(COOKIE_BANNER_TITLE)).first();
}

export function cookieAcceptAllButton(page: Page) {
  return cookieConsentBanner(page)
    .getByRole('button', { name: COOKIE_ACCEPT_ALL_BUTTON })
    .or(page.getByRole('button', { name: COOKIE_ACCEPT_ALL_BUTTON }));
}

export function cookieNecessaryOnlyButton(page: Page) {
  return cookieConsentBanner(page)
    .getByRole('button', { name: COOKIE_NECESSARY_ONLY_BUTTON })
    .or(page.getByRole('button', { name: COOKIE_NECESSARY_ONLY_BUTTON }));
}

export async function isCookieConsentVisible(page: Page): Promise<boolean> {
  return cookieConsentTitle(page).isVisible().catch(() => false);
}

export async function dismissCookieConsent(
  page: Page,
  choice: 'all' | 'necessary' = 'all',
  timeoutMs = 5_000
): Promise<boolean> {
  const title = cookieConsentTitle(page);
  const appeared = await title
    .waitFor({ state: 'visible', timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);

  if (!appeared) {
    return false;
  }

  const button = choice === 'all' ? cookieAcceptAllButton(page) : cookieNecessaryOnlyButton(page);
  await button.first().click();

  await title.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  return true;
}

export async function gotoPublicRoute(
  page: Page,
  path: string,
  options: Parameters<Page['goto']>[1] = {}
): Promise<void> {
  await page.goto(path, options);
  await dismissCookieConsent(page, 'all', 15_000);
}

export async function expectCookieConsentVisible(page: Page): Promise<void> {
  await expect(cookieConsentTitle(page)).toBeVisible({ timeout: 15_000 });
  await expect(cookieAcceptAllButton(page).first()).toBeVisible();
  await expect(cookieNecessaryOnlyButton(page).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Política de Privacidade/i })).toBeVisible();
}
