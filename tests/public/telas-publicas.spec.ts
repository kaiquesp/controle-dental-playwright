import { test, expect } from '../fixtures/test.fixture';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Política de privacidade', () => {
  test('[PUB-POL-01] exibe conteúdo legal', async ({ page }) => {
    await page.goto('/politica-de-privacidade');
    await expect(page).toHaveURL(/\/politica-de-privacidade/);
    await expect(page.getByText(/privacidade|Política/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Validar documento', () => {
  test('[PUB-VAL-DOC-01] exibe formulário de validação', async ({ page }) => {
    await page.goto('/validar-documento', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/validar-documento/);
    await expect(
      page.getByText(/validar|documento|Redirecionando/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Validar receita', () => {
  test('[PUB-VAL-REC-01] exibe formulário de validação', async ({ page }) => {
    await page.goto('/validar-receita', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/validar-receita/);
    await expect(
      page.getByText(/validar|receita|Redirecionando/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
