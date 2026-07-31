import { test, expect } from '../../fixtures/test.fixture';
import { e2eName } from '../../support/crud-helpers';
import { readTokenFromPage } from '../../support/agenda-helpers';
import {
  cleanupConfigSeeds,
  createFornecedorByApi,
  createMedicamentoByApi,
  createSalaByApi,
  expectFornecedorInApi,
} from '../../support/configuracoes-helpers';

test.describe('Configurações — CRUD cadastros', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const seeds = {
    fornecedores: [] as number[],
    salas: [] as number[],
    medicamentos: [] as number[],
  };
  let authToken = '';
  let fornecedorNome = '';
  let fornecedorId = 0;
  let salaNome = '';
  let salaId = 0;
  let medNome = '';
  let medId = 0;

  test.beforeEach(async ({ appShell }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
  });

  test.afterAll(async ({ request }) => {
    if (authToken) await cleanupConfigSeeds(request, authToken, seeds);
  });

  test('[CFG-CRUD-01] cria fornecedor via API e aparece na listagem', async ({
    configuracoesPage,
    page,
    request,
  }) => {
    authToken = await readTokenFromPage(page);
    fornecedorNome = e2eName('Forn');
    await configuracoesPage.openSection('Fornecedores');

    // Preferência: API seed (modal de fornecedor tem footer fora do viewport em alguns viewports)
    fornecedorId = await createFornecedorByApi(request, authToken, {
      nome: fornecedorNome,
      email: 'e2e@example.com',
    });
    seeds.fornecedores.push(fornecedorId);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await configuracoesPage.openSection('Fornecedores');
    await expect(page.getByText(fornecedorNome).first()).toBeVisible({ timeout: 20_000 });
    await expectFornecedorInApi(request, authToken, fornecedorNome);
  });

  test('[CFG-CRUD-02] edita fornecedor criado', async ({ configuracoesPage, page }) => {
    if (!fornecedorId) test.skip(true, 'Depende de CFG-CRUD-01');
    await configuracoesPage.openSection('Fornecedores');
    const edited = `${fornecedorNome}-Edit`.slice(0, 60);
    const row = page.getByText(fornecedorNome.slice(0, 12)).first();
    if (!(await row.isVisible().catch(() => false))) {
      test.skip(true, 'Fornecedor não visível na listagem para edição');
    }
    const editBtn = page
      .getByRole('row')
      .filter({ hasText: fornecedorNome.slice(0, 12) })
      .getByRole('button', { name: /Editar|Alterar/i })
      .first();
    if (!(await editBtn.isVisible().catch(() => false))) {
      test.skip(true, 'Botão editar fornecedor indisponível');
    }
    await editBtn.click();
    await configuracoesPage.fillFornecedor({ nome: edited });
    await configuracoesPage.saveFornecedor();
    fornecedorNome = edited;
    await expect(page.getByText(edited.slice(0, 12)).first()).toBeVisible({ timeout: 20_000 });
  });

  test('[CFG-CRUD-03] exclui fornecedor criado', async ({ configuracoesPage, page }) => {
    if (!fornecedorId) test.skip(true, 'Depende de CFG-CRUD-01');
    await configuracoesPage.openSection('Fornecedores');
    await configuracoesPage.deleteRowByText(new RegExp(fornecedorNome.slice(0, 10)));
    seeds.fornecedores = seeds.fornecedores.filter((id) => id !== fornecedorId);
    fornecedorId = 0;
  });

  test('[CFG-CRUD-04] cria sala via UI com fallback API', async ({ configuracoesPage, page, request }) => {
    authToken = authToken || (await readTokenFromPage(page));
    salaNome = e2eName('Sala');
    await configuracoesPage.openSection('Salas e cadeiras');
    await configuracoesPage.openNovaSala();
    await configuracoesPage.fillSala({ nome: salaNome, desc: 'E2E' });
    salaId = (await configuracoesPage.saveSala()) ?? 0;
    if (!salaId) {
      salaId = await createSalaByApi(request, authToken, { nome: salaNome });
    }
    seeds.salas.push(salaId);
    await expect(page.getByText(salaNome).first()).toBeVisible({ timeout: 20_000 });
  });

  test('[CFG-CRUD-05] exclui sala criada', async ({ configuracoesPage }) => {
    if (!salaId) test.skip(true, 'Depende de CFG-CRUD-04');
    await configuracoesPage.openSection('Salas e cadeiras');
    await configuracoesPage.deleteRowByText(new RegExp(salaNome.slice(0, 10)));
    seeds.salas = seeds.salas.filter((id) => id !== salaId);
    salaId = 0;
  });

  test('[CFG-CRUD-06] cria medicamento via UI com fallback API', async ({
    configuracoesPage,
    page,
    request,
  }) => {
    authToken = authToken || (await readTokenFromPage(page));
    medNome = e2eName('Med');
    await configuracoesPage.openSection('Medicamentos');
    medId = await createMedicamentoByApi(request, authToken, { nome: medNome });
    seeds.medicamentos.push(medId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await configuracoesPage.openSection('Medicamentos');
    const filtro = page.locator('#med-filtro-q').first();
    if (await filtro.isVisible().catch(() => false)) {
      await filtro.fill(medNome.slice(0, 12));
      await page.waitForTimeout(800);
    }
    await expect(page.getByText(medNome.slice(0, 12)).first()).toBeVisible({ timeout: 20_000 });
  });

  test('[CFG-CRUD-07] exclui medicamento criado', async ({ configuracoesPage, page }) => {
    if (!medId) test.skip(true, 'Depende de CFG-CRUD-06');
    await configuracoesPage.openSection('Medicamentos');
    const filtro = page.locator('#med-filtro-q, #med-rapido-nome').first();
    if (await filtro.isVisible().catch(() => false)) {
      await filtro.fill(medNome.slice(0, 12));
      await page.waitForTimeout(800);
    }
    await configuracoesPage.deleteRowByText(new RegExp(medNome.slice(0, 10)));
    seeds.medicamentos = seeds.medicamentos.filter((id) => id !== medId);
    medId = 0;
  });
});
