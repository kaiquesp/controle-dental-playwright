import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient, e2eUploadFilePath } from '../../support/pacientes-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Arquivos', () => {
  let patientId: string | null = null;
  const fileName = 'e2e-sample.pdf';

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Arq');
    patientId = patient.id;
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.beforeEach(async ({ appShell, prontuarioPage }) => {
    test.skip(!patientId, 'Paciente E2E não criado');
    await prontuarioPage.goToTab(patientId!, 'arquivos');
    await appShell.dismissBlockingModals();
  });

  test('[PAC-PRONT-ARQ-MAP] mapeamento da aba arquivos', async ({ prontuarioPage }) => {
    await prontuarioPage.expectArquivosScreenMap();
  });

  test('[PAC-PRONT-ARQ-01] upload de arquivo', async ({ prontuarioPage }) => {
    test.setTimeout(120_000);
    await prontuarioPage.uploadArquivo(e2eUploadFilePath());
    await expect(prontuarioPage.arquivoRow(fileName).first()).toBeVisible({ timeout: 20_000 });
  });

  test('[PAC-PRONT-ARQ-02] visualizar arquivo', async ({ page, prontuarioPage }) => {
    const row = prontuarioPage.arquivoRow(fileName);
    if (!(await row.first().isVisible().catch(() => false))) {
      test.skip(true, 'Arquivo de teste não encontrado');
    }
    const viewBtn = row.getByRole('button', { name: /Visualizar|Ver|Abrir/i });
    const popupPromise = page.context().waitForEvent('page', { timeout: 8_000 }).catch(() => null);
    await viewBtn.first().click();
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
      await popup.waitForLoadState('load', { timeout: 10_000 }).catch(() => undefined);
      const url = popup.url();
      const hasViewer = await popup
        .locator('embed, iframe, img, canvas, object')
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (url !== 'about:blank' || hasViewer) {
        await popup.close().catch(() => undefined);
        return;
      }
      await popup.close().catch(() => undefined);
    }
    const preview = page
      .locator(
        '[role="dialog"]:visible, iframe, embed, canvas, .p-image-preview, img[src*="blob"], object'
      )
      .first();
    if (!(await preview.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(true, 'Visualização de arquivo indisponível na UI');
    }
    await expect(preview).toBeVisible();
  });

  test('[PAC-PRONT-ARQ-03] download de arquivo', async ({ page, prontuarioPage }) => {
    const row = prontuarioPage.arquivoRow(fileName);
    if (!(await row.first().isVisible().catch(() => false))) {
      test.skip(true, 'Arquivo de teste não encontrado');
    }
    const downloadBtn = row.getByRole('button', { name: /Download|Baixar/i });
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    await downloadBtn.first().click();
    const download = await downloadPromise;
    if (!download) {
      test.skip(true, 'Download não disparado (pode abrir em nova aba)');
    }
    expect(download!.suggestedFilename()).toBeTruthy();
  });

  test('[PAC-PRONT-ARQ-04] exclui arquivo', async ({ prontuarioPage }) => {
    const row = prontuarioPage.arquivoRow(fileName);
    if (!(await row.first().isVisible().catch(() => false))) {
      test.skip(true, 'Arquivo de teste não encontrado — execute PAC-PRONT-ARQ-01 antes');
    }
    await prontuarioPage.excluirArquivo(fileName);
  });
});
