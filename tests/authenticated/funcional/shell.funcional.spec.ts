import { test, expect } from '../../fixtures/test.fixture';
import { SIDEBAR_MENU_ITEMS } from '../../data/routes';

test.describe('Shell — interações de navegação', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[SHELL-FUNC-01] menu do usuário abre opções', async ({ page }) => {
    await page.getByRole('button', { name: /admin/i }).first().click();
    await expect(page.locator('[role="menu"], .p-menu, .p-tieredmenu:visible').first()).toBeVisible({
      timeout: 5_000,
    });
    await page.keyboard.press('Escape');
  });

  test('[SHELL-FUNC-02] notificações abre painel', async ({ page }) => {
    await page.getByRole('button', { name: 'Notificações' }).click();
    await expect(
      page.locator('.p-overlaypanel:visible, [role="dialog"]:visible, .notifications-panel:visible').first()
    ).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('[SHELL-FUNC-03] sidebar navega entre módulos principais', async ({ page, appShell }) => {
    for (const item of SIDEBAR_MENU_ITEMS.slice(0, 4)) {
      await appShell.navigateViaSidebar(item.label);
      await expect(page).toHaveURL(item.pathPattern);
      await appShell.dismissBlockingModals();
    }
  });

  test('[SHELL-FUNC-04] chat de suporte está acessível', async ({ page }) => {
    const chatBtn = page.getByRole('button', { name: /Abrir chat de suporte/i });
    await expect(chatBtn).toBeVisible();
    await expect(chatBtn).toBeEnabled();
  });
});
