import { test, expect } from '../../fixtures/test.fixture';
import { CONFIG_FORM_IDS } from '../../data/configuracoes';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Configurações — Meu perfil', () => {
  test.beforeEach(async ({ appShell, configuracoesPage }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await configuracoesPage.openSection('Meu perfil');
  });

  test('[CFG-FUNC-01] perfil exibe campos editáveis', async ({ page }) => {
    await expect(page.locator(CONFIG_FORM_IDS.perfil.nome)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(CONFIG_FORM_IDS.perfil.email)).toBeVisible();
    await expect(page.locator(CONFIG_FORM_IDS.perfil.senhaAtual)).toBeVisible();
    await expect(page.locator(CONFIG_FORM_IDS.perfil.senhaNova)).toBeVisible();
    await expect(page.locator(CONFIG_FORM_IDS.perfil.senhaConf)).toBeVisible();
    await expectNoErrorToast(page);
  });

  test('[CFG-02] altera nome e restaura valor original', async ({ page, configuracoesPage }) => {
    const nomeInput = page.locator(CONFIG_FORM_IDS.perfil.nome);
    await expect(nomeInput).toBeVisible({ timeout: 15_000 });
    const original = await nomeInput.inputValue();
    const temp = `${original} E2E`.slice(0, 80);

    await configuracoesPage.fillPerfilNome(temp);
    await configuracoesPage.savePerfilAlteracoes(true);

    await configuracoesPage.fillPerfilNome(original);
    await configuracoesPage.savePerfilAlteracoes(true);
    await expect(nomeInput).toHaveValue(original);
    await expectNoErrorToast(page);
  });

  test('[CFG-03] formulário de senha exige campos ao submeter vazio', async ({ page }) => {
    const senhaAtual = page.locator(CONFIG_FORM_IDS.perfil.senhaAtual);
    await senhaAtual.scrollIntoViewIfNeeded();
    await expect(senhaAtual).toBeVisible({ timeout: 15_000 });
    const btn = page.getByRole('button', { name: /Atualizar senha/i });
    await btn.scrollIntoViewIfNeeded();
    if (await btn.isDisabled().catch(() => false)) {
      await expect(btn).toBeDisabled();
      return;
    }
    await btn.click({ force: true });
    const invalidOrToast = page.locator(
      '[aria-invalid="true"], .p-invalid, .p-toast-message-error, .p-toast-message-warn, .p-error, .ng-invalid'
    );
    await expect(invalidOrToast.first()).toBeVisible({ timeout: 8_000 });
  });
});
