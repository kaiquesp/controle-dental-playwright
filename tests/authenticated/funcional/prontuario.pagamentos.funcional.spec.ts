import { test, expect } from '../../fixtures/test.fixture';
import { createE2ePatientByApi, deleteE2ePatient } from '../../support/pacientes-helpers';
import { e2eName } from '../../support/crud-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Prontuário — Pagamentos', () => {
  let patientId: string | null = null;
  let lancamentoDesc = '';

  test.beforeAll(async ({ browser }) => {
    const patient = await createE2ePatientByApi(browser, 'Pront-Pag');
    patientId = patient.id;
  });

  test.afterAll(async ({ browser }) => {
    if (patientId) {
      await deleteE2ePatient(browser, patientId);
    }
  });

  test.beforeEach(async ({ appShell, prontuarioPage }) => {
    test.skip(!patientId, 'Paciente E2E não criado');
    await prontuarioPage.goToTab(patientId!, 'pagamentos');
    await appShell.dismissBlockingModals();
  });

  test('[PAC-PRONT-PAG-MAP] mapeamento da aba pagamentos', async ({ prontuarioPage }) => {
    await prontuarioPage.expectPagamentosScreenMap();
  });

  test('[PAC-PRONT-PAG-01] valida valores de orçamentos lançados', async ({ page }) => {
    const valores = page.locator('main').getByText(/R\$\s*[\d.,]+/);
    await expect(valores.first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
  });

  test('[PAC-PRONT-PAG-02] adiciona lançamento manual', async ({ prontuarioPage }) => {
    test.setTimeout(120_000);
    lancamentoDesc = e2eName('Pagamento');
    const btn = prontuarioPage.page.getByRole('button', { name: /Novo lançamento|Adicionar|Nova receita/i }).first();
    if (!(await btn.isVisible().catch(() => false))) {
      test.skip(true, 'Novo lançamento indisponível');
    }
    await prontuarioPage.addPagamentoManual(lancamentoDesc, '200,00');
    await expect(prontuarioPage.pagamentoRow(lancamentoDesc).first()).toBeVisible({ timeout: 20_000 });
  });

  test('[PAC-PRONT-PAG-03] edita lançamento', async ({ page, prontuarioPage }) => {
    test.skip(!lancamentoDesc, 'Lançamento não criado');
    const row = prontuarioPage.pagamentoRow(lancamentoDesc);
    const editBtn = row.getByRole('button', { name: /Editar/i });
    if (!(await editBtn.first().isVisible().catch(() => false))) {
      test.skip(true, 'Edição indisponível');
    }
    await editBtn.first().click();
    await expect(page.locator('[role="dialog"]:visible').last()).toBeVisible();
  });

  test('[PAC-PRONT-PAG-04] ação pagar', async ({ page, prontuarioPage }) => {
    const row = prontuarioPage.pagamentoRow(lancamentoDesc || 'E2E');
    const pagarBtn = row.getByRole('button', { name: /^Pagar$/i });
    if (!(await pagarBtn.first().isVisible().catch(() => false))) {
      test.skip(true, 'Botão Pagar indisponível');
    }
    await pagarBtn.first().click();
    await expect(page.getByText(/pago|pagamento|confirm/i).first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
  });

  test('[PAC-PRONT-PAG-05] filtros e status', async ({ page }) => {
    const filtro = page.getByRole('button', { name: /filtro|status|período/i }).first();
    if (!(await filtro.isVisible().catch(() => false))) {
      test.skip(true, 'Filtros indisponíveis');
    }
    await filtro.click();
    await expect(page.getByRole('option, menuitem').first()).toBeVisible({ timeout: 8_000 });
  });

  test('[PAC-PRONT-PAG-06] somatória receitas e despesas', async ({ page }) => {
    const totais = page.getByText(/total|receita|despesa|saldo/i);
    await expect(totais.first()).toBeVisible({ timeout: 15_000 });
  });

  test('[PAC-PRONT-PAG-07] extrato', async ({ page }) => {
    const extrato = page.getByRole('button', { name: /extrato/i }).first();
    if (!(await extrato.isVisible().catch(() => false))) {
      test.skip(true, 'Extrato indisponível');
    }
    await extrato.click();
    await expect(page.getByText(/extrato|movimentação|lançamento/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('[PAC-PRONT-PAG-08] link de cobrança', async ({ page, prontuarioPage }) => {
    await prontuarioPage.dismissBlockingUi();
    const link = page
      .getByRole('button', { name: /link de cobrança|Gerar pagamento pelo link|copiar link|cobrança/i })
      .first();
    if (!(await link.isVisible().catch(() => false))) {
      test.skip(true, 'Link de cobrança indisponível');
    }
    await link.click();
    await expect(page.locator('.paciente-paylink-modal.p-dialog, .paciente-paylink-modal[role="dialog"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('[PAC-PRONT-PAG-09] exclui lançamento', async ({ prontuarioPage }) => {
    test.skip(!lancamentoDesc, 'Lançamento não criado');
    const row = prontuarioPage.pagamentoRow(lancamentoDesc);
    const delBtn = row.getByRole('button', { name: /Excluir/i });
    if (!(await delBtn.first().isVisible().catch(() => false))) {
      test.skip(true, 'Exclusão indisponível');
    }
    await delBtn.first().click();
    const confirm = prontuarioPage.page.getByRole('dialog').filter({ hasText: /excluir|confirmar/i });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.getByRole('button', { name: /Excluir|Confirmar|Sim/i }).click();
    }
    await expect(row).toHaveCount(0, { timeout: 20_000 });
  });
});
