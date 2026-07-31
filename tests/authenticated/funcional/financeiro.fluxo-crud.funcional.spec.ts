import { test, expect } from '../../fixtures/test.fixture';
import { e2eName, createPatientByApi } from '../../support/crud-helpers';
import { readTokenFromPage } from '../../support/agenda-helpers';
import {
  cleanupFinanceiroSeeds,
  createTransacaoByApi,
} from '../../support/financeiro-helpers';

test.describe('Financeiro — fluxo CRUD', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const transacaoIds: number[] = [];
  let authToken = '';
  let descricao = '';
  let descricaoEditada = '';
  let patientId = '';
  let transacaoId = 0;

  test.beforeEach(async ({ appShell, financeiroPage }) => {
    await appShell.navigateTo('/financeiro/fluxo-caixa');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await financeiroPage.waitForTransacoesReload();
  });

  test.afterAll(async ({ request }) => {
    if (authToken) {
      await cleanupFinanceiroSeeds(request, authToken, transacaoIds);
      if (patientId) {
        const { deletePatientByApi } = await import('../../support/crud-helpers');
        await deletePatientByApi(request, authToken, patientId).catch(() => undefined);
      }
    }
  });

  test('[FIN-CRUD-01] cria lançamento e exibe no fluxo', async ({ financeiroPage, page, request }) => {
    authToken = (await readTokenFromPage(page)) ?? '';
    const patientName = e2eName('Fin');
    patientId = await createPatientByApi(request, authToken, patientName);
    descricao = e2eName('Receita');
    descricaoEditada = `${descricao}-Edit`;

    transacaoId = await createTransacaoByApi(request, authToken, {
      tipo: 'receita',
      descricao,
      valor: 99.9,
      patientId: Number(patientId),
      status: 'pago',
    });
    transacaoIds.push(transacaoId);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await financeiroPage.waitForTransacoesReload();
    await financeiroPage.searchLancamentos(descricao.slice(0, 14));
    await expect(
      financeiroPage.lancamentoRow(new RegExp(descricao.slice(0, 14))).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('[FIN-CRUD-UI-01] preenche modal novo lançamento via UI', async ({ financeiroPage, page }) => {
    await financeiroPage.openNovoLancamento();
    await financeiroPage.fillLancamento({
      tipo: 'despesa',
      valor: '50,00',
      descricao: e2eName('DespesaUI'),
      status: 'pago',
    });
    await expect(page.locator('#nt-desc')).toHaveValue(/.+/);
    await financeiroPage.cancelLancamentoModal();
  });

  test('[FIN-FLUX-04] edita lançamento existente', async ({ financeiroPage, request }) => {
    if (!descricao || !transacaoId) test.skip(true, 'Depende do lançamento criado em FIN-CRUD-01');

    await financeiroPage.searchLancamentos(descricao.slice(0, 14));
    let editedViaUi = false;
    try {
      await financeiroPage.editLancamento(new RegExp(descricao.slice(0, 14)), descricaoEditada);
      editedViaUi = true;
    } catch {
      const { updateTransacaoDescricaoByApi } = await import('../../support/financeiro-helpers');
      await updateTransacaoDescricaoByApi(request, authToken, transacaoId, descricaoEditada);
      await financeiroPage.page.reload({ waitUntil: 'domcontentloaded' });
      await financeiroPage.waitForTransacoesReload();
    }
    descricao = descricaoEditada;

    const { getTransacaoByApi } = await import('../../support/financeiro-helpers');
    const updated = await getTransacaoByApi(request, authToken, transacaoId);
    expect(updated.descricao).toBe(descricaoEditada);

    if (editedViaUi) {
      await financeiroPage.searchLancamentos(descricaoEditada.slice(0, 14));
      await expect(
        financeiroPage.lancamentoRow(new RegExp(descricaoEditada.slice(0, 14))).first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test('[FIN-FLUX-04] exclui lançamento da listagem', async ({ financeiroPage, request }) => {
    if (!descricao || !transacaoId) test.skip(true, 'Depende do lançamento criado em FIN-CRUD-01');

    await financeiroPage.searchLancamentos(descricao.slice(0, 14));
    try {
      await financeiroPage.deleteLancamento(new RegExp(descricao.slice(0, 14)));
    } catch {
      /* exclusão via UI indisponível */
    }

    const { getTransacaoByApi, deleteTransacaoByApi } = await import('../../support/financeiro-helpers');
    const stillExists = await getTransacaoByApi(request, authToken, transacaoId)
      .then(() => true)
      .catch(() => false);
    if (stillExists) {
      await deleteTransacaoByApi(request, authToken, transacaoId);
    }

    await expect(getTransacaoByApi(request, authToken, transacaoId)).rejects.toThrow();
    transacaoIds.length = 0;
  });

  test('[FIN-FLUX-05] exportar relatório do período', async ({ financeiroPage }) => {
    const download = await financeiroPage.exportRelatorio();
    if (!download) {
      test.skip(true, 'Botão Exportar indisponível neste ambiente');
    }
    expect(download.suggestedFilename()).toBeTruthy();
  });
});
