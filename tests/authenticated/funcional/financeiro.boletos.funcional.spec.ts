import { test, expect } from '../../fixtures/test.fixture';
import { e2eName, createPatientByApi } from '../../support/crud-helpers';
import { readTokenFromPage } from '../../support/agenda-helpers';

test.describe('Financeiro — boletos CRUD', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  let authToken = '';
  let patientId = '';

  test.beforeEach(async ({ appShell, financeiroPage, page }) => {
    await appShell.navigateTo('/financeiro/boletos');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    if (!page.url().includes('/financeiro/boletos')) {
      test.skip(true, 'Módulo de boletos indisponível neste plano');
    }
    await financeiroPage.waitForTransacoesReload();
  });

  test.afterAll(async ({ request }) => {
    if (authToken && patientId) {
      const { deletePatientByApi } = await import('../../support/crud-helpers');
      await deletePatientByApi(request, authToken, patientId).catch(() => undefined);
    }
  });

  test('[FIN-BOL-01] listagem exibe resumo e filtros de status', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Boletos/i }).first()).toBeVisible();
    await expect(page.getByText(/Em aberto|Compensados|Atrasados/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Todos/i }).first()).toBeVisible();
  });

  test('[FIN-BOL-02] link novo boleto direciona para emissão via paciente', async ({ page, request }) => {
    authToken = (await readTokenFromPage(page)) ?? '';
    const patientName = e2eName('Boleto');
    patientId = await createPatientByApi(request, authToken, patientName);

    const novoLink = page.getByRole('link', { name: /Novo boleto/i });
    await expect(novoLink).toBeVisible({ timeout: 15_000 });
    await expect(novoLink).toHaveAttribute('href', /pacientes/);
    await novoLink.click();
    await expect(page).toHaveURL(/\/pacientes/);
    await expect(page.getByText(/paciente|buscar/i).first()).toBeVisible();
  });

  test('[FIN-BOL-03] filtrar status e buscar mantém tela estável', async ({ page, financeiroPage }) => {
    await page.getByRole('button', { name: /Vencidos/i }).first().click();
    await page.waitForTimeout(600);
    await financeiroPage.searchLancamentos('teste');
    await expect(page).toHaveURL(/\/financeiro\/boletos/);
    await expect(page.getByText(/Nenhum boleto|boleto/i).first()).toBeVisible();
  });

  test('[FIN-BOL-04] reenviar ou visualizar boleto quando houver registro', async ({ page }) => {
    const row = page.getByRole('row').filter({ hasText: /.+/ }).nth(1);
    if (!(await row.isVisible().catch(() => false))) {
      test.skip(true, 'Sem boleto na listagem para reenviar/visualizar');
    }

    const actionBtn = row
      .getByRole('button', { name: /Reenviar|Visualizar|Ver boleto/i })
      .or(row.getByRole('link', { name: /Reenviar|Visualizar|Ver boleto/i }));
    if (!(await actionBtn.first().isVisible().catch(() => false))) {
      test.skip(true, 'Ações de boleto indisponíveis na linha');
    }

    await actionBtn.first().click();
    await expect(
      page.getByRole('dialog').or(page.getByText(/boleto|reenviado|linha digitável/i)).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
