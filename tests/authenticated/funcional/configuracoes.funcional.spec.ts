import { test, expect } from '../../fixtures/test.fixture';
import {
  closeDialog,
  expectDialogHasFormFields,
  expectDialogOpen,
  openConfigSection,
} from '../../support/interaction-helpers';
import { expectNoErrorToast } from '../../support/toast-helpers';

test.describe('Configurações — interações e modais', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[CFG-FUNC-01] perfil exibe campos editáveis', async ({ page }) => {
    await openConfigSection(page, 'Meu perfil');
    await expect(page.locator('#cfg-nome')).toBeVisible({ timeout: 15_000 });
    await expectNoErrorToast(page);
  });

  test('[CFG-FUNC-02] equipe abre modal adicionar membro', async ({ page }) => {
    await openConfigSection(page, 'Equipe e permissões');
    await page.getByRole('button', { name: /Adicionar membro/i }).click();
    const dialog = await expectDialogOpen(page, /membro|e-mail|função|papel/i);
    await expectDialogHasFormFields(dialog, 1);
    await closeDialog(page);
  });

  test('[CFG-FUNC-03] dentistas abre modal novo dentista', async ({ page }) => {
    await openConfigSection(page, 'Dentistas');
    const btn = page.getByRole('button', { name: /Novo dentista/i });
    if (!(await btn.isVisible().catch(() => false))) {
      test.skip(true, 'Botão Novo dentista indisponível para este perfil');
    }
    await btn.click();
    const dialog = await expectDialogOpen(page, /dentista|CRO|nome/i);
    await expectDialogHasFormFields(dialog, 1);
    await closeDialog(page);
  });

  test('[CFG-FUNC-04] convênios abre fluxo de novo convênio', async ({ page }) => {
    await openConfigSection(page, 'Convênios');
    const btn = page.getByRole('button', { name: /Criar convênio/i });
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await btn.click();
    await expect(
      page.getByText(/Criar convênio|Novo convênio pronto|Cadastrar convênio/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
  });

  test('[CFG-FUNC-05] assinatura carrega com billing mockado', async ({ page }) => {
    await openConfigSection(page, 'Plano e cobrança');
    await expect(
      page.getByRole('heading', { name: /Assinatura|Plano e cobrança|Plano/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/plano|assinatura|faturamento|cobrança/i).first()).toBeVisible();
  });

  test('[CFG-FUNC-06] integrações exibe painéis de conexão', async ({ page }) => {
    await openConfigSection(page, 'Integrações');
    await expect(page.getByText(/integração|conectar|gateway|whatsapp/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
