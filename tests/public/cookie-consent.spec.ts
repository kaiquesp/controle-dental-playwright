import { test, expect } from '../fixtures/test.fixture';
import {
  cookieConsentTitle,
  dismissCookieConsent,
  expectCookieConsentVisible,
} from '../support/cookie-consent';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Banner de cookies', () => {
  test('[PUB-COOKIE-01] exibe banner na tela de login', async ({ page }) => {
    await page.goto('/login');
    await expectCookieConsentVisible(page);
    await expect(page.getByText(/cookies necessários para login/i)).toBeVisible();
  });

  test('[PUB-COOKIE-02] aceitar todos oculta o banner', async ({ page }) => {
    await page.goto('/login');
    await expectCookieConsentVisible(page);

    const accepted = await dismissCookieConsent(page, 'all');
    expect(accepted).toBe(true);
    await expect(cookieConsentTitle(page)).toBeHidden();
  });

  test('[PUB-COOKIE-03] apenas necessários oculta o banner', async ({ page }) => {
    await page.goto('/login');
    await expectCookieConsentVisible(page);

    const accepted = await dismissCookieConsent(page, 'necessary');
    expect(accepted).toBe(true);
    await expect(cookieConsentTitle(page)).toBeHidden();
  });

  test('[PUB-COOKIE-04] link da política de privacidade abre a página legal', async ({ page, context }) => {
    await page.goto('/login');
    await expectCookieConsentVisible(page);

    const policyLink = page.getByRole('link', { name: /Política de Privacidade/i });
    const popupPromise = context.waitForEvent('page', { timeout: 5_000 }).catch(() => null);

    await policyLink.click();

    const popup = await popupPromise;
    const target = popup ?? page;
    await expect(target).toHaveURL(/\/politica-de-privacidade/, { timeout: 15_000 });
    await expect(target.getByText(/privacidade|Política/i).first()).toBeVisible({ timeout: 15_000 });

    if (popup) {
      await popup.close();
    }
  });

  test('[PUB-COOKIE-05] banner não reaparece após aceite na mesma sessão', async ({ page }) => {
    await page.goto('/login');
    await dismissCookieConsent(page, 'all');

    await page.goto('/recuperar-senha');
    await expect(cookieConsentTitle(page)).toBeHidden();

    await page.goto('/registro');
    await expect(cookieConsentTitle(page)).toBeHidden();
  });
});
