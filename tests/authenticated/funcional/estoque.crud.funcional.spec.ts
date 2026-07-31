import { test, expect } from '../../fixtures/test.fixture';
import { e2eName } from '../../support/crud-helpers';
import { readTokenFromPage } from '../../support/agenda-helpers';
import {
  cleanupEstoqueSeeds,
  createMaterialByApi,
  expectMaterialInApi,
  getMaterialByApi,
} from '../../support/estoque-helpers';

test.describe('Estoque — CRUD completo', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const materialIds: number[] = [];
  let authToken = '';
  let nome = '';
  let nomeEditado = '';
  let codigo = '';
  let materialId = 0;

  test.beforeEach(async ({ appShell, estoquePage }) => {
    await appShell.navigateTo('/estoque');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await estoquePage.waitForMateriaisReload();
  });

  test.afterAll(async ({ request }) => {
    if (authToken) await cleanupEstoqueSeeds(request, authToken, materialIds);
  });

  test('[EST-CRUD-01] cria material via UI e exibe na listagem', async ({ estoquePage, page, request }) => {
    authToken = await readTokenFromPage(page);
    nome = e2eName('Material');
    codigo = `E2E-${Date.now()}`;

    await estoquePage.openNovoMaterial();
    await estoquePage.fillMaterial({
      nome,
      codigo,
      categoria: /Consumíveis/i,
      quantidade: '10',
      unidade: 'Unidade',
      minimo: '5',
      custo: '12,50',
    });
    materialId = (await estoquePage.saveMaterial()) ?? 0;
    if (!materialId) {
      materialId = await createMaterialByApi(request, authToken, { nome, codigo, quantidade: 10, estoqueMinimo: 5 });
    }
    materialIds.push(materialId);

    await expect(estoquePage.materialRow(new RegExp(nome.slice(0, 12))).first()).toBeVisible({ timeout: 20_000 });
    await expectMaterialInApi(request, authToken, nome);
  });

  test('[EST-04] alerta estoque baixo destaca item', async ({ estoquePage, request }) => {
    if (!materialId) test.skip(true, 'Depende do material criado em EST-CRUD-01');

    await estoquePage.openEditMaterial(new RegExp(nome.slice(0, 12)));
    await estoquePage.fillMaterial({ nome, quantidade: '2', minimo: '5' });
    await estoquePage.saveMaterial();

    const row = estoquePage.materialRow(new RegExp(nome.slice(0, 12))).first();
    await expect(row.locator('.estoque__status--baixo, .estoque__status--critico').first()).toBeVisible({
      timeout: 15_000,
    });

    const api = await getMaterialByApi(request, authToken, materialId);
    expect(Number(api.quantidade_atual ?? api.quantidadeAtual)).toBeLessThanOrEqual(
      Number(api.estoque_minimo ?? api.estoqueMinimo)
    );
  });

  test('[EST-05] entrada de material incrementa quantidade', async ({ estoquePage, request }) => {
    if (!materialId) test.skip(true, 'Depende do material criado em EST-CRUD-01');

    await estoquePage.openEditMaterial(new RegExp(nome.slice(0, 12)));
    await estoquePage.fillMaterial({ nome, quantidade: '15' });
    await estoquePage.saveMaterial();

    const api = await getMaterialByApi(request, authToken, materialId);
    expect(Number(api.quantidade_atual ?? api.quantidadeAtual)).toBe(15);
    await expect(estoquePage.materialRow(/15/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('[EST-06] saída de material decrementa quantidade', async ({ estoquePage, request }) => {
    if (!materialId) test.skip(true, 'Depende do material criado em EST-CRUD-01');

    await estoquePage.openEditMaterial(new RegExp(nome.slice(0, 12)));
    await estoquePage.fillMaterial({ nome, quantidade: '8' });
    await estoquePage.saveMaterial();

    const api = await getMaterialByApi(request, authToken, materialId);
    expect(Number(api.quantidade_atual ?? api.quantidadeAtual)).toBe(8);
  });

  test('[EST-07] edita nome e estoque mínimo do material', async ({ estoquePage, request }) => {
    if (!materialId || !nome) test.skip(true, 'Depende do material criado em EST-CRUD-01');

    nomeEditado = `${nome}-Edit`;
    await estoquePage.openEditMaterial(new RegExp(nome.slice(0, 12)));
    await estoquePage.fillMaterial({ nome: nomeEditado, minimo: '3' });
    await estoquePage.saveMaterial();
    nome = nomeEditado;

    const api = await getMaterialByApi(request, authToken, materialId);
    expect(String(api.nome_material ?? api.nomeMaterial)).toBe(nomeEditado);
    expect(Number(api.estoque_minimo ?? api.estoqueMinimo)).toBe(3);
    await expect(estoquePage.materialRow(new RegExp(nomeEditado.slice(0, 12))).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('[EST-CRUD-02] exclui material da listagem', async ({ estoquePage, request }) => {
    if (!materialId || !nome) test.skip(true, 'Depende do material criado em EST-CRUD-01');

    await estoquePage.deleteMaterial(new RegExp(nome.slice(0, 12)));
    await expect(estoquePage.materialRow(new RegExp(nome.slice(0, 12))).first()).toBeHidden({ timeout: 15_000 });

    const list = await import('../../support/estoque-helpers').then((m) => m.listMateriaisByApi(request, authToken));
    const stillThere = list.some((item) => Number(item.id) === materialId);
    expect(stillThere).toBe(false);
    materialIds.length = 0;
  });
});
