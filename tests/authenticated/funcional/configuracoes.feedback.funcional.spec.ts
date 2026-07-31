import { test, expect } from '../../fixtures/test.fixture';
import { CONFIG_API, CONFIG_FORM_IDS, ERROR_TOAST, VALIDATION_HINTS } from '../../data/configuracoes';
import {
  expectErrorToast,
  expectNoErrorToast,
  expectToast,
  expectValidationFeedback,
} from '../../support/toast-helpers';
import { SUCCESS_TOAST } from '../../data/configuracoes';

test.describe('Configurações — Feedback sucesso e erros', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[CFG-FB-01] perfil — submit senha vazia exibe validação', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Meu perfil');
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
    await expectValidationFeedback(page);
  });

  test('[CFG-FB-02] equipe — submit membro vazio exibe validação', async ({ configuracoesPage }) => {
    await configuracoesPage.openSection('Equipe e permissões');
    await configuracoesPage.openAdicionarMembro();
    await configuracoesPage.submitEmptyAndExpectValidation(/Salvar|Adicionar|Convidar|Enviar/i);
    await expectValidationFeedback(configuracoesPage.page);
    await configuracoesPage.cancelDialog();
  });

  test('[CFG-FB-03] cadastro — fornecedor vazio exibe validação', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Fornecedores');
    await configuracoesPage.openNovoFornecedor();
    const dialog = configuracoesPage.dialog();
    await expect(dialog.locator('#f-nome')).toBeVisible();
    // Footer do modal pode ficar fora do viewport — dispara submit nativo
    await dialog.locator('#f-nome').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const invalid = dialog.locator('[aria-invalid="true"], .ng-invalid, .p-invalid');
    const toastOrMsg = page.locator(
      '.p-toast-message-error, .p-toast-message-warn, .p-error, small.p-error, .p-toast-message'
    );
    const count = (await invalid.count()) + (await toastOrMsg.count());
    if (count === 0) {
      await configuracoesPage.clickSaveInDialog(/Salvar|Criar|Adicionar|Cadastrar/i);
      await expectValidationFeedback(page);
    } else {
      expect(count).toBeGreaterThan(0);
    }
    await expect(dialog).toBeVisible();
    await configuracoesPage.cancelDialog();
  });

  test('[CFG-FB-04] clínico — tratamento vazio exibe aviso', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Tratamentos / Procedimentos');
    const btn = page.getByRole('button', { name: /Novo tratamento|Novo procedimento|Adicionar procedimento/i }).first();
    if (!(await btn.isVisible().catch(() => false))) {
      test.skip(true, 'CTA de tratamento indisponível');
    }
    await configuracoesPage.openNovoTratamento();
    await configuracoesPage.clickSaveInDialog(/Salvar|Criar|Adicionar/i);
    const warn = page.locator('.p-toast-message-warn, .p-toast-message-error').filter({
      hasText: VALIDATION_HINTS.procedimentoNome,
    });
    const invalid = configuracoesPage.dialog().locator('[aria-invalid="true"], .ng-invalid, .p-invalid');
    await expect
      .poll(async () => (await warn.count()) + (await invalid.count()), { timeout: 8_000 })
      .toBeGreaterThan(0);
    await configuracoesPage.cancelDialog();
  });

  test('[CFG-FB-05] sala — create bem-sucedido exibe toast de sucesso', async ({
    page,
    configuracoesPage,
  }) => {
    const nome = `E2E-FB-Sala-${Date.now()}`;
    await configuracoesPage.openSection('Salas e cadeiras');
    await configuracoesPage.openNovaSala();
    await configuracoesPage.fillSala({ nome, desc: 'feedback' });
    const id = await configuracoesPage.saveSala();
    await expectToast(page, SUCCESS_TOAST, 15_000).catch(async () => {
      await expect(page.getByText(nome).first()).toBeVisible({ timeout: 15_000 });
    });
    if (id) {
      await configuracoesPage.deleteRowByText(new RegExp(nome.slice(0, 12)));
    } else {
      // tenta limpar pela UI mesmo sem id capturado
      await configuracoesPage.deleteRowByText(new RegExp(nome.slice(0, 12))).catch(() => undefined);
    }
  });

  test('[CFG-FB-06] intercept API 500 no save de perfil exibe erro', async ({ page, configuracoesPage }) => {
    await configuracoesPage.openSection('Meu perfil');
    await expect(page.locator(CONFIG_FORM_IDS.perfil.nome)).toBeVisible({ timeout: 15_000 });
    const original = await page.locator(CONFIG_FORM_IDS.perfil.nome).inputValue();

    await page.route(`**${CONFIG_API.perfil}**`, async (route) => {
      if (['PUT', 'PATCH', 'POST'].includes(route.request().method())) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ erro: 'Falha simulada E2E' }),
        });
        return;
      }
      await route.continue();
    });

    await configuracoesPage.fillPerfilNome(`${original} X`.slice(0, 80));
    await page.getByRole('button', { name: /Salvar alterações/i }).first().click();
    await expectErrorToast(page, ERROR_TOAST, 15_000).catch(async () => {
      await expect(
        page.getByText(/erro|falha|não foi possível|nao foi possivel/i).first()
      ).toBeVisible({ timeout: 10_000 });
    });

    await page.unroute(`**${CONFIG_API.perfil}**`);
    await configuracoesPage.fillPerfilNome(original);
    await expectNoErrorToast(page);
  });
});
