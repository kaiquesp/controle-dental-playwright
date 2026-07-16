import { test, expect } from '../fixtures/test.fixture';
import { UNKNOWN_ROUTE } from '../pages/not-found.page';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Erro 404 — visitante', () => {
  test('[PUB-404-01] rota inexistente exibe tela amigável com foguete', async ({
    page,
    notFoundPage,
  }) => {
    await notFoundPage.goto();

    await expect(page).toHaveURL(new RegExp(`${UNKNOWN_ROUTE.replace(/\//g, '\\/')}$`));
    await notFoundPage.expectVisible();
    await notFoundPage.expectRocketIllustration();
    await notFoundPage.expectGuestQuickLinks();
  });

  test('[PUB-404-02] Ir para a página inicial leva ao login', async ({ page, notFoundPage }) => {
    await notFoundPage.goto();
    await notFoundPage.goHomeButton.click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
  });

  test('[PUB-404-03] atalho Entrar navega para login', async ({ page, notFoundPage }) => {
    await notFoundPage.goto();
    await notFoundPage.quickLinks.getByRole('button', { name: /Entrar/i }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test('[PUB-404-04] Voltar retorna à página anterior', async ({ page, notFoundPage }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();

    await notFoundPage.goto();
    await notFoundPage.goBackButton.click();

    await expect(page).toHaveURL(/\/login/);
  });
});
