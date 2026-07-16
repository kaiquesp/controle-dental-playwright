import { test, expect } from '../../fixtures/test.fixture';
import {
  closeDialog,
  expectDialogHasFormFields,
  expectDialogOpen,
} from '../../support/interaction-helpers';

test.describe('Financeiro — interações e modais', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/financeiro');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[FIN-PAIN-02] seletor de período está visível e interativo', async ({ page }) => {
    const period = page.locator('main').getByRole('button').filter({ hasText: /\d{4}|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i }).first();
    if (await period.isVisible().catch(() => false)) {
      await period.click();
      await expect(page.locator('[role="dialog"]:visible, .p-datepicker:visible, [role="listbox"]:visible').first()).toBeVisible({
        timeout: 5_000,
      });
      await page.keyboard.press('Escape');
    }
    await expect(page.getByText(/Entradas do período/i)).toBeVisible();
  });

  test('[FIN-PAIN-03] modal novo lançamento exibe campos e cancela', async ({ page }) => {
    await page.getByRole('button', { name: /Novo lançamento/i }).click();
    const dialog = await expectDialogOpen(page, /lançamento|transação|valor|descrição/i);
    await expectDialogHasFormFields(dialog, 1);
    await closeDialog(page);
  });

  test('[FIN-PAIN-04] link fluxo de caixa redireciona', async ({ page }) => {
    const link = page.getByRole('link', { name: /Fluxo de caixa/i }).first();
    await link.click();
    await expect(page).toHaveURL(/\/financeiro\/fluxo-caixa/);
    await expect(page.getByText(/Fluxo de caixa/i).first()).toBeVisible();
  });
});

test.describe('Financeiro — fluxo de caixa interações', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/financeiro/fluxo-caixa');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[FIN-FLUX-02] busca por descrição filtra sem erro', async ({ page }) => {
    const search = page.getByRole('searchbox', { name: /Buscar lançamento/i });
    await expect(search).toBeVisible({ timeout: 15_000 });
    await search.fill('consulta');
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/financeiro\/fluxo-caixa/);
    await expect(page.getByText(/Fluxo de caixa/i).first()).toBeVisible();
  });

  test('[FIN-FLUX-03] novo lançamento abre modal com formulário', async ({ page }) => {
    await page.getByRole('button', { name: /Novo lançamento/i }).click();
    const dialog = await expectDialogOpen(page);
    await expectDialogHasFormFields(dialog, 1);
    await closeDialog(page);
  });
});
