import { test, expect } from '../../fixtures/test.fixture';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Configurações — Modelos de contrato', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/configuracoes/modelos-contrato');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[CFG-16] carrega listagem de modelos de contrato', async ({ page }) => {
    await expect(page).toHaveURL(/\/configuracoes\/modelos-contrato/);
    await expect(page.getByRole('heading', { name: /Modelos de contrato/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expectNoErrorToast(page);
  });

  test('[CFG-FUNC-CONTRATO-01] CTA de novo modelo ou atualizar lista', async ({ page }) => {
    const novo = page.getByRole('button', { name: /Novo modelo|Criar modelo|Novo contrato/i }).first();
    const atualizar = page.getByRole('button', { name: /Atualizar lista/i }).first();
    if (await novo.isVisible().catch(() => false)) {
      await novo.click();
      await expect(page.getByText(/modelo|contrato|editor|nome/i).first()).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press('Escape');
      if (page.url().includes('/novo')) {
        await page.goto('/configuracoes/modelos-contrato', { waitUntil: 'domcontentloaded' });
      }
    } else {
      await expect(atualizar).toBeVisible({ timeout: 15_000 });
    }
    await expectNoErrorToast(page);
  });
});
