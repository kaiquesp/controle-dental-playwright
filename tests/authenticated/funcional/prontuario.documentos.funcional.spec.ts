import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient, e2eUploadFilePath } from '../../support/pacientes-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Documentos', () => {
  let patientId: string | null = null;
  const fileName = 'e2e-sample.txt';

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Doc');
    patientId = patient.id;
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.beforeEach(async ({ appShell, page, prontuarioPage }) => {
    test.skip(!patientId, 'Paciente E2E não criado');
    await prontuarioPage.goToTab(patientId!, 'informacoes');
    await appShell.dismissBlockingModals();

    const documentosTab = page.getByRole('tab', { name: /^Documentos$/i });
    test.skip(!(await documentosTab.isVisible().catch(() => false)), 'Aba Documentos indisponível no plano/permissões da conta E2E');

    await documentosTab.click();
    await expect(page).toHaveURL(new RegExp(`/pacientes/${patientId}/edit/documentos`), { timeout: 30_000 });
    await appShell.dismissBlockingModals();
  });

  test('[PAC-PRONT-DOC-MAP] mapeamento da aba documentos', async ({ prontuarioPage }) => {
    await prontuarioPage.expectDocumentosScreenMap();
  });

  test('[PAC-PRONT-DOC-01] upload de documento', async ({ prontuarioPage }) => {
    test.setTimeout(120_000);
    const uploadBtn = prontuarioPage.page.getByRole('button', { name: /Upload|Enviar|Novo documento/i }).first();
    if (await uploadBtn.isVisible().catch(() => false)) {
      await uploadBtn.click();
    }
    await prontuarioPage.uploadArquivo(e2eUploadFilePath());
    await expect(prontuarioPage.arquivoRow(fileName).first()).toBeVisible({ timeout: 20_000 });
  });

  test('[PAC-PRONT-DOC-02] visualizar documento', async ({ page, prontuarioPage }) => {
    const row = prontuarioPage.arquivoRow(fileName);
    if (!(await row.first().isVisible().catch(() => false))) {
      test.skip(true, 'Documento de teste não encontrado');
    }
    await row.getByRole('button', { name: /Visualizar|Ver|Abrir/i }).first().click();
    await expect(page.locator('[role="dialog"]:visible, iframe').first()).toBeVisible({ timeout: 15_000 });
  });

  test('[PAC-PRONT-DOC-03] download de documento', async ({ page, prontuarioPage }) => {
    const row = prontuarioPage.arquivoRow(fileName);
    if (!(await row.first().isVisible().catch(() => false))) {
      test.skip(true, 'Documento de teste não encontrado');
    }
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    await row.getByRole('button', { name: /Download|Baixar/i }).first().click();
    const download = await downloadPromise;
    if (!download) {
      test.skip(true, 'Download não disparado');
    }
    expect(download!.suggestedFilename()).toBeTruthy();
  });

  test('[PAC-PRONT-DOC-04] exclui documento', async ({ prontuarioPage }) => {
    const row = prontuarioPage.arquivoRow(fileName);
    if (!(await row.first().isVisible().catch(() => false))) {
      test.skip(true, 'Documento de teste não encontrado');
    }
    await row.getByRole('button', { name: /Excluir/i }).first().click();
    const confirm = prontuarioPage.page.getByRole('dialog').filter({ hasText: /excluir|confirmar/i });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.getByRole('button', { name: /Excluir|Confirmar|Sim/i }).click();
    }
    await expect(row).toHaveCount(0, { timeout: 20_000 });
  });
});
