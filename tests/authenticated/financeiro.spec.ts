import { test, expect } from '../fixtures/test.fixture';
import { FINANCEIRO_SECTIONS } from '../data/routes';
import { assertFinanceiroSectionOrGated } from '../support/financeiro-helpers';

test.describe('Financeiro — painel', () => {
  test.beforeEach(async ({ appShell, financeiroPage }) => {
    await appShell.navigateTo('/financeiro');
    await appShell.dismissBlockingModals();
    await financeiroPage.waitForTransacoesReload();
  });

  test('[FIN-PAIN-01] exibe painel principal com indicadores e seções', async ({ page, financeiroPage, appShell }) => {
    await expect(page).toHaveURL(/\/financeiro/);
    await expect(page.getByText(/Painel|Visão geral do financeiro/).first()).toBeVisible();
    await expect(appShell.financeiroNav).toBeVisible();
    await financeiroPage.expectPainelIndicators();
    await financeiroPage.expectPainelSections();
  });

  test('[FIN-PAIN-03] abre formulário de novo lançamento', async ({ financeiroPage }) => {
    await financeiroPage.openNovoLancamento();
    await financeiroPage.cancelLancamentoModal();
  });

  test('[FIN-TABS-01] abas internas do financeiro estão visíveis', async ({ appShell, page }) => {
    await expect(appShell.financeiroTab('Fluxo de caixa')).toBeVisible();
    await expect(page.getByText(/Painel|Visão geral do financeiro/i).first()).toBeVisible();
  });

  for (const section of FINANCEIRO_SECTIONS) {
    test(`[FIN-TABS-01] navega para ${section.tabLabel}`, async ({ page, appShell }) => {
      if (section.tabLabel === 'Painel') {
        await expect(page).toHaveURL(/\/financeiro/);
        return;
      }

      const available = await assertFinanceiroSectionOrGated(page, section.path, section.expectPattern);
      if (!available && (section.tabLabel === 'Boletos' || section.tabLabel === 'Notas fiscais')) {
        await expect(page).toHaveURL(/\/financeiro/);
        return;
      }

      if (available) {
        await expect(page).toHaveURL(new RegExp(section.path.replace(/\//g, '\\/')));
        await expect(page.getByText(section.expectPattern).first()).toBeVisible();
      }
    });
  }
});

test.describe('Financeiro — fluxo de caixa smoke', () => {
  test.beforeEach(async ({ appShell, financeiroPage }) => {
    await appShell.navigateTo('/financeiro/fluxo-caixa');
    await appShell.dismissBlockingModals();
    await financeiroPage.waitForTransacoesReload();
  });

  test('[FIN-FLUX-01] exibe totais e seções do período', async ({ page, financeiroPage }) => {
    await expect(page).toHaveURL(/\/financeiro\/fluxo-caixa/);
    await expect(page.getByText(/Fluxo de caixa/i).first()).toBeVisible();
    await financeiroPage.expectFluxoTotals();
    await financeiroPage.expectFluxoSections();
  });

  test('[FIN-FLUX-02] exibe campo de busca de lançamentos', async ({ financeiroPage }) => {
    const search = financeiroPage.page
      .getByRole('searchbox', { name: /Buscar lançamento/i })
      .or(financeiroPage.page.locator('app-dc-search-field[inputid="fluxo-busca"] input'));
    await expect(search.first()).toBeVisible({ timeout: 15_000 });
  });

  test('[FIN-FLUX-03] abre novo lançamento no fluxo', async ({ financeiroPage }) => {
    await financeiroPage.openNovoLancamento();
    await financeiroPage.cancelLancamentoModal();
  });
});

test.describe('Financeiro — abas condicionais smoke', () => {
  test('[FIN-COM-01] comissões lista ou módulo indisponível', async ({ page, appShell }) => {
    await appShell.navigateTo('/financeiro/comissoes');
    await appShell.dismissBlockingModals();
    if (page.url().includes('/financeiro/comissoes')) {
      await expect(page.getByText(/Comiss/i).first()).toBeVisible();
      return;
    }
    expect(page.url()).not.toContain('/login');
  });

  test('[FIN-BOL-01] boletos lista ou módulo indisponível', async ({ page, appShell }) => {
    const available = await assertFinanceiroSectionOrGated(page, '/financeiro/boletos', /Boleto/i);
    if (available) {
      await expect(page.getByText(/Nenhum boleto|boletos emitidos|Boleto/i).first()).toBeVisible();
    }
  });

  test('[FIN-NF-01] notas fiscais lista ou módulo indisponível', async ({ page }) => {
    const available = await assertFinanceiroSectionOrGated(page, '/financeiro/notas-fiscais', /Notas fiscais|nota fiscal/i);
    if (available) {
      await expect(page.getByRole('table').or(page.getByText(/Nenhuma nota|notas emitidas/i))).toBeVisible();
    }
  });
});
