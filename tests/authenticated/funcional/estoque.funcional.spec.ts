import { test, expect } from '../../fixtures/test.fixture';
import { e2eName } from '../../support/crud-helpers';

test.describe('Estoque — interações e filtros', () => {
  test.beforeEach(async ({ appShell, estoquePage }) => {
    await appShell.navigateTo('/estoque');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await estoquePage.waitForMateriaisReload();
  });

  test('[EST-02] modal novo material exibe campos obrigatórios e cancela', async ({ estoquePage, page }) => {
    await estoquePage.openNovoMaterial();
    await expect(page.locator('#nm-nome')).toBeVisible();
    await expect(page.locator('#nm-cat')).toBeVisible();
    await expect(page.locator('#nm-qtd')).toBeVisible();
    await expect(page.locator('#nm-un')).toBeVisible();
    await expect(page.locator('#nm-min')).toBeVisible();
    await expect(page.getByRole('button', { name: /Salvar material/i })).toBeVisible();
    await estoquePage.cancelMaterialModal();
  });

  test('[EST-FLT-01] filtro por categoria mantém tela estável', async ({ estoquePage, page }) => {
    await estoquePage.setFilterCategoria(/Consumíveis/i);
    await expect(page.getByRole('heading', { name: /Itens em estoque/i })).toBeVisible();
    await estoquePage.expectKpis();
    await estoquePage.resetFilters();
  });

  test('[EST-FLT-02] filtro por status mantém tela estável', async ({ estoquePage, page }) => {
    await estoquePage.setFilterStatus(/Estoque baixo/i);
    await expect(page.getByRole('heading', { name: /Itens em estoque/i })).toBeVisible();
    await estoquePage.resetFilters();
  });

  test('[EST-CRUD-UI-01] preenche modal novo material via UI e cancela', async ({ estoquePage }) => {
    const nome = e2eName('MaterialUI');
    await estoquePage.openNovoMaterial();
    await estoquePage.fillMaterial({
      nome,
      codigo: `COD-${Date.now()}`,
      categoria: /Consumíveis/i,
      quantidade: '5',
      unidade: 'Unidade',
      minimo: '2',
      descricao: 'Material E2E UI',
    });
    await expect(estoquePage.materialDialog().locator('#nm-nome')).toHaveValue(nome);
    await estoquePage.cancelMaterialModal();
  });
});
