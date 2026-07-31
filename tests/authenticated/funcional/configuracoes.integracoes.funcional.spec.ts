import { test, expect } from '../../fixtures/test.fixture';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Configurações — Integrações', () => {
  test.beforeEach(async ({ appShell, configuracoesPage }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await configuracoesPage.openSection('Integrações');
  });

  test('[CFG-14] exibe painéis de integração', async ({ page }) => {
    await expect(page.getByText(/integração|conectar|gateway|whatsapp|stripe|google/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expectNoErrorToast(page);
  });

  test('[CFG-FUNC-INT-01] plano e cobrança carrega sem erro', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Plano e cobrança');
    await expect(
      page.getByRole('heading', { name: /Assinatura|Plano e cobrança|Plano/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/plano|assinatura|faturamento|cobrança/i).first()).toBeVisible();
    await expectNoErrorToast(page);
  });
});

test.describe('Configurações — Comissões profissionais', () => {
  test('[CFG-17] carrega comissões ou redireciona por plano', async ({ page, appShell }) => {
    await appShell.navigateTo('/configuracoes/comissoes-profissionais');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    expect(page.url()).not.toContain('/login');
    if (page.url().includes('/comissoes-profissionais')) {
      await expect(page.getByText(/comiss/i).first()).toBeVisible({ timeout: 20_000 });
    }
    await expectNoErrorToast(page);
  });
});
