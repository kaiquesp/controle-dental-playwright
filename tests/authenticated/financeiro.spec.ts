import { test, expect } from '../fixtures/test.fixture';
import { FINANCEIRO_SECTIONS } from '../data/routes';

test.describe('Financeiro', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/financeiro');
    await appShell.dismissBlockingModals();
  });

  test('[FIN-PAIN-01] exibe painel principal', async ({ page }) => {
    await expect(page).toHaveURL(/\/financeiro/);
    await expect(page.getByText(/Painel|Visão geral do financeiro/).first()).toBeVisible();
    await expect(page.locator('nav[aria-label="Seções do financeiro"], .financeiro__tabs')).toBeVisible();
    await expect(page.getByText(/Entradas do período/i)).toBeVisible();
    await expect(page.getByText(/Saídas do período/i)).toBeVisible();
  });

  test('[FIN-PAIN-03] abre formulário de novo lançamento', async ({ page }) => {
    await page.getByRole('button', { name: /Novo lançamento/i }).click();
    await expect(
      page.locator('[role="dialog"], .p-dialog, dialog').filter({ hasText: /transação|lançamento|Nova transação/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  for (const section of FINANCEIRO_SECTIONS) {
    test(`[FIN] navega para ${section.tabLabel}`, async ({ page, appShell }) => {
      if ('moduleId' in section && section.moduleId === 'comissoes') {
        const tabCount = await appShell.financeiroTab(section.tabLabel).count();
        if (tabCount === 0) {
          await appShell.navigateTo(section.path);
          await appShell.dismissBlockingModals();
          expect(page.url()).not.toContain('/login');
          return;
        }
      }

      if (section.tabLabel === 'Painel') {
        await expect(page).toHaveURL(/\/financeiro/);
        return;
      }

      await appShell.openFinanceiroSection(section.tabLabel, section.path);
      await appShell.dismissBlockingModals();

      const onExpectedPath = new RegExp(section.path.replace(/\//g, '\\/')).test(page.url());
      if (!onExpectedPath && (section.tabLabel === 'Boletos' || section.tabLabel === 'Notas fiscais')) {
        await expect(page).toHaveURL(/\/financeiro/);
        return;
      }

      await expect(page).toHaveURL(new RegExp(section.path.replace(/\//g, '\\/')));
      await expect(page.getByText(section.expectPattern).first()).toBeVisible();
    });
  }
});

test.describe('Financeiro — fluxo de caixa', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/financeiro/fluxo-caixa');
    await appShell.dismissBlockingModals();
  });

  test('[FIN-FLUX-01] exibe totais do período', async ({ page }) => {
    await expect(page).toHaveURL(/\/financeiro\/fluxo-caixa/);
    await expect(page.getByText(/Fluxo de caixa/i).first()).toBeVisible();
    await expect(page.getByText(/Saldo inicial|Entradas|Saídas/i).first()).toBeVisible();
  });

  test('[FIN-FLUX-02] exibe campo de busca de lançamentos', async ({ page }) => {
    await expect(page.getByPlaceholder(/Buscar por descrição/i).first()).toBeVisible();
  });

  test('[FIN-FLUX-03] abre novo lançamento no fluxo', async ({ page }) => {
    await page.getByRole('button', { name: /Novo lançamento/i }).click();
    await expect(
      page.locator('[role="dialog"]:visible, .p-dialog:visible, dialog:visible').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
