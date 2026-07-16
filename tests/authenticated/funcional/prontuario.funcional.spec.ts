import { test, expect } from '../../fixtures/test.fixture';
import { PATIENT_FORM_TABS } from '../../data/routes';
import {
  createAuthenticatedE2eContext,
  createPatientByApi,
  deletePatientByApi,
  e2eName,
  readAccessToken,
} from '../../support/crud-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — abas do paciente', () => {
  let patientId: string | null = null;
  let patientName = '';

  test.beforeAll(async ({ browser }) => {
    const context = await createAuthenticatedE2eContext(browser);
    const page = await context.newPage();
    await page.goto('/');
    const token = await readAccessToken(page);
    if (!token) {
      throw new Error('Token ausente para criar paciente E2E no beforeAll');
    }

    patientName = e2eName('Prontuario');
    patientId = await createPatientByApi(context.request, token, patientName);
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!patientId) {
      return;
    }
    const context = await createAuthenticatedE2eContext(browser);
    const page = await context.newPage();
    await page.goto('/');
    const token = await readAccessToken(page);
    if (token) {
      await deletePatientByApi(context.request, token, patientId);
    }
    await context.close();
  });

  test.beforeEach(async ({ appShell }) => {
    test.skip(!patientId, 'Paciente E2E não foi criado');
    await appShell.navigateTo(`/pacientes/${patientId}/edit/informacoes`);
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  for (const tab of PATIENT_FORM_TABS) {
    test(`[PAC-PRONT-${tab}] navega aba ${tab}`, async ({ page, appShell }) => {
      await appShell.navigateTo(`/pacientes/${patientId}/edit/informacoes`);
      await appShell.dismissBlockingModals();

      const tabLabels: Record<string, RegExp> = {
        informacoes: /^Informações$/i,
        'plano-ficha': /^Plano e Ficha Clínica$/i,
        orcamentos: /^Orçamentos$/i,
        tratamentos: /^Tratamentos$/i,
        arquivos: /^Arquivos$/i,
        anamneses: /^Anamneses$/i,
        receituario: /^Receituário$/i,
        documentos: /^Documentos$/i,
        pagamentos: /^Pagamentos$/i,
      };
      const tabButton = page.getByRole('tab', { name: tabLabels[tab] });

      if (!(await tabButton.isVisible().catch(() => false))) {
        test.skip(true, `Aba ${tab} indisponível no plano/permissões da conta E2E`);
      }

      await tabButton.click();
      await expect(page).toHaveURL(new RegExp(`/pacientes/${patientId}/edit/${tab}`), { timeout: 30_000 });
      await expect(page.locator('app-paciente-form-content, app-paciente-form-layout').first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(patientName).first()).toBeVisible({ timeout: 15_000 });
    });
  }
});
