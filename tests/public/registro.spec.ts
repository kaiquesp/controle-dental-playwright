import { test, expect } from '../fixtures/test.fixture';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Registro trial', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/registro');
  });

  test('[PUB-REG-01] exibe formulário de cadastro trial', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Crie sua clínica/i })).toBeVisible();
    await expect(page.locator('#trial-empresa, input[name="trial-empresa"]')).toBeVisible();
    await expect(page.locator('#trial-email, input[name="trial-email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Começar teste grátis/i })).toBeVisible();
  });

  test('[PUB-REG-02] valida senha com menos de 8 caracteres', async ({ page }) => {
    await page.locator('#trial-empresa, input[name="trial-empresa"]').fill('Clínica Teste E2E');
    await page.locator('#trial-admin-nome, input[name="trial-admin-nome"]').fill('Admin Teste');
    await page.locator('#trial-email, input[name="trial-email"]').fill(`e2e-${Date.now()}@teste.com`);
    await page.locator('#trial-celular, input[name="trial-celular"]').fill('11999999999');
    await page.locator('#trial-senha, input[name="trial-senha"]').fill('1234567');
    await expect(page.getByRole('button', { name: /Começar teste grátis/i })).toBeDisabled();
    await expect(page).toHaveURL(/\/registro/);
  });

  test('[PUB-REG-04] navega para login', async ({ page }) => {
    await page.getByRole('link', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
