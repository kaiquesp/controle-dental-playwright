import { test, expect } from '../fixtures/test.fixture';
import { PATIENT_FORM_TABS } from '../data/routes';
import { expectDialogOpen, expectSubmitBlocked } from '../support/interaction-helpers';

test.describe('Pacientes — listagem', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/pacientes/buscar');
    await appShell.dismissBlockingModals();
  });

  test('[PAC-LIST-01] carrega listagem de pacientes', async ({ page }) => {
    await expect(page).toHaveURL(/\/pacientes\/buscar/);
    await expect(page.getByRole('heading', { name: 'Pacientes' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('.patients-rel').first()).toBeVisible();
  });

  test('[PAC-LIST-02] busca por termo inexistente', async ({ page }) => {
    const searchField = page.getByPlaceholder('Buscar por nome, CPF ou telefone');
    await searchField.fill('zzz-paciente-inexistente-e2e');
    await page.waitForTimeout(800);
    await expect(page.locator('.patients-rel, .patients-empty, [class*="patients"]').first()).toBeVisible();
  });

  test('[PAC-LIST-06] navega para novo paciente pelo botão', async ({ page }) => {
    const novoPaciente = page.getByRole('button', { name: /Novo paciente/i });
    await expect(novoPaciente.first()).toBeVisible({ timeout: 15_000 });
    await novoPaciente.first().click();
    await expectDialogOpen(page, /Cadastrar informações do paciente|Criar|Informações Pessoais/i);
    await expect(page.locator('#np-nome, [inputid="np-nome"]').first()).toBeVisible();
  });

  test('[PAC-LIST-07] exibe atalho de aniversariantes', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Aniversariantes/i })).toBeVisible();
  });

  test('[PAC-LIST-08] exibe atalho de retornos semestrais', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Retornos semestrais/i })).toBeVisible();
  });

  test('[PAC-LIST-09] exibe atalho em débito', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Em débito/i })).toBeVisible();
  });
});

test.describe('Pacientes — novo cadastro', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/pacientes/novo');
    await appShell.dismissBlockingModals();
  });

  test('[PAC-NOVO-01] exibe formulário de novo paciente', async ({ page }) => {
    await expect(page).toHaveURL(/\/pacientes\/novo/);
    await expect(page.locator('app-paciente-form-content, app-paciente-form-layout').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Informações Pessoais/i)).toBeVisible();
    await expect(page.getByText(/Contato/i)).toBeVisible();
  });

  test('[PAC-NOVO-03] impede salvar sem campos obrigatórios', async ({ page }) => {
    await expectSubmitBlocked(page, /Salvar Paciente/i);
    await expect(page).toHaveURL(/\/pacientes\/novo/);
  });

  test('[PAC-NOVO-06] cancelar retorna à listagem', async ({ page }) => {
    await page.getByRole('button', { name: /Cancelar/i }).click();
    await expect(page).toHaveURL(/\/pacientes/);
  });
});

test.describe('Pacientes — abas do prontuário', () => {
  test('[PAC-PRONT] rotas de abas estão mapeadas', async () => {
    expect(PATIENT_FORM_TABS).toEqual([
      'informacoes',
      'plano-ficha',
      'orcamentos',
      'tratamentos',
      'arquivos',
      'anamneses',
      'receituario',
      'documentos',
      'pagamentos',
    ]);
  });
});
