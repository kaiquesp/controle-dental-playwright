import { test, expect } from '../../fixtures/test.fixture';
import { e2eName } from '../../support/crud-helpers';
import { readTokenFromPage } from '../../support/agenda-helpers';
import {
  cleanupProteseSeeds,
  createLaboratorioByApi,
  listLaboratoriosByApi,
  setLaboratorioAtivoByApi,
} from '../../support/protese-helpers';
import { PROTESE_FORM_IDS } from '../../data/protese';

test.describe('Controle de prótese — laboratórios CRUD', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const laboratorioIds: number[] = [];
  let authToken = '';
  let labName = '';

  test.beforeEach(async ({ appShell, controleProtesePage }) => {
    await appShell.navigateTo('/controle-protese/laboratorios');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await controleProtesePage.page.waitForTimeout(500);
  });

  test.afterAll(async ({ request }) => {
    if (authToken) await cleanupProteseSeeds(request, authToken, [], laboratorioIds);
  });

  test('[PRO-LAB-CRUD-01] cria laboratório E2E e aparece na busca', async ({
    page,
    controleProtesePage,
    appShell,
    request,
  }) => {
    authToken = await readTokenFromPage(page);
    labName = e2eName('Lab');
    await page.waitForTimeout(1_000);
    await appShell.dismissBlockingModals();

    await controleProtesePage.openNovoLaboratorio();
    await controleProtesePage.fillLaboratorioBasics({
      nome: labName,
      telefone: '(11) 98765-4321',
    });
    await controleProtesePage.saveLaboratorio();

    await controleProtesePage.searchLaboratorios(labName);
    await expect(controleProtesePage.laboratorioRow(labName)).toBeVisible({ timeout: 15_000 });

    const labs = await listLaboratoriosByApi(request, authToken);
    const created = labs.find((lab) => lab.nome === labName);
    if (created?.id) laboratorioIds.push(created.id);
  });

  test('[PRO-LAB-05] edita laboratório existente', async ({ controleProtesePage, page }) => {
    if (!labName) test.skip(true, 'Depende do laboratório criado em PRO-LAB-CRUD-01');

    const edited = `${labName}-Edit`;
    await controleProtesePage.searchLaboratorios(labName);
    await controleProtesePage.openLaboratorioEditor(labName);
    await page.locator(PROTESE_FORM_IDS.labNome).fill(edited);
    await controleProtesePage.saveLaboratorio();
    labName = edited;

    await controleProtesePage.searchLaboratorios(edited);
    await expect(controleProtesePage.laboratorioRow(edited)).toBeVisible({ timeout: 15_000 });
  });

  test('[PRO-LAB-06] inativar laboratório remove da listagem de ativos', async ({
    page,
    controleProtesePage,
    request,
  }) => {
    authToken = await readTokenFromPage(page);
    const inactiveName = e2eName('LabInativo');
    const id = await createLaboratorioByApi(request, authToken, inactiveName);
    laboratorioIds.push(id);
    await setLaboratorioAtivoByApi(request, authToken, id, false, inactiveName);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await controleProtesePage.filterLaboratorios('Ativos');
    await controleProtesePage.searchLaboratorios(inactiveName);
    await expect(controleProtesePage.laboratorioRow(inactiveName)).toHaveCount(0, { timeout: 10_000 });
  });
});
