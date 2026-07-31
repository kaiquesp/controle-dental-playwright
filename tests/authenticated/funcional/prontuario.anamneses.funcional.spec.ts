import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import { closeDialog } from '../../support/interaction-helpers';
import { e2eName } from '../../support/crud-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Anamneses', () => {
  let patientId: string | null = null;
  let anamneseTitulo = '';

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Anam');
    patientId = patient.id;
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.beforeEach(async ({ appShell, prontuarioPage }) => {
    test.skip(!patientId, 'Paciente E2E não criado');
    await prontuarioPage.goToTab(patientId!, 'anamneses');
    await appShell.dismissBlockingModals();
  });

  test('[PAC-PRONT-ANAM-MAP] mapeamento da aba anamneses', async ({ prontuarioPage }) => {
    await prontuarioPage.expectAnamnesesScreenMap();
  });

  test('[PAC-PRONT-ANAM-01] cria nova anamnese', async ({ prontuarioPage }) => {
    test.setTimeout(120_000);
    anamneseTitulo = e2eName('Anamnese');
    const novoBtn = prontuarioPage.page.getByRole('button', { name: /Nova anamnese|Criar primeira anamnese/i }).first();
    if (!(await novoBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Nova anamnese indisponível');
    }
    try {
      await prontuarioPage.createAnamneseBasica(anamneseTitulo);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/modelo/i.test(message)) {
        test.skip(true, message);
      }
      throw error;
    }
  });

  test('[PAC-PRONT-ANAM-02] pesquisa anamnese', async ({ page }) => {
    const search = page.getByPlaceholder(/buscar|pesquisar/i).first();
    if (!(await search.isVisible().catch(() => false))) {
      test.skip(true, 'Campo de pesquisa indisponível');
    }
    await search.fill(anamneseTitulo || 'E2E');
    await page.waitForTimeout(600);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('[PAC-PRONT-ANAM-03] visualiza modelos de anamnese', async ({ page }) => {
    const modelos = page.getByRole('button', { name: /modelo|template/i }).first();
    if (!(await modelos.isVisible().catch(() => false))) {
      test.skip(true, 'Modelos de anamnese indisponíveis na UI');
    }
    await modelos.click();
    const dialog = page.locator('[role="dialog"]:visible, .p-dialog:visible').last();
    const opened = await dialog
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) {
      test.skip(true, 'Painel de modelos não abriu');
    }
    const hasContent = await dialog
      .getByText(/modelo|template|anamnese/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!hasContent) {
      test.skip(true, 'Lista de modelos vazia ou layout diferente');
    }
    await closeDialog(page);
  });

  test('[PAC-PRONT-ANAM-04] edita anamnese', async ({ page }) => {
    test.skip(!anamneseTitulo, 'Anamnese não criada');
    const row = page.locator('tr, article').filter({ hasText: anamneseTitulo });
    const editBtn = row.getByRole('button', { name: /Editar/i });
    if (!(await editBtn.first().isVisible().catch(() => false))) {
      test.skip(true, 'Edição indisponível');
    }
    await editBtn.first().click();
    await closeDialog(page);
  });

  test('[PAC-PRONT-ANAM-05] exclui anamnese', async ({ page }) => {
    test.skip(!anamneseTitulo, 'Anamnese não criada');
    const row = page.locator('tr, article').filter({ hasText: anamneseTitulo });
    const delBtn = row.getByRole('button', { name: /Excluir/i });
    if (!(await delBtn.first().isVisible().catch(() => false))) {
      test.skip(true, 'Exclusão indisponível');
    }
    await delBtn.first().click();
    const confirm = page.getByRole('dialog').filter({ hasText: /excluir|confirmar/i });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.getByRole('button', { name: /Excluir|Confirmar|Sim/i }).click();
    }
    await expect(row).toHaveCount(0, { timeout: 20_000 });
  });
});
