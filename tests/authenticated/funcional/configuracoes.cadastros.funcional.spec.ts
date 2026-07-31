import { test, expect } from '../../fixtures/test.fixture';
import { CONFIG_CTAS, CONFIG_FORM_IDS } from '../../data/configuracoes';
import { expectDialogHasFormFields } from '../../support/interaction-helpers';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Configurações — Cadastros da clínica', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[CFG-07] dentistas abre modal novo dentista', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Dentistas');
    const btn = page.getByRole('button', { name: CONFIG_CTAS.novoDentista });
    if (!(await btn.isVisible().catch(() => false))) {
      test.skip(true, 'Botão Novo dentista indisponível para este perfil');
    }
    const dialog = await configuracoesPage.openNovoDentista();
    await expectDialogHasFormFields(dialog, 1);
    await expect(dialog.locator(CONFIG_FORM_IDS.dentista.nome)).toBeVisible();
    await configuracoesPage.cancelDialog();
    await expectNoErrorToast(page);
  });

  test('[CFG-08] convênios abre fluxo de criar convênio', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Convênios');
    const btn = page.getByRole('button', { name: CONFIG_CTAS.criarConvenio });
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await btn.click();
    await expect(
      page.getByText(/Criar convênio|Novo convênio|Cadastrar convênio/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expectNoErrorToast(page);
  });

  test('[CFG-09] fornecedores abre modal novo fornecedor', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Fornecedores');
    const dialog = await configuracoesPage.openNovoFornecedor();
    await expectDialogHasFormFields(dialog, 1);
    await expect(dialog.locator(CONFIG_FORM_IDS.fornecedor.nome)).toBeVisible();
    await configuracoesPage.cancelDialog();
    await expectNoErrorToast(page);
  });

  test('[CFG-10] salas e cadeiras abre modal nova sala', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Salas e cadeiras');
    const dialog = await configuracoesPage.openNovaSala();
    await expectDialogHasFormFields(dialog, 1);
    await expect(dialog.locator(CONFIG_FORM_IDS.sala.nome)).toBeVisible();
    await configuracoesPage.cancelDialog();
    await expectNoErrorToast(page);
  });

  test('[CFG-11] formas de pagamento exibe switches', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Formas de Pagamento');
    await expect(
      page.locator('#switch-pix, #switch-dinheiro, #switch-cartao-credito').first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/pix|boleto|dinheiro|cartão|cartao/i).first()).toBeVisible();
    await expectNoErrorToast(page);
  });
});
