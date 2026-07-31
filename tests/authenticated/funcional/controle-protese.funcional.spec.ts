import { test, expect } from '../../fixtures/test.fixture';
import {
  closeDialog,
  expectDialogHasFormFields,
  expectDialogOpen,
} from '../../support/interaction-helpers';
import { PROTESE_FORM_IDS } from '../../data/protese';
import { readTokenFromPage, listProfessionalsByApi } from '../../support/agenda-helpers';
import { cleanupProteseSeeds, createPatientForProtese } from '../../support/protese-helpers';

test.describe('Controle de prótese — interações do quadro', () => {
  test.beforeEach(async ({ appShell, controleProtesePage }) => {
    await appShell.navigateTo('/controle-protese');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await controleProtesePage.waitForKanbanReload();
  });

  test('[PRO-04] modal nova solicitação exibe formulário e cancela', async ({ controleProtesePage, page }) => {
    await controleProtesePage.openNovaSolicitacao();
    const dialog = page.locator('.controle-protese-caso-modal').first();
    await expect(page.locator(PROTESE_FORM_IDS.patientSearch)).toBeVisible();
    await expectDialogHasFormFields(dialog, 2);
    await closeDialog(page);
  });

  test('[PRO-CRUD-UI-01] cria nova solicitação via UI com paciente E2E', async ({
    controleProtesePage,
    request,
    page,
  }) => {
    test.setTimeout(180_000);
    const token = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, token);
    const professional = pros[0];
    if (!professional) test.skip(true, 'Sem profissional cadastrado');

    const patient = await createPatientForProtese(request, token, 'ProteseUI');
    const casoIds: number[] = [];

    try {
      await controleProtesePage.openNovaSolicitacao();
      await controleProtesePage.fillNovaSolicitacaoBasics({
        patientName: patient.name,
        denteRegiao: '11',
        professionalName: professional.nome_exibicao,
      });
      await controleProtesePage.expectProfissionalSelecionado();

      const casoId = await controleProtesePage.saveNovaSolicitacao();
      if (casoId) casoIds.push(casoId);

      await controleProtesePage.searchSolicitacoes(patient.name.slice(0, 12));
      await expect(
        controleProtesePage.caseCard(new RegExp(patient.name.slice(0, 12))).first()
      ).toBeVisible({ timeout: 20_000 });
    } finally {
      await cleanupProteseSeeds(request, token, casoIds, [], [String(patient.id)]);
    }
  });

  test('[PRO-05] busca por termo mantém tela estável', async ({ controleProtesePage, page, appShell }) => {
    await appShell.dismissBlockingModals();
    await controleProtesePage.searchSolicitacoes('teste');
    await expect(page).toHaveURL(/\/controle-protese/);
    await expect(page.getByRole('heading', { name: /Controle de prótese/i }).first()).toBeVisible();
    await controleProtesePage.expectKanbanColumns();
  });

  test('[PRO-07] exibe cards de resumo do fluxo', async ({ page }) => {
    await expect(page.getByText(/Em andamento/i).first()).toBeVisible();
    await expect(page.getByText(/Aguardando laboratório/i).first()).toBeVisible();
  });

  test('[PRO-08] link laboratórios no kanban navega', async ({ page, controleProtesePage }) => {
    await controleProtesePage.laboratoriosLink.click();
    await expect(page).toHaveURL(/\/controle-protese\/laboratorios/);
  });
});

test.describe('Controle de prótese — laboratórios interações', () => {
  test.beforeEach(async ({ appShell, controleProtesePage }) => {
    await appShell.navigateTo('/controle-protese/laboratorios');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[PRO-LAB-03] filtro Ativos e Todos mantém listagem estável', async ({ controleProtesePage, page }) => {
    await controleProtesePage.filterLaboratorios('Todos');
    await expect(page.getByRole('heading', { name: /Laboratórios/i }).first()).toBeVisible();
    await controleProtesePage.filterLaboratorios('Ativos');
    await expect(page.getByRole('heading', { name: /Laboratórios/i }).first()).toBeVisible();
  });

  test('[PRO-LAB-05] modal novo laboratório exibe campos e cancela', async ({ controleProtesePage, page }) => {
    await controleProtesePage.openNovoLaboratorio();
    await expectDialogOpen(page, /laboratório|nome/i);
    await expect(page.locator(PROTESE_FORM_IDS.labNome)).toBeVisible();
    await expect(page.locator(PROTESE_FORM_IDS.labTel)).toBeVisible();
    await closeDialog(page);
  });
});
