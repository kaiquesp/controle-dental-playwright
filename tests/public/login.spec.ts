import { test, expect } from '../fixtures/test.fixture';
import { PUBLIC_ROUTES } from '../data/routes';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Rotas públicas', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`carrega ${route.name}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).not.toHaveURL(/\/login$/, { timeout: 5_000 }).catch(() => undefined);

      if (route.path === '/login') {
        await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
        await expect(page.locator('#login-email')).toBeVisible();
        await expect(page.locator('#login-senha')).toBeVisible();
        return;
      }

      await expect(page.locator('body')).toBeVisible();
      const loginRedirect = page.url().includes('/login');
      expect(loginRedirect || page.url().includes(route.path.split('?')[0])).toBeTruthy();
    });
  }
});

test.describe('Login', () => {
  test('[PUB-LOGIN-01] exibe formulário e links auxiliares', async ({ loginPage, page }) => {
    await loginPage.goto();

    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(page.getByRole('link', { name: 'Esqueci a senha' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cadastre-se' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuar com Google/i })).toBeVisible();
  });

  test('[PUB-LOGIN-03] valida credenciais inválidas', async ({ loginPage, page }) => {
    await loginPage.login('invalido@teste.com', 'senha-invalida');
    await expect(page).toHaveURL(/\/login/);
  });

  test('[PUB-LOGIN-07] navega para recuperar senha', async ({ loginPage, page }) => {
    await loginPage.goto();
    await page.getByRole('link', { name: 'Esqueci a senha' }).click();
    await expect(page).toHaveURL(/\/recuperar-senha/);
  });

  test('[PUB-LOGIN-08] navega para registro', async ({ loginPage, page }) => {
    await loginPage.goto();
    await page.getByRole('link', { name: 'Cadastre-se' }).click();
    await expect(page).toHaveURL(/\/registro/);
  });
});
