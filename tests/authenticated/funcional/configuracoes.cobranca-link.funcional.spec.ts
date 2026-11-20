import { test, expect } from '../../fixtures/test.fixture';
import {
  createPaymentLinkMockState,
  installPaymentLinkMocks,
  type PaymentLinkMockState,
} from '../../support/payment-link-mocks';
import { expectErrorToast, expectNoErrorToast, expectToast } from '../../support/toast-helpers';

type AppShell = {
  navigateTo: (path: string) => Promise<void>;
  expectAuthenticatedShell: () => Promise<void>;
  dismissBlockingModals: () => Promise<void>;
};

test.describe('Configurações — Cobrança por link (login "Conectar com" e ajuda)', () => {
  async function openLinkGateway(
    page: Parameters<typeof installPaymentLinkMocks>[0],
    appShell: AppShell,
    configuracoesPage: {
      openSection: (label: string) => Promise<void>;
      openCobrancaPacientes: () => Promise<unknown>;
      selectCobrancaLinkGateway: (name: string) => Promise<unknown>;
    },
    state: PaymentLinkMockState,
    gateway: string
  ) {
    await installPaymentLinkMocks(page, state);
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await appShell.dismissBlockingModals();
    await configuracoesPage.openSection('Integrações');
    await configuracoesPage.openCobrancaPacientes();
    await configuracoesPage.selectCobrancaLinkGateway(gateway);
  }

  test('[CFG-LINK-01] conecta o Mercado Pago pelo login e volta com a conta ligada', async ({
    page,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPaymentLinkMockState({ mercadoPagoOAuthAvailable: true });
    await openLinkGateway(page, appShell, configuracoesPage, state, 'Mercado Pago');

    const origin = new URL(page.url()).origin;
    state.mercadoPagoAuthorizeUrl =
      `${origin}/configuracoes?aba=integracoes&gateway_oauth=mercadopago&gateway_oauth_result=connected`;

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await expect(dialog.getByText(/Prefiro colar a chave de acesso/i)).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /Conectar com Mercado Pago/i }).click();

    await expectToast(page, /Conta conectada/i, 20_000);
    const reopened = configuracoesPage.cobrancaPacientesDialog();
    await expect(reopened.getByText(/conectado pelo login Mercado Pago/i)).toBeVisible({ timeout: 15_000 });
    await expect(reopened.getByText(/conta: Clínica E2E/i)).toBeVisible();
    await expect(page).not.toHaveURL(/gateway_oauth=/);
  });

  test('[CFG-LINK-02] sem login disponível mostra só o campo do Access Token', async ({
    page,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPaymentLinkMockState({ mercadoPagoOAuthAvailable: false });
    await openLinkGateway(page, appShell, configuracoesPage, state, 'Mercado Pago');

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await expect(dialog.getByText(/Access Token do Mercado Pago/i)).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('button', { name: /Conectar com Mercado Pago/i })).toHaveCount(0);
    await expectNoErrorToast(page);
  });

  test('[CFG-LINK-03] login cancelado no Mercado Pago avisa e reabre a tela', async ({
    page,
    appShell,
  }) => {
    await installPaymentLinkMocks(page, createPaymentLinkMockState({ mercadoPagoOAuthAvailable: true }));
    // navigateTo pode recarregar a página ao ajustar a sessão; os parâmetros do retorno só valem
    // na primeira carga, então a volta do login é aberta depois, direto pela URL.
    await appShell.navigateTo('/configuracoes');
    await appShell.expectAuthenticatedShell();
    await page.goto(
      '/configuracoes?aba=integracoes&gateway_oauth=mercadopago&gateway_oauth_result=error&gateway_oauth_reason=autorizacao_negada',
      { waitUntil: 'domcontentloaded' }
    );

    await expectErrorToast(page, /autorização foi cancelada/i, 20_000);
    await expect(
      page.getByRole('dialog', { name: /Cobrança aos pacientes/i }).and(page.locator('.p-dialog'))
        .getByRole('button', { name: /Conectar com Mercado Pago/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('[CFG-LINK-04] falha ao abrir o login exibe toast e libera o botão', async ({
    page,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPaymentLinkMockState({ mercadoPagoOAuthAvailable: true, failOAuthStart: true });
    await openLinkGateway(page, appShell, configuracoesPage, state, 'Mercado Pago');

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    const connect = dialog.getByRole('button', { name: /Conectar com Mercado Pago/i });
    await connect.click();

    await expectErrorToast(page, /indisponivel|indisponível|não foi possível/i, 15_000);
    await expect(connect).toBeEnabled();
  });

  test('[CFG-LINK-05] Asaas sem chave mostra erro no campo, sem toast', async ({
    page,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPaymentLinkMockState();
    await openLinkGateway(page, appShell, configuracoesPage, state, 'Asaas');

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await dialog.getByRole('button', { name: /^Salvar$/i }).click();

    await expect(dialog.getByText(/Cole a chave do Asaas para continuar/i)).toBeVisible();
    await expect(page.locator('.p-toast-message-error, .p-toast-message-warn')).toHaveCount(0);
    expect(state.lastAsaasConnectBody).toBeNull();
  });

  test('[CFG-LINK-06] ajuda "?" do Asaas mostra o passo a passo', async ({
    page,
    appShell,
    configuracoesPage,
  }) => {
    await openLinkGateway(page, appShell, configuracoesPage, createPaymentLinkMockState(), 'Asaas');

    await configuracoesPage
      .cobrancaPacientesDialog()
      .getByRole('button', { name: /Onde encontrar a chave do Asaas/i })
      .click();

    const help = configuracoesPage.fieldHelpDialog(/Chave do Asaas/i);
    await expect(help).toBeVisible({ timeout: 10_000 });
    await expect(help.getByText(/Integrações/i).first()).toBeVisible();
    await help.getByRole('button', { name: /Entendi/i }).click();
    await expect(help).toBeHidden({ timeout: 10_000 });
  });

  test('[CFG-LINK-07] Asaas com chave recusada exibe toast e mantém a tela', async ({
    page,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPaymentLinkMockState({ failAsaasConnect: true });
    await openLinkGateway(page, appShell, configuracoesPage, state, 'Asaas');

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await dialog.locator('#asaas-key-pane').fill('$aact_prod_chave_e2e');
    await dialog.getByRole('button', { name: /^Salvar$/i }).click();

    await expectErrorToast(page, /Asaas|não foi possível|nao foi possivel/i, 15_000);
    await expect(dialog.locator('#asaas-key-pane')).toBeVisible();
    expect(state.lastAsaasConnectBody?.['apiKey']).toBe('$aact_prod_chave_e2e');
  });

  test('[CFG-LINK-08] InfinitePay liga só com a InfiniteTag', async ({
    page,
    appShell,
    configuracoesPage,
  }) => {
    const state = createPaymentLinkMockState();
    await openLinkGateway(page, appShell, configuracoesPage, state, 'InfinitePay');

    const dialog = configuracoesPage.cobrancaPacientesDialog();
    await expect(dialog.getByText(/Página depois do pagamento \(opcional\)/i)).toBeVisible({ timeout: 10_000 });
    await dialog.locator('#infinitypay-handle-pane').fill('clinica-e2e');
    await dialog.getByRole('button', { name: /^Salvar$/i }).click();

    await expectToast(page, /InfinitePay configurado/i, 15_000);
    expect(state.lastInfinityPayConnectBody).toEqual({ handle: 'clinica-e2e', sandbox: false });
  });
});
