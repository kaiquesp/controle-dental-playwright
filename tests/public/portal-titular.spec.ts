import { test, expect } from '../fixtures/test.fixture';

test.use({ storageState: { cookies: [], origins: [] } });

const PORTAL_TABS = ['Meus Direitos', 'Dados Coletados', 'Compartilhamento', 'Segurança', 'Contato'] as const;

test.describe('Portal do titular — LGPD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/portal-titular');
  });

  test('[PUB-LGPD-01] exibe portal e abas de direitos', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Portal do Titular/i })).toBeVisible();
    for (const tab of PORTAL_TABS) {
      await expect(page.getByRole('button', { name: tab }).or(page.getByRole('tab', { name: tab })).first()).toBeVisible();
    }
  });

  for (const tab of PORTAL_TABS) {
    test(`[PUB-LGPD-01] navega para aba ${tab}`, async ({ page }) => {
      const tabButton = page.getByRole('button', { name: tab }).or(page.getByRole('tab', { name: tab })).first();
      await tabButton.click();
      await expect(page.getByText(/LGPD|dados pessoais|titular/i).first()).toBeVisible();
    });
  }
});
