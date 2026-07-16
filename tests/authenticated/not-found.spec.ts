import { test, expect } from '../fixtures/test.fixture';
import { UNKNOWN_ROUTE } from '../pages/not-found.page';

test.describe('Erro 404 — autenticado', () => {
  test('[AUTH-404-01] rota inexistente exibe tela 404 com atalhos da clínica', async ({
    page,
    appShell,
    notFoundPage,
  }) => {
    await appShell.navigateTo('/agenda');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();

    await notFoundPage.goto();

    await expect(page).toHaveURL(new RegExp(`${UNKNOWN_ROUTE.replace(/\//g, '\\/')}$`));
    await notFoundPage.expectVisible();
    await notFoundPage.expectRocketIllustration();
    await notFoundPage.expectAuthenticatedQuickLinks();
  });

  test('[AUTH-404-02] Ir para a página inicial volta à agenda', async ({
    page,
    appShell,
    notFoundPage,
  }) => {
    await appShell.navigateTo('/agenda');
    await appShell.dismissBlockingModals();

    await notFoundPage.goto();
    await notFoundPage.goHomeButton.click();

    await expect(page).toHaveURL(/\/(agenda|configuracoes|setup-inicial)/);
    await expect(page.locator('.not-found-page')).toHaveCount(0);
  });

  test('[AUTH-404-03] atalho Agenda navega para a agenda', async ({
    page,
    appShell,
    notFoundPage,
  }) => {
    await appShell.navigateTo('/agenda');
    await appShell.dismissBlockingModals();

    await notFoundPage.goto();
    await notFoundPage.quickLinks.getByRole('button', { name: /^Agenda$/i }).click();

    await expect(page).toHaveURL(/\/agenda/);
    await appShell.expectAuthenticatedShell();
  });
});
