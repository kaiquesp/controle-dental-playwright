import { test, expect } from '../../fixtures/test.fixture';
import {
  closeDialog,
  expectDialogHasFormFields,
  expectDialogOpen,
} from '../../support/interaction-helpers';
import { FINANCEIRO_FORM_IDS } from '../../data/financeiro';

test.describe('Financeiro — interações do painel', () => {
  test.beforeEach(async ({ appShell, financeiroPage }) => {
    await appShell.navigateTo('/financeiro');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await financeiroPage.waitForTransacoesReload();
  });

  test('[FIN-PAIN-02] seletor de período está visível e interativo', async ({ page, financeiroPage }) => {
    await financeiroPage.openPeriodSelector('painel');
    await expect(page.getByText(/Entradas do período/i)).toBeVisible();
  });

  test('[FIN-PAIN-03] modal novo lançamento exibe campos e cancela', async ({ financeiroPage, page }) => {
    await financeiroPage.openNovoLancamento();
    const dialog = financeiroPage.lancamentoDialog();
    await expect(page.locator(FINANCEIRO_FORM_IDS.valor)).toBeVisible();
    await expect(page.locator(FINANCEIRO_FORM_IDS.descricao)).toBeVisible();
    await expectDialogHasFormFields(dialog, 2);
    await closeDialog(page);
  });

  test('[FIN-PAIN-04] link fluxo de caixa redireciona', async ({ page, financeiroPage }) => {
    const link = page.getByRole('link', { name: /Fluxo de caixa/i }).first();
    await link.click();
    await expect(page).toHaveURL(/\/financeiro\/fluxo-caixa/);
    await financeiroPage.expectFluxoTotals();
  });
});

test.describe('Financeiro — fluxo de caixa interações', () => {
  test.beforeEach(async ({ appShell, financeiroPage }) => {
    await appShell.navigateTo('/financeiro/fluxo-caixa');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await financeiroPage.waitForTransacoesReload();
  });

  test('[FIN-FLUX-02] busca por descrição filtra sem erro', async ({ page, financeiroPage }) => {
    await financeiroPage.searchLancamentos('consulta');
    await expect(page).toHaveURL(/\/financeiro\/fluxo-caixa/);
    await expect(page.getByText(/Fluxo de caixa/i).first()).toBeVisible();
  });

  test('[FIN-FLUX-03] novo lançamento abre modal com formulário', async ({ page, financeiroPage }) => {
    await financeiroPage.openNovoLancamento();
    const dialog = await expectDialogOpen(page);
    await expectDialogHasFormFields(dialog, 1);
    await closeDialog(page);
  });
});
