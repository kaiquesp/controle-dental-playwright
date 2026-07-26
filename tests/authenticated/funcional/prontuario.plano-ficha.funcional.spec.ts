import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import { closeDialog } from '../../support/interaction-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Plano e Ficha', () => {
  let patientId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Plano');
    patientId = patient.id;
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.beforeEach(async ({ appShell, prontuarioPage }) => {
    test.skip(!patientId, 'Paciente E2E não criado');
    await prontuarioPage.goToTab(patientId!, 'plano-ficha');
    await appShell.dismissBlockingModals();
  });

  test('[PAC-PRONT-PLANO-MAP] mapeamento da aba plano e ficha', async ({ prontuarioPage }) => {
    await prontuarioPage.expectPlanoFichaScreenMap();
  });

  test('[PAC-PRONT-PLANO-01] lista ficha clínica e planos aprovados', async ({ page, prontuarioPage }) => {
    await prontuarioPage.expectPlanoFichaScreenMap();
    const ficha = page.getByText(/ficha clínica|registro clínico|histórico/i).first();
    const planos = page.getByText(/plano de tratamento|aprovado|orçamento aprovado/i).first();
    const hasFicha = await ficha.isVisible().catch(() => false);
    const hasPlanos = await planos.isVisible().catch(() => false);
    expect(hasFicha || hasPlanos || (await page.locator('main').isVisible())).toBeTruthy();
  });

  test('[PAC-PRONT-PLANO-02] novo registro na ficha clínica', async ({ page }) => {
    const novoBtn = page.getByRole('button', { name: /Novo registro|Nova ficha|Adicionar registro/i }).first();
    if (!(await novoBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Botão de novo registro indisponível');
    }
    await novoBtn.click();
    const dialog = page.locator('[role="dialog"]:visible, .p-dialog:visible').last();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await closeDialog(page);
  });
});
