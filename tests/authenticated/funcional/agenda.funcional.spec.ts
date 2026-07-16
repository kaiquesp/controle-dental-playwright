import { test, expect } from '../../fixtures/test.fixture';
import {
  closeDialog,
  expectDialogHasFormFields,
  expectDialogOpen,
  visibleDialog,
} from '../../support/interaction-helpers';

test.describe('Agenda — interações e modais', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[AG-05] abre filtro de profissionais', async ({ page }) => {
    const filter = page.getByRole('button', { name: /Todos os profissionais/i });
    await expect(filter).toBeVisible();
    await filter.click();
    await expect(filter).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('[AG-06] abre painel de outros filtros', async ({ page }) => {
    await page.getByRole('button', { name: /Outros filtros/i }).click();
    await expect(page.getByText(/Status|Sala/i).first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('[AG-07] modal novo agendamento exibe formulário e cancela', async ({ page }) => {
    await page.getByRole('button', { name: /Novo agendamento/i }).first().click();
    const dialog = await expectDialogOpen(page, /agendamento|paciente|horário|data/i);
    await expectDialogHasFormFields(dialog, 1);
    await closeDialog(page);
    await expect(visibleDialog(page)).toBeHidden();
    await expect(page).toHaveURL(/\/agenda/);
  });

  test('[AG-08] slot horário abre formulário de agendamento', async ({ page }) => {
    const slot = page.getByRole('button', { name: /Novo agendamento às/i }).first();
    await expect(slot).toBeVisible();
    await slot.click();
    const dialog = await expectDialogOpen(page);
    await expectDialogHasFormFields(dialog, 1);
    await closeDialog(page);
  });

  test('[AG-12] configurações da agenda exibe painel', async ({ page }) => {
    await page.getByRole('button', { name: 'Configurações da agenda' }).click();
    await expect(
      page.locator('main, [role="dialog"]').getByText(/horário|expediente|agenda|configura/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
  });

  test('[AG-04] período anterior altera título e retorna com Hoje', async ({ page }) => {
    const heading = page.locator('main h2').filter({ hasText: /\d+/ }).first();
    const initial = await heading.textContent();
    await page.getByRole('button', { name: 'Anterior' }).click();
    await expect(heading).not.toHaveText(initial ?? '', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await expect(page.locator('.agenda-screen, app-agenda-content').first()).toBeVisible();
  });

  test('[AG-14] modal novo agendamento alterna abas Consulta / Compromisso / Tarefa', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Novo agendamento/i }).first().click();
    const dialog = await expectDialogOpen(page);
    const tablist = dialog.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();
    for (const tab of ['Consulta', 'Compromisso', 'Tarefa'] as const) {
      await tablist.getByRole('button', { name: tab, exact: true }).click();
      await expect(tablist.locator('.agenda-schedule-modal__tab--active')).toHaveText(tab);
    }
    await closeDialog(page);
  });

  test('[AG-15] painel Visualização da agenda lista opções de grade', async ({ page }) => {
    await page.getByRole('button', { name: 'Visualização da agenda' }).click();
    const panel = page.locator('#agenda-grade-view-options-panel, [aria-label="Visualização da agenda"]');
    await expect(panel.getByText(/Visualização compacta|Ocultar sábado|Ocultar domingo/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press('Escape');
  });

  test('[AG-16] botão Imprimir agenda permanece na tela sem sair da rota', async ({ page }) => {
    const printBtn = page.getByRole('button', { name: 'Imprimir agenda' });
    await expect(printBtn).toBeVisible();
    await expect(page).toHaveURL(/\/agenda/);
  });
});
