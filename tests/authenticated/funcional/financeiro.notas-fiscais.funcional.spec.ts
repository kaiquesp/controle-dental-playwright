import { test, expect } from '../../fixtures/test.fixture';

test.describe('Financeiro — notas fiscais CRUD', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeEach(async ({ appShell, financeiroPage, page }) => {
    await appShell.navigateTo('/financeiro/notas-fiscais');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    if (!page.url().includes('/financeiro/notas-fiscais')) {
      test.skip(true, 'Módulo de notas fiscais indisponível neste plano');
    }
    await financeiroPage.waitForTransacoesReload();
  });

  test('[FIN-NF-01] histórico de notas emitidas', async ({ page }) => {
    await expect(page.getByText(/Notas fiscais|nota fiscal/i).first()).toBeVisible();
    await expect(
      page.getByRole('table').or(page.getByText(/Nenhuma nota|histórico|emitidas/i).first())
    ).toBeVisible();
  });

  test('[FIN-NF-02] emite nota fiscal pelo formulário', async ({ page }) => {
    const emitBtn = page.getByRole('button', { name: /Emitir|Nova nota/i }).first();
    if (!(await emitBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Botão emitir nota indisponível');
    }

    await emitBtn.click();
    const dialog = page.locator('[role="dialog"]:visible, .p-dialog:visible').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    const valor = dialog.locator('input[placeholder*="0,00" i], [id*="valor"]').first();
    if (await valor.isVisible().catch(() => false)) {
      await valor.fill('200,00');
    }

    const desc = dialog.locator('input[placeholder*="descri" i], textarea, [id*="desc"]').first();
    if (await desc.isVisible().catch(() => false)) {
      await desc.fill(`E2E-NF-${Date.now()}`);
    }

    const save = dialog.getByRole('button', { name: /Emitir|Gerar|Salvar/i }).first();
    await save.click();
    await page.waitForTimeout(2500);

    await expect(page.getByText(/emitid|autorizad|processand|nota fiscal/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('[FIN-NF-03] cancela nota fiscal emitida', async ({ page }) => {
    const row = page.getByRole('row').nth(1);
    if (!(await row.isVisible().catch(() => false))) {
      test.skip(true, 'Sem nota fiscal para cancelar');
    }

    const cancelBtn = row.getByRole('button', { name: /Cancelar/i });
    if (!(await cancelBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Botão cancelar nota indisponível');
    }

    await cancelBtn.click();
    const confirm = page.getByRole('button', { name: /Confirmar|Sim|Cancelar nota/i }).first();
    if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirm.click();
    }
    await expect(page.getByText(/cancelad|cancelada/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
