import { test, expect } from '../fixtures/test.fixture';

test.describe('Estoque — smoke', () => {
  test.beforeEach(async ({ appShell, estoquePage }) => {
    await appShell.navigateTo('/estoque');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await estoquePage.waitForMateriaisReload();
  });

  test('[EST-MAP] mapeamento da tela de estoque', async ({ estoquePage }) => {
    await estoquePage.expectScreenMap();
  });

  test('[EST-01] carrega dashboard e listagem', async ({ page, estoquePage, appShell }) => {
    await expect(page).toHaveURL(/\/estoque/);
    await expect(appShell.sidebar.getByRole('link', { name: /Estoque/i })).toBeVisible();
    await estoquePage.expectKpis();
    await expect(page.getByRole('heading', { name: /Itens em estoque/i })).toBeVisible();
  });

  test('[EST-02] exibe botão novo material e abre modal', async ({ estoquePage }) => {
    await expect(estoquePage.novoMaterialButton).toBeVisible();
    await estoquePage.openNovoMaterial();
    await expect(estoquePage.page.locator('#nm-nome')).toBeVisible();
    await estoquePage.cancelMaterialModal();
  });

  test('[EST-03] exportar inventário ou recurso indisponível', async ({ estoquePage }) => {
    const download = await estoquePage.exportInventario();
    if (!download) {
      test.skip(true, 'Botão Exportar indisponível nesta versão da tela');
    }
    expect(download.suggestedFilename()).toBeTruthy();
  });

  test('[EST-04] exibe colunas da tabela ou estado vazio', async ({ page, estoquePage }) => {
    const empty = page.getByText(/Nenhum material cadastrado/i);
    if (await empty.isVisible().catch(() => false)) {
      await expect(empty).toBeVisible();
      return;
    }
    await estoquePage.expectTableHeaders();
  });
});
