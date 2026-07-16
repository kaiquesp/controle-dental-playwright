import { test, expect } from '../fixtures/test.fixture';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Recuperar senha', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recuperar-senha');
  });

  test('[PUB-REC-01] exibe formulário de recuperação', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Esqueceu sua senha/i })).toBeVisible();
    await expect(page.locator('#recuperar-email, input[name="recuperar-email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  });

  test('[PUB-REC-03] volta para login', async ({ page }) => {
    await page.getByRole('link', { name: /Voltar para o Login/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
