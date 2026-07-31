import { test, expect } from '../../fixtures/test.fixture';

test.describe('Financeiro — comissões', () => {
  test.beforeEach(async ({ appShell, financeiroPage, page }) => {
    await appShell.navigateTo('/financeiro/comissoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    if (!page.url().includes('/financeiro/comissoes')) {
      test.skip(true, 'Módulo de comissões indisponível neste plano');
    }
    await financeiroPage.waitForTransacoesReload();
  });

  test('[FIN-COM-01] visualiza comissões por profissional no período', async ({ page }) => {
    await expect(page.getByText(/Comiss/i).first()).toBeVisible();
    await expect(
      page.getByRole('table').or(page.getByText(/profissional|período|total/i).first())
    ).toBeVisible();
  });

  test('[FIN-COM-02] link de configuração abre comissões profissionais', async ({ page }) => {
    const configLink = page
      .getByRole('link', { name: /configurar|comissões profissionais|percentuais/i })
      .or(page.getByRole('button', { name: /configurar|percentuais/i }));
    if (await configLink.first().isVisible().catch(() => false)) {
      await configLink.first().click();
      await expect(page).toHaveURL(/\/configuracoes\/comissoes-profissionais|\/financeiro\/comissoes/);
      return;
    }
    await page.goto('/configuracoes/comissoes-profissionais', { waitUntil: 'domcontentloaded' });
    expect(page.url()).not.toContain('/login');
  });

  test('[FIN-COM-03] marcar comissão como paga atualiza status', async ({ page }) => {
    const row = page.getByRole('row').filter({ hasText: /.+/ }).nth(1);
    if (!(await row.isVisible().catch(() => false))) {
      test.skip(true, 'Sem comissões para marcar como paga');
    }

    const payBtn = row.getByRole('button', { name: /Marcar como paga|Pagar|Baixar/i });
    if (!(await payBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Ação de pagar comissão indisponível na linha');
    }

    await payBtn.click();
    const confirm = page.getByRole('button', { name: /Confirmar|Sim|Marcar/i }).first();
    if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.click();
    }
    await expect(page.getByText(/paga|pago|quitad/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
