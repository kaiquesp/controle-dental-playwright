import { test, expect } from '../../fixtures/test.fixture';
test.describe('Relatórios — interações', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/relatorios');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test('[REL-03] busca por nome filtra sem erro', async ({ page, appShell }) => {
    await appShell.dismissBlockingModals();
    const search = page.getByRole('searchbox', { name: /Buscar relatório/i });
    await expect(search).toBeVisible({ timeout: 15_000 });
    await search.fill('paciente');
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/relatorios/);
    await expect(page.getByRole('heading', { name: /Relatórios/i }).first()).toBeVisible();
  });
});
