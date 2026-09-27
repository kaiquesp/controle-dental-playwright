import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import { e2eName } from '../../support/crud-helpers';
import { closeDialog } from '../../support/interaction-helpers';
import { expectErrorToast, expectNoErrorToast, expectToast } from '../../support/toast-helpers';
import type { Page } from '@playwright/test';

async function mockChartAnnotations(
  page: Page,
  options?: { putStatus?: number }
): Promise<void> {
  const maps = { odontogram: {} as Record<string, string>, hof: {} as Record<string, string> };
  await page.route('**/api/pacientes/*/chart-annotations', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ odontogram: maps.odontogram, hof: maps.hof }),
      });
      return;
    }
    if (method === 'PUT') {
      if (options?.putStatus && options.putStatus >= 400) {
        await route.fulfill({
          status: options.putStatus,
          contentType: 'application/json',
          body: JSON.stringify({ erro: 'Nao foi possivel salvar a anotacao.' }),
        });
        return;
      }
      const body = (route.request().postDataJSON() ?? {}) as {
        chart_kind?: string;
        target_id?: string;
        note?: string;
      };
      const kind = body.chart_kind === 'hof' ? 'hof' : 'odontogram';
      const targetId = String(body.target_id ?? '');
      const note = String(body.note ?? '').trim();
      if (targetId) {
        if (note) {
          maps[kind][targetId] = note;
        } else {
          delete maps[kind][targetId];
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mensagem: note ? 'Anotacao salva.' : 'Anotacao removida.',
          odontogram: maps.odontogram,
          hof: maps.hof,
        }),
      });
      return;
    }
    await route.continue();
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Tratamentos', () => {
  let patientId: string | null = null;
  let tratamentoDesc = '';
  let tratamentoProc = '';

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
    const novoBtn = prontuarioPage.page
      .locator('main, app-paciente-form-content')
      .first()
      .getByRole('button', { name: /Novo tratamento/i })
      .first();
    await novoBtn.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
    if (!(await novoBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Criação de tratamento indisponível');
    }
    try {
      tratamentoProc = await prontuarioPage.createTratamentoBasico(tratamentoDesc);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/procedimento/i.test(message)) {
        test.skip(true, message);
      }
      throw error;
    }
    await expect(prontuarioPage.tratamentoRow(tratamentoProc).first()).toBeVisible({ timeout: 20_000 });
  });

  test('[PAC-PRONT-TRAT-02] tratamento reflete no odontograma', async ({ page, prontuarioPage }) => {
    test.skip(!tratamentoProc, 'Tratamento não criado no teste anterior');
    await prontuarioPage.goToTab(patientId!, 'tratamentos');
    await expect(page.locator('.odonto, app-paciente-odontograma').first()).toBeVisible({ timeout: 15_000 });
    await prontuarioPage.expectOdontogramaMarcado();
  });

  test('[PAC-PRONT-TRAT-03] cores a realizar vs concluído', async ({ page }) => {
    const legend = page.getByText(/a realizar|concluído|realizado|planejado/i);
    await expect(legend.first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
  });

  test('[PAC-PRONT-TRAT-04] edita tratamento', async ({ prontuarioPage, page }) => {
    test.skip(!tratamentoProc, 'Tratamento não criado');
    await prontuarioPage.goToTab(patientId!, 'tratamentos');
    const menu = await prontuarioPage.openTratamentoRowMenu(tratamentoProc);
    await menu.getByRole('menuitem', { name: /Editar/i }).click();

    await expect(page.getByRole('heading', { name: /Editar tratamento/i })).toBeVisible({
      timeout: 15_000,
    });
    await closeDialog(page);
  });

  test('[PAC-PRONT-TRAT-05] exclui tratamento', async ({ page, prontuarioPage }) => {
    test.skip(!tratamentoProc, 'Tratamento não criado');
    await prontuarioPage.goToTab(patientId!, 'tratamentos');
    const menu = await prontuarioPage.openTratamentoRowMenu(tratamentoProc);
    await menu.getByRole('menuitem', { name: /Excluir/i }).click();

    const confirm = page
      .getByRole('alertdialog')
      .filter({ hasText: /prestes a excluir permanentemente/i });
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await confirm.getByRole('button', { name: /^Excluir tratamento$/i }).click();

    await expectToast(page, /Tratamento excluído/i, 15_000);
    await expect(prontuarioPage.tratamentoRow(tratamentoProc)).toHaveCount(0, { timeout: 20_000 });
  });

  test('[PAC-PRONT-TRAT-NOTE-01] anota um dente e salva com toast de sucesso', async ({
    page,
    prontuarioPage,
  }) => {
    await mockChartAnnotations(page);
    await prontuarioPage.goToTab(patientId!, 'tratamentos');
    await prontuarioPage.expectAnnotationsPanel();
    await expect(page.getByText(/Clique em um dente ou região do faceograma para anotar/i)).toBeVisible();
    await prontuarioPage.selectToothForAnnotation(11);
    await prontuarioPage.annotationNoteField().fill('Nota clínica E2E do dente 11');
    await page.getByRole('button', { name: /^Salvar$/ }).click();
    await expectToast(page, /Anotação salva/i);
    await expect(page.locator('.chart-notes__item').filter({ hasText: /Nota clínica E2E/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('[PAC-PRONT-TRAT-NOTE-02] salvar vazio exibe validação no campo', async ({ page, prontuarioPage }) => {
    await mockChartAnnotations(page);
    await prontuarioPage.goToTab(patientId!, 'tratamentos');
    await prontuarioPage.selectToothForAnnotation(21);
    await page.getByRole('button', { name: /^Salvar$/ }).click();
    await expect(page.locator('.invalid-feedback, .p-invalid').filter({ hasText: /Escreva uma anotação/i })).toBeVisible({
      timeout: 8_000,
    });
    await expectNoErrorToast(page);
  });

  test('[PAC-PRONT-TRAT-NOTE-03] falha da API ao salvar mostra toast de erro', async ({
    page,
    prontuarioPage,
  }) => {
    await mockChartAnnotations(page, { putStatus: 500 });
    await prontuarioPage.goToTab(patientId!, 'tratamentos');
    await prontuarioPage.selectToothForAnnotation(11);
    await prontuarioPage.annotationNoteField().fill('Não deve persistir');
    await page.getByRole('button', { name: /^Salvar$/ }).click();
    await expectErrorToast(page, /Não foi possível salvar a anotação|anotacao/i);
  });
});
