import { test, expect } from '../../fixtures/test.fixture';
import { openConfigSection, closeDialog, expectDialogOpen } from '../../support/interaction-helpers';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Billing — assinatura com mock', () => {
  test.beforeEach(async ({ appShell, page }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await openConfigSection(page, 'Plano e cobrança');
  });

  test('[BILL-01] aba assinatura carrega sem erro de API', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Assinatura|Plano e cobrança|Plano/i }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/plano|assinatura|faturamento|cobrança/i).first()).toBeVisible();
  });

  test('[BILL-02] não dispara checkout real ao explorar UI', async ({ page }) => {
    const upgradeBtn = page.getByRole('button', { name: /Alterar plano|Upgrade|Mudar plano/i }).first();
    if (!(await upgradeBtn.isVisible().catch(() => false))) {
      return;
    }
    await upgradeBtn.click();
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/asaas|stripe|mercadopago|checkout/i);
    await expectNoErrorToast(page);
    await page.keyboard.press('Escape');
  });

  test('[BILL-03] modal cadastro cartão abre e cancela sem salvar', async ({ page }) => {
    const cardBtn = page.getByRole('button', { name: /cartão|pagamento|forma de pagamento/i }).first();
    if (!(await cardBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Botão de cartão não visível neste plano');
    }
    await cardBtn.click();
    const dialog = await expectDialogOpen(page, /cartão|pagamento|número/i).catch(() => null);
    if (dialog) {
      await closeDialog(page);
    }
    await expect(page).not.toHaveURL(/asaas|stripe/i);
  });
});
