import { test, expect } from '../fixtures/test.fixture';

test.describe('Shell autenticado', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/agenda');
    await appShell.dismissBlockingModals();
  });

  test('[SHELL-02] logo retorna ao início', async ({ page }) => {
    await page.locator('app-sidebar a.dc-brand-logo, app-sidebar a[href="/"]').first().click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('[SHELL-03] exibe menu do usuário', async ({ page }) => {
    await expect(page.getByRole('button', { name: /admin/i }).first()).toBeVisible();
  });

  test('[SHELL-04] exibe botão de notificações', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Notificações' })).toBeVisible();
  });

  test('[SHELL-05] exibe chat de suporte', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Abrir chat de suporte/i })).toBeVisible();
  });
});
