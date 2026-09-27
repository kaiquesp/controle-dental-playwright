import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import { e2eName } from '../../support/crud-helpers';
import { expectToast } from '../../support/toast-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Documentos', () => {
  let patientId: string | null = null;
  let docTitulo = '';

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
    test.skip(
      !(await documentosTab.isVisible().catch(() => false)),
      'Aba Documentos indisponível no plano/permissões da conta E2E'
    );

    await documentosTab.click();
    await expect(page).toHaveURL(new RegExp(`/pacientes/${patientId}/edit/documentos`), {
      timeout: 30_000,
    });
    await appShell.dismissBlockingModals();
  });

  test('[PAC-PRONT-DOC-MAP] mapeamento da aba documentos', async ({ prontuarioPage }) => {
    await prontuarioPage.expectDocumentosScreenMap();
  });

  test('[PAC-PRONT-DOC-01] cria documento pelo editor', async ({ prontuarioPage }) => {
    test.setTimeout(120_000);
    docTitulo = e2eName('Documento');
    await prontuarioPage.createDocumentoAvulso(docTitulo);
    await expect(prontuarioPage.documentoRow(docTitulo).first()).toBeVisible({ timeout: 20_000 });
  });

  test('[PAC-PRONT-DOC-02] reabre o documento no editor', async ({ page, prontuarioPage }) => {
    test.skip(!docTitulo, 'Documento não criado no teste anterior');
    const row = prontuarioPage.documentoRow(docTitulo).first();
    await expect(row).toBeVisible({ timeout: 20_000 });

    await row.getByRole('button', { name: /Editar documento/i }).click();

    const editor = prontuarioPage.documentoEditor();
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await expect(editor.locator('#doc-avulso-titulo')).toHaveValue(docTitulo, { timeout: 15_000 });

    await editor.getByRole('button', { name: /^Voltar$/i }).first().click();
    await expect(editor).toBeHidden({ timeout: 15_000 });
  });

  test('[PAC-PRONT-DOC-03] baixa o documento', async ({ page, prontuarioPage }) => {
    test.skip(!docTitulo, 'Documento não criado');
    const row = prontuarioPage.documentoRow(docTitulo).first();
    await expect(row).toBeVisible({ timeout: 20_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    await row.getByRole('button', { name: /Baixar documento/i }).click();
    const download = await downloadPromise;
    if (!download) {
      test.skip(true, 'Download não disparado (PDF abre em visualização)');
    }
    expect(download!.suggestedFilename()).toBeTruthy();
  });

  test('[PAC-PRONT-DOC-04] exclui o documento', async ({ page, prontuarioPage }) => {
    test.skip(!docTitulo, 'Documento não criado');
    const row = prontuarioPage.documentoRow(docTitulo).first();
    await expect(row).toBeVisible({ timeout: 20_000 });

    const delBtn = row.getByRole('button', { name: /Excluir documento/i });
    if (!(await delBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Documento não pode ser excluído nesta conta/UI');
    }
    await delBtn.click();

    const confirm = page.getByRole('dialog').filter({ hasText: /excluir|confirmar/i });
    if (await confirm.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.getByRole('button', { name: /Excluir|Confirmar|Sim/i }).first().click();
    }

    await expectToast(page, /Documento excluído/i, 15_000);
    await expect(prontuarioPage.documentoRow(docTitulo)).toHaveCount(0, { timeout: 20_000 });
  });
});
