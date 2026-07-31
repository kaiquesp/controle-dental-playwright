import { test, expect } from '../fixtures/test.fixture';

test.describe('Relatórios', () => {
  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/relatorios');
    await appShell.dismissBlockingModals();
  });

  test('[REL-01] carrega hub de relatórios', async ({ page }) => {
    await expect(page).toHaveURL(/\/relatorios/);
    await expect(page.locator('app-relatorios-content, .relatorios').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: /Relatórios/i }).first()).toBeVisible();
  });

  test('[REL-02] exibe busca de relatórios', async ({ page }) => {
    await expect(page.getByPlaceholder(/Buscar relatório/i).first()).toBeVisible();
  });

  test('[REL-04] exibe exportar tudo', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Exportar tudo/i })).toBeVisible();
  });

  test('[REL-05] exibe gráfico faturamento x custos', async ({ page }) => {
    await expect(page.getByText(/Faturamento x custos/i)).toBeVisible();
  });
});
