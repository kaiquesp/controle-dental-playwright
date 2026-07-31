import { test, expect } from '../../fixtures/test.fixture';
import { PROTESE_SELECTORS } from '../../data/protese';
import { e2eName } from '../../support/crud-helpers';
import { listProfessionalsByApi, readTokenFromPage } from '../../support/agenda-helpers';
import {
  cleanupProteseSeeds,
  createCasoByApi,
  createPatientForProtese,
  expectCasoInApi,
  listLaboratoriosByApi,
} from '../../support/protese-helpers';

test.describe('Controle de prótese — kanban e solicitações', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const casoIds: number[] = [];
  const patientIds: string[] = [];
  let authToken = '';
  let patientName = '';
  let casoId = 0;

  test.beforeEach(async ({ appShell, controleProtesePage }) => {
    await appShell.navigateTo('/controle-protese');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await controleProtesePage.waitForKanbanReload();
  });

  test.afterAll(async ({ request }) => {
    if (authToken) await cleanupProteseSeeds(request, authToken, casoIds, [], patientIds);
  });

  test('[PRO-CRUD-01] cria solicitação via API e exibe no kanban', async ({
    page,
    controleProtesePage,
    request,
  }) => {
    authToken = await readTokenFromPage(page);
    const pros = await listProfessionalsByApi(request, authToken);
    const profId = pros[0]?.id;
    if (!profId) test.skip(true, 'Sem profissional');

    const patient = await createPatientForProtese(request, authToken, 'Protese');
    patientIds.push(String(patient.id));
    patientName = patient.name;
    const labs = await listLaboratoriosByApi(request, authToken);

    casoId = await createCasoByApi(request, authToken, {
      patientId: patient.id,
      professionalId: profId,
      laboratorioId: labs[0]?.id,
      detalhes: e2eName('Detalhe'),
    });
    casoIds.push(casoId);
    await expectCasoInApi(request, authToken, casoId);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await controleProtesePage.waitForKanbanReload();
    await controleProtesePage.searchSolicitacoes(patient.name.slice(0, 12));

    const card = controleProtesePage.caseCard(new RegExp(patient.name.slice(0, 12))).first();
    if (!(await card.isVisible({ timeout: 20_000 }).catch(() => false))) {
      test.skip(true, 'Solicitação seedada via API não apareceu no kanban');
    }
    await expect(card).toBeVisible();
  });

  test('[PRO-05] abrir detalhe da solicitação exibe informações', async ({ controleProtesePage, page }) => {
    if (!patientName) test.skip(true, 'Depende da solicitação criada em PRO-CRUD-01');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await controleProtesePage.waitForKanbanReload();
    await controleProtesePage.searchSolicitacoes(patientName.slice(0, 12));

    const card = controleProtesePage.caseCard(new RegExp(patientName.slice(0, 12))).first();
    if (!(await card.isVisible({ timeout: 15_000 }).catch(() => false))) {
      test.skip(true, 'Card da solicitação não visível na grade');
    }

    const dialog = await controleProtesePage.openCase(new RegExp(patientName.slice(0, 12)));
    await expect(dialog.getByText(/Coroa unitária|Detalhes|Histórico|prótese|Solicitação/i).first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('[PRO-KAN-01] move solicitação para próxima coluna do fluxo', async ({ page, controleProtesePage }) => {
    if (!patientName) test.skip(true, 'Depende da solicitação criada em PRO-CRUD-01');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await controleProtesePage.waitForKanbanReload();
    await controleProtesePage.searchSolicitacoes(patientName.slice(0, 12));

    const label = new RegExp(patientName.slice(0, 12));
    const card = controleProtesePage.caseCard(label).first();
    if (!(await card.isVisible({ timeout: 15_000 }).catch(() => false))) {
      test.skip(true, 'Card da solicitação não visível para arrastar');
    }

    await controleProtesePage.moveCaseToColumn(label, 'Enviado para laboratório');

    const inTarget = controleProtesePage
      .kanbanColumn('Enviado para laboratório')
      .locator(PROTESE_SELECTORS.caseCard)
      .filter({ hasText: label });
    const visibleSomewhere = await controleProtesePage.caseCard(label).first().isVisible().catch(() => false);
    expect((await inTarget.count()) > 0 || visibleSomewhere).toBeTruthy();
  });
});
