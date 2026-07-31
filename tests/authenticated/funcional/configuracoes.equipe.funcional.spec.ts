import { test, expect } from '../../fixtures/test.fixture';
import { CONFIG_FORM_IDS } from '../../data/configuracoes';
import { expectDialogHasFormFields } from '../../support/interaction-helpers';
import { expectNoErrorToast, expectValidationFeedback } from '../../support/toast-helpers';

test.describe('Configurações — Equipe e permissões', () => {
  test.beforeEach(async ({ appShell, configuracoesPage }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await configuracoesPage.openSection('Equipe e permissões');
  });

  test('[CFG-05] lista equipe e abre modal adicionar membro', async ({ page, configuracoesPage }) => {
    await expect(page.getByRole('button', { name: /Adicionar membro/i })).toBeVisible({ timeout: 15_000 });
    const dialog = await configuracoesPage.openAdicionarMembro();
    await expectDialogHasFormFields(dialog, 2);
    await expect(dialog.locator(CONFIG_FORM_IDS.equipe.nome)).toBeVisible();
    await expect(dialog.locator(CONFIG_FORM_IDS.equipe.email)).toBeVisible();
    await configuracoesPage.cancelDialog();
    await expectNoErrorToast(page);
  });

  test('[CFG-FUNC-EQUIPE-01] submit vazio exibe validação', async ({ configuracoesPage }) => {
    await configuracoesPage.openAdicionarMembro();
    await configuracoesPage.submitEmptyAndExpectValidation(/Salvar|Adicionar|Convidar|Enviar/i);
    await expectValidationFeedback(configuracoesPage.page);
    await configuracoesPage.cancelDialog();
  });
});
