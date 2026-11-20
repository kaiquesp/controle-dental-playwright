import { test, expect } from '../../fixtures/test.fixture';
import { CONFIG_FORM_IDS } from '../../data/configuracoes';
import { expectDialogHasFormFields } from '../../support/interaction-helpers';
import { expectNoErrorToast, expectValidationFeedback } from '../../support/toast-helpers';
import { e2eName, readAccessToken } from '../../support/crud-helpers';
import { e2eEnv } from '../../support/env';

test.describe('Configurações — Equipe e permissões', () => {
  test.beforeEach(async ({ appShell, configuracoesPage }) => {
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await configuracoesPage.openSection('Equipe e permissões');
  });

  test('[CFG-05] lista equipe e abre modal adicionar membro', async ({ page, configuracoesPage }) => {
    await expect(page.getByRole('button', { name: /Adicionar membro/i })).toBeVisible({ timeout: 15_000 });
    const dialog = await configuracoesPage.openAdicionarMembro();
    await expectDialogHasFormFields(dialog, 2);
    await expect(dialog.locator(CONFIG_FORM_IDS.equipe.nome)).toBeVisible();
    await expect(dialog.locator(CONFIG_FORM_IDS.equipe.email)).toBeVisible();
    await configuracoesPage.cancelDialog();
    await expectNoErrorToast(page);
  });

  test('[CFG-FUNC-EQUIPE-01] submit vazio exibe validação', async ({ configuracoesPage }) => {
    await configuracoesPage.openAdicionarMembro();
    await configuracoesPage.submitEmptyAndExpectValidation(/Salvar|Adicionar|Convidar|Enviar/i);
    await expectValidationFeedback(configuracoesPage.page);
    await configuracoesPage.cancelDialog();
  });
});

test.describe('Configurações — Equipe: sessão ao trocar o papel', () => {
  test('[CFG-FUNC-EQUIPE-SEC-01] trocar o papel do membro invalida o token dele; editar só o nome não', async ({
    page,
    appShell,
  }) => {
    test.setTimeout(90_000);
    await appShell.navigateTo('/configuracoes');
    const adminToken = await readAccessToken(page);
    test.skip(!adminToken, 'Sessão admin E2E ausente');
    const adminAuth = { Authorization: `Bearer ${adminToken}` };

    const nome = e2eName('Membro-Papel');
    const email = `${nome.toLowerCase()}@teste-e2e.local`;
    const senha = 'SenhaE2E@2026';
    const created = await page.request.post(`${e2eEnv.apiUrl}/configuracoes/equipe/membros`, {
      headers: adminAuth,
      data: { nome, email, senha, role: 'recepcao' },
    });
    expect(created.status(), await created.text()).toBe(201);
    const membroId = Number(((await created.json()) as { membro?: { id?: number } }).membro?.id);
    expect(Number.isFinite(membroId)).toBe(true);

    try {
      const login = await page.request.post(`${e2eEnv.apiUrl}/auth/login`, { data: { email, senha } });
      expect(login.status(), await login.text()).toBe(200);
      const memberToken = ((await login.json()) as { accessToken?: string }).accessToken;
      expect(memberToken).toBeTruthy();
      const meWithMemberToken = () =>
        page.request.get(`${e2eEnv.apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${memberToken}` } });
      expect((await meWithMemberToken()).status()).toBe(200);

      const renamed = await page.request.put(`${e2eEnv.apiUrl}/configuracoes/equipe/membros/${membroId}`, {
        headers: adminAuth,
        data: { nome: `${nome} Editado`, role: 'recepcao', ativo: true },
      });
      expect(renamed.status(), await renamed.text()).toBe(200);
      expect((await meWithMemberToken()).status()).toBe(200);

      const roleChanged = await page.request.put(`${e2eEnv.apiUrl}/configuracoes/equipe/membros/${membroId}`, {
        headers: adminAuth,
        data: { nome: `${nome} Editado`, role: 'financeiro', ativo: true },
      });
      expect(roleChanged.status(), await roleChanged.text()).toBe(200);
      expect((await meWithMemberToken()).status()).toBe(401);
    } finally {
      await page.request.delete(`${e2eEnv.apiUrl}/configuracoes/equipe/membros/${membroId}`, { headers: adminAuth });
    }
  });
});

test.describe('Configurações — Equipe: criação de login pela API legada', () => {
  test('[CFG-FUNC-EQUIPE-SEC-02] POST /auth/users aplica a regra de senha da Equipe', async ({ page, appShell }) => {
    await appShell.navigateTo('/configuracoes');
    const adminToken = await readAccessToken(page);
    test.skip(!adminToken, 'Sessão admin E2E ausente');

    const nome = e2eName('Login-Legado');
    const res = await page.request.post(`${e2eEnv.apiUrl}/auth/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { nome, email: `${nome.toLowerCase()}@teste-e2e.local`, senha: '1234567', role: 'recepcao' },
    });

    expect(res.status()).toBe(400);
    expect(((await res.json()) as { erro?: string }).erro).toMatch(/minimo 8 caracteres/i);
  });
});
