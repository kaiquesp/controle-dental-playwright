import { test, expect } from '../../fixtures/test.fixture';
import { closeDialog } from '../../support/interaction-helpers';
import { createE2ePatientByApi, createE2ePatientWithRequest, deleteE2ePatient, deleteE2ePatientWithPage } from '../../support/pacientes-helpers';
import { e2eName, readAccessToken } from '../../support/crud-helpers';

test.describe('Pacientes — listagem funcional', () => {
  test.beforeEach(async ({ appShell, pacientesListPage }) => {
    await pacientesListPage.goTo();
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[PAC-LIST-MAP-01] mapeamento da tela de listagem', async ({ pacientesListPage }) => {
    await pacientesListPage.expectScreenMap();
  });

  test('[PAC-LIST-12] cadastra novo paciente pela UI', async ({ appShell, pacienteFormPage, pacientesListPage, page }) => {
    test.setTimeout(120_000);
    const name = e2eName('Listagem-Novo');
    await appShell.navigateTo('/pacientes/novo');
    await appShell.dismissBlockingModals();
    const id = await pacienteFormPage.createPatient(name, { skipNavigation: true });
    await pacientesListPage.goTo();
    await pacientesListPage.search(name);
    await expect(pacientesListPage.patientRow(name)).toBeVisible({ timeout: 20_000 });
    await page.goto(`/pacientes/${id}/edit/informacoes`);
    await pacienteFormPage.deleteFromProntuario();
  });

  test('[PAC-LIST-13] pesquisa paciente por nome', async ({ pacientesListPage, browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Listagem-Busca');
    try {
      await pacientesListPage.search(patient.name);
      await expect(pacientesListPage.patientRow(patient.name)).toBeVisible({ timeout: 20_000 });
    } finally {
      await deleteE2ePatient(browser, patient.id);
    }
  });

  test('[PAC-LIST-16] filtro de status altera listagem', async ({ pacientesListPage, page }) => {
    await pacientesListPage.openFilterDropdown(0);
    const options = page.getByRole('option');
    if ((await options.count()) === 0) {
      test.skip(true, 'Filtro de status indisponível nesta conta');
    }
    await options.first().click();
    await expect(page.locator('.patients-rel, .patients-empty, .patients-buscar-tab').first()).toBeVisible();
  });

  test('[PAC-LIST-17] filtro de convênio altera listagem', async ({ pacientesListPage, page }) => {
    await pacientesListPage.openFilterDropdown(1);
    const options = page.getByRole('option');
    if ((await options.count()) === 0) {
      test.skip(true, 'Filtro de convênio indisponível nesta conta');
    }
    await options.first().click();
    await expect(page.locator('.patients-rel, .patients-empty, .patients-buscar-tab').first()).toBeVisible();
  });

  test('[PAC-LIST-18] atenção da semana abre painel', async ({ pacientesListPage }) => {
    await pacientesListPage.openAtencaoSemana();
  });

  test('[PAC-LIST-07] atalho aniversariantes', async ({ pacientesListPage, page }) => {
    await pacientesListPage.clickShortcut(/Aniversariantes/i);
    await expect(page.getByText(/anivers/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('[PAC-LIST-08] atalho retornos semestrais', async ({ pacientesListPage, page }) => {
    await pacientesListPage.clickShortcut(/Retornos semestrais/i);
    await expect(page.getByText(/retorno|semestral/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('[PAC-LIST-09] atalho em débito', async ({ pacientesListPage, page }) => {
    await pacientesListPage.clickShortcut(/Em débito/i);
    await expect(page.getByText(/débito|pendência|financeir/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('[PAC-LIST-19] gerenciar modelos de mensagem', async ({ pacientesListPage, page }) => {
    await pacientesListPage.openGerenciarModelosMensagem();
    await expect(page.getByText(/modelo.*mensagem|mensagens de relacionamento/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('[PAC-LIST-20] nova consulta a partir do card', async ({ pacientesListPage, page, request }) => {
    const token = await readAccessToken(page);
    if (!token) test.skip(true, 'Token ausente na sessão autenticada');
    const patient = await createE2ePatientWithRequest(request, token, 'Listagem-Consulta');
    try {
      await pacientesListPage.search(patient.name);
      await pacientesListPage.openNovaConsultaFromRow(patient.name);
      await closeDialog(page);
    } finally {
      await deleteE2ePatientWithPage(page, request, patient.id);
    }
  });

  test('[PAC-LIST-21] abre prontuário do paciente', async ({ pacientesListPage, prontuarioPage, page, request }) => {
    const token = await readAccessToken(page);
    if (!token) test.skip(true, 'Token ausente na sessão autenticada');
    const patient = await createE2ePatientWithRequest(request, token, 'Listagem-Pront');
    try {
      await pacientesListPage.search(patient.name);
      await pacientesListPage.openPatientProntuario(patient.name);
      await prontuarioPage.expectPatientName(patient.name);
      await prontuarioPage.expectInformacoesScreenMap();
    } finally {
      await deleteE2ePatientWithPage(page, request, patient.id);
    }
  });
});
