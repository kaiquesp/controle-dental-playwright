import { test, expect } from '../fixtures/test.fixture';

const AGENDA_VIEWS = ['Dia', 'Semana', 'Mês'] as const;

test.describe('Agenda', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[AG-01] carrega a tela da agenda', async ({ page }) => {
    await expect(page).toHaveURL(/\/agenda/);
    await expect(page.locator('.agenda-screen, app-agenda-content').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Novo agendamento/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hoje', exact: true })).toBeVisible();
  });

  test('[AG-13] mantém sessão ao recarregar', async ({ page }) => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/agenda/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  for (const view of AGENDA_VIEWS) {
    test(`[AG-02] alterna visualização ${view}`, async ({ page }) => {
      const button = page.getByRole('button', { name: view, exact: true });
      await expect(button).toBeVisible();
      await button.click();
      await expect(page.locator('.agenda-screen, app-agenda-content').first()).toBeVisible();
    });
  }

  test('[AG-03] botão Hoje retorna ao período atual', async ({ page }) => {
    await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await expect(page.locator('.agenda-screen, app-agenda-content').first()).toBeVisible();
  });

  test('[AG-04] navega entre períodos anterior e próximo', async ({ page }) => {
    const heading = page.locator('h2').filter({ hasText: /\d+/ }).first();
    await expect(heading).toBeVisible();
    const before = await heading.textContent();
    await page.getByRole('button', { name: 'Próximo' }).click();
    await expect(heading).not.toHaveText(before ?? '', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Anterior' }).click();
  });

  test('[AG-07] abre modal de novo agendamento', async ({ page }) => {
    await page.getByRole('button', { name: /Novo agendamento/i }).first().click();
    await expect(page.locator('[role="dialog"]:visible, .p-dialog:visible, form').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('[AG-12] abre configurações da agenda', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: 'Configurações da agenda' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    await expect(page).toHaveURL(/\/agenda/);
  });
});
