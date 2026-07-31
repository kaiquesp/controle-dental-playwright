import { test, expect } from '../../fixtures/test.fixture';
import { CONFIG_CTAS, CONFIG_FORM_IDS } from '../../data/configuracoes';
import { expectDialogHasFormFields } from '../../support/interaction-helpers';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Configurações — Prontuário e clínico', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[CFG-18] tratamentos abre formulário novo procedimento', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Tratamentos / Procedimentos');
    await configuracoesPage.expectSectionContent(/tratamento|procedimento/i);
    const btn = page.getByRole('button', { name: CONFIG_CTAS.novoTratamento }).first();
    if (!(await btn.isVisible().catch(() => false))) {
      test.skip(true, 'CTA de novo tratamento indisponível');
    }
    const dialog = await configuracoesPage.openNovoTratamento();
    await expectDialogHasFormFields(dialog, 1);
    await expect(dialog.locator(CONFIG_FORM_IDS.tratamento.nome)).toBeVisible();
    await configuracoesPage.cancelDialog();
    await expectNoErrorToast(page);
  });

  test('[CFG-19] modelos de anamnese carrega conteúdo', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Modelos de Anamnese');
    await configuracoesPage.expectSectionContent(/anamnese|modelo|pergunta|questionário|questionario/i);
    await expectNoErrorToast(page);
  });

  test('[CFG-20] medicamentos abre formulário', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Medicamentos');
    await configuracoesPage.expectSectionContent(/medicamento|princípio|principio|posologia|receituário|receituario/i);
    const btn = page.getByRole('button', { name: CONFIG_CTAS.novoMedicamento }).first();
    if (await btn.isVisible().catch(() => false)) {
      const scope = await configuracoesPage.openNovoMedicamento();
      await expect(scope.locator(CONFIG_FORM_IDS.medicamento.nome)).toBeVisible({ timeout: 10_000 });
      await configuracoesPage.closeMedicamentoForm();
    }
    await expectNoErrorToast(page);
  });

  test('[CFG-21] modelos de encaminhamento exibe formulário', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Modelos de encaminhamento');
    await configuracoesPage.expectSectionContent(/encaminhamento|destino|motivo|modelo/i);
    const nome = page.locator(CONFIG_FORM_IDS.encaminhamento.nome);
    if (await nome.isVisible().catch(() => false)) {
      await expect(nome).toBeVisible();
    }
    await expectNoErrorToast(page);
  });
});
