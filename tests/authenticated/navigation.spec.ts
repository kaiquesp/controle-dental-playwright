import { test, expect } from '../fixtures/test.fixture';
import { AUTHENTICATED_ROUTES, SIDEBAR_MENU_ITEMS } from '../data/routes';

const FEATURE_GATED_FINANCEIRO_PATHS = new Set(['/financeiro/boletos', '/financeiro/notas-fiscais']);

test.describe('Navegação autenticada — sidebar', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  for (const item of SIDEBAR_MENU_ITEMS) {
    test(`navega para ${item.label} via sidebar`, async ({ page, appShell }) => {
      await appShell.clickSidebarItem(item.label, item.pathPattern);
      await appShell.expectAuthenticatedShell();
      await expect(page).toHaveURL(item.pathPattern);
      await expect(page.locator('body')).not.toContainText('403 Forbidden');
    });
  }
});

test.describe('Rotas autenticadas principais', () => {
  for (const route of AUTHENTICATED_ROUTES) {
    test(`carrega ${route.name}`, async ({ page, appShell }) => {
      await appShell.navigateTo(route.path);
      await appShell.dismissBlockingModals();

      if (page.url().includes('/login')) {
        throw new Error(`Redirecionado para login ao acessar ${route.path}`);
      }

      if (route.moduleId === 'comissoes') {
        expect(page.url()).not.toContain('/login');
        return;
      }

      if (FEATURE_GATED_FINANCEIRO_PATHS.has(route.path) && !page.url().includes(route.path)) {
        await expect(page).toHaveURL(/\/financeiro/);
        await expect(page.locator('body')).toBeVisible();
        return;
      }

      await expect(page).toHaveURL(new RegExp(route.path.replace(/\//g, '\\/')));
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).not.toContainText('403 Forbidden');
    });
  }
});
