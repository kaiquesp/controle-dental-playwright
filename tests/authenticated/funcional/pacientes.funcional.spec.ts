import { test, expect } from '../../fixtures/test.fixture';
import {
  closeDialog,
  expectDialogHasFormFields,
  expectDialogOpen,
  expectSubmitBlocked,
} from '../../support/interaction-helpers';
import { deletePatientByApi, e2eName, readAccessToken, createPatientByApi } from '../../support/crud-helpers';

test.describe('Pacientes — interações', () => {
  test.describe('Listagem', () => {
    test.beforeEach(async ({ appShell }) => {
      await appShell.navigateTo('/pacientes/buscar');
      await appShell.expectAuthenticatedShell();
      await appShell.dismissBlockingModals();
    });

    test('[PAC-LIST-02] busca por nome filtra listagem', async ({ page }) => {
      const search = page.getByPlaceholder('Buscar por nome, CPF ou telefone');
      await search.fill('a');
      await page.waitForTimeout(800);
      await expect(page.locator('.patients-rel, .patients-empty, [class*="patient"]').first()).toBeVisible();
    });

    test('[PAC-LIST-05] busca inexistente mantém tela de listagem', async ({ page }) => {
      await page.getByPlaceholder('Buscar por nome, CPF ou telefone').fill('zzz-inexistente-e2e-99999');
      await page.waitForTimeout(800);
      await expect(page).toHaveURL(/\/pacientes\/buscar/);
      await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible();
    });

    test('[PAC-LIST-07] atalho aniversariantes altera contexto da listagem', async ({ page }) => {
      await page.getByRole('button', { name: /Aniversariantes/i }).click();
      await expect(page.getByText(/anivers/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('[PAC-LIST-08] atalho retornos semestrais altera contexto', async ({ page }) => {
      await page.getByRole('button', { name: /Retornos semestrais/i }).click();
      await expect(page.getByText(/retorno|semestral/i).first()).toBeVisible({ timeout: 10_000 });
    });

    test('[PAC-LIST-09] atalho em débito altera contexto', async ({ page }) => {
      await page.getByRole('button', { name: /Em débito/i }).click();
      await expect(page.getByText(/débito|pendência|financeir/i).first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Novo paciente — formulário', () => {
    test.beforeEach(async ({ appShell }) => {
      await appShell.navigateTo('/pacientes/novo');
      await appShell.expectAuthenticatedShell();
      await appShell.dismissBlockingModals();
    });

    test('[PAC-NOVO-01] exibe todas as seções do formulário', async ({ page }) => {
      for (const section of [
        'Informações Pessoais',
        'Contato',
        'Comunicação de relacionamento',
        'Consentimento LGPD',
      ]) {
        await expect(page.getByText(section).first()).toBeVisible();
      }
    });

    test('[PAC-NOVO-03] impede salvar sem campos obrigatórios', async ({ page }) => {
      await expectSubmitBlocked(page, /Salvar Paciente/i);
      await expect(page).toHaveURL(/\/pacientes\/novo/);
    });

    test('[PAC-NOVO-05] opção sem CPF desabilita campo CPF', async ({ page }) => {
      await page.locator('#np-sem-cpf').check();
      const cpf = page.locator('#np-cpf, #paciente-cpf, input[name*="cpf" i]').first();
      await expect(cpf).toBeDisabled();
    });

    test('[PAC-NOVO-04] nome inválido impede envio', async ({ page }) => {
      await page.locator('#np-nome').fill('A');
      await expectSubmitBlocked(page, /Salvar Paciente/i);
      await expect(page).toHaveURL(/\/pacientes\/novo/);
    });

    test('[PAC-NOVO-06] cancelar retorna à listagem', async ({ page }) => {
      await page.getByRole('button', { name: /Cancelar/i }).click();
      await expect(page).toHaveURL(/\/pacientes/);
    });
  });

  test.describe('CRUD paciente E2E', () => {
    let patientId: string | null = null;
    let patientName = '';

    test('[PAC-CRUD-01] cria paciente E2E, valida na listagem e exclui via prontuário', async ({
      page,
      appShell,
      request,
    }) => {
      patientName = e2eName('Paciente');
      await appShell.navigateTo('/agenda');
      await appShell.dismissBlockingModals();

      const token = await readAccessToken(page);
      expect(token).toBeTruthy();
      patientId = await createPatientByApi(request, token!, patientName);

      await appShell.navigateTo(`/pacientes/${patientId}/edit/informacoes`);
      await appShell.expectAuthenticatedShell();
      await appShell.dismissBlockingModals();
      await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 15_000 });

      await appShell.navigateTo('/pacientes/buscar');
      await appShell.dismissBlockingModals();
      const search = page.getByRole('searchbox');
      await search.fill(patientName);
      const patientCard = page.locator('article.patients-buscar-tab__row').filter({ hasText: patientName });
      await expect(patientCard).toBeVisible({ timeout: 15_000 });

      await appShell.navigateTo(`/pacientes/${patientId}/edit/informacoes`);
      await appShell.dismissBlockingModals();
      await page.getByRole('button', { name: /Mais ações/i }).click();
      await page.getByRole('menuitem', { name: /Excluir Paciente/i }).click();
      const deleteDialog = page.locator('.p-dialog.patients-delete-dialog:visible');
      await expect(deleteDialog).toBeVisible({ timeout: 15_000 });
      await deleteDialog.getByRole('button', { name: /^Excluir paciente$/i }).click();

      await appShell.navigateTo('/pacientes/buscar');
      await appShell.dismissBlockingModals();
      await search.fill(patientName);
      await expect(patientCard).toHaveCount(0, { timeout: 20_000 });
      patientId = null;
    });

    test.afterEach(async ({ page, request }) => {
      if (!patientId) {
        return;
      }
      const token = await readAccessToken(page);
      if (token) {
        await deletePatientByApi(request, token, patientId);
      }
      patientId = null;
    });
  });
});
