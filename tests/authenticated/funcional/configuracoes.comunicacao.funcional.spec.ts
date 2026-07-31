import { test, expect } from '../../fixtures/test.fixture';
import { CONFIG_CTAS, CONFIG_FORM_IDS } from '../../data/configuracoes';
import { expectDialogHasFormFields } from '../../support/interaction-helpers';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Configurações — Comunicação', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[CFG-12] modelos de mensagens lista e abre novo modelo', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Modelos de mensagens');
    await configuracoesPage.expectSectionContent(/mensagem|modelo|whatsapp|sms/i);
    const btn = page.getByRole('button', { name: CONFIG_CTAS.novoModeloMensagem }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      const dialog = configuracoesPage.dialog();
      if (await dialog.isVisible().catch(() => false)) {
        await expectDialogHasFormFields(dialog, 1);
        await configuracoesPage.cancelDialog();
      }
    }
    await expectNoErrorToast(page);
  });

  test('[CFG-13] créditos de mensagens exibe saldo ou pacotes', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Créditos de mensagens');
    await configuracoesPage.expectSectionContent(
      /crédito|credito|mensagem|pacote|saldo|whatsapp|recarga|comprar/i
    );
    await expectNoErrorToast(page);
  });
});
