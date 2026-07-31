import { test, expect } from '../../fixtures/test.fixture';
import { CONFIG_FORM_IDS } from '../../data/configuracoes';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Configurações — Dados da clínica', () => {
  test.beforeEach(async ({ appShell, configuracoesPage }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await configuracoesPage.openSection('Dados da clínica');
  });

  test('[CFG-04] exibe campos da clínica', async ({ page }) => {
    await expect(page.locator(CONFIG_FORM_IDS.clinica.nomeFantasia)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(CONFIG_FORM_IDS.clinica.razao)).toBeVisible();
    await expect(page.locator(CONFIG_FORM_IDS.clinica.cpfCnpj)).toBeVisible();
    await expectNoErrorToast(page);
  });

  test('[CFG-FUNC-CLINICA-01] salva e restaura complemento', async ({ page, configuracoesPage }) => {
    const campo = page.locator(CONFIG_FORM_IDS.clinica.complemento);
    await expect(campo).toBeVisible({ timeout: 15_000 });
    const original = await campo.inputValue();
    const temp = original.includes('E2E') ? original.replace(/ E2E.*$/, '') : `${original} E2E`.trim();

    await configuracoesPage.fillClinicaCampo('complemento', temp || 'E2E');
    await configuracoesPage.saveClinica(true);

    await configuracoesPage.fillClinicaCampo('complemento', original);
    await configuracoesPage.saveClinica(true);
    await expect(campo).toHaveValue(original);
    await expectNoErrorToast(page);
  });
});
