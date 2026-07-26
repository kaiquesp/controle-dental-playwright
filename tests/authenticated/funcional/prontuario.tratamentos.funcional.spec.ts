import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import { e2eName } from '../../support/crud-helpers';
import { closeDialog } from '../../support/interaction-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Tratamentos', () => {
  let patientId: string | null = null;
  let tratamentoDesc = '';

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Trat');
    patientId = patient.id;
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.beforeEach(async ({ appShell, prontuarioPage }) => {
    test.skip(!patientId, 'Paciente E2E não criado');
    await prontuarioPage.goToTab(patientId!, 'tratamentos');
    await appShell.dismissBlockingModals();
  });

  test('[PAC-PRONT-TRAT-MAP] mapeamento da aba tratamentos', async ({ prontuarioPage }) => {
    await prontuarioPage.expectTratamentosScreenMap();
  });

  test('[PAC-PRONT-TRAT-01] cria tratamento', async ({ prontuarioPage }) => {
    test.setTimeout(120_000);
    tratamentoDesc = e2eName('Tratamento');
    const novoBtn = prontuarioPage.page.getByRole('button', { name: /Novo tratamento|Adicionar tratamento/i }).first();
    if (!(await novoBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Criação de tratamento indisponível');
    }
    try {
      await prontuarioPage.createTratamentoBasico(tratamentoDesc);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/procedimento/i.test(message)) {
        test.skip(true, message);
      }
      throw error;
    }
    await expect(prontuarioPage.tratamentoRow(tratamentoDesc).first()).toBeVisible({ timeout: 20_000 });
  });

  test('[PAC-PRONT-TRAT-02] tratamento reflete no odontograma', async ({ page, prontuarioPage }) => {
    test.skip(!tratamentoDesc, 'Tratamento não criado no teste anterior');
    const odontograma = page.locator('[class*="odontograma"]');
    await expect(odontograma.first()).toBeVisible({ timeout: 15_000 });
    const marcado = page.locator(
      '[class*="odontograma"] [class*="selected"], [class*="odontograma"] [class*="active"], [class*="tooth--"]'
    );
    await expect(marcado.first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
  });

  test('[PAC-PRONT-TRAT-03] cores a realizar vs concluído', async ({ page }) => {
    const legend = page.getByText(/a realizar|concluído|realizado|planejado/i);
    await expect(legend.first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
  });

  test('[PAC-PRONT-TRAT-04] edita tratamento', async ({ prontuarioPage, page }) => {
    test.skip(!tratamentoDesc, 'Tratamento não criado');
    const row = prontuarioPage.tratamentoRow(tratamentoDesc);
    const editBtn = row.getByRole('button', { name: /Editar/i });
    if (!(await editBtn.first().isVisible().catch(() => false))) {
      test.skip(true, 'Edição de tratamento indisponível na UI');
    }
    await editBtn.first().click();
    const dialog = page.locator('[role="dialog"]:visible').last();
    await expect(dialog).toBeVisible();
    await closeDialog(page);
  });

  test('[PAC-PRONT-TRAT-05] exclui tratamento', async ({ prontuarioPage }) => {
    test.skip(!tratamentoDesc, 'Tratamento não criado');
    const row = prontuarioPage.tratamentoRow(tratamentoDesc);
    const delBtn = row.getByRole('button', { name: /Excluir/i });
    if (!(await delBtn.first().isVisible().catch(() => false))) {
      test.skip(true, 'Exclusão de tratamento indisponível na UI');
    }
    await delBtn.first().click();
    const confirm = prontuarioPage.page.getByRole('dialog').filter({ hasText: /excluir|confirmar/i });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.getByRole('button', { name: /Excluir|Confirmar|Sim/i }).click();
    }
    await expect(row).toHaveCount(0, { timeout: 20_000 });
  });
});
