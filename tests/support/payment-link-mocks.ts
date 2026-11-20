import type { Page, Route } from '@playwright/test';

/**
 * Mocks das contas de cobrança por link (Configurações → Integrações → Cobrança aos pacientes).
 * Instale na `page`: rotas da página têm prioridade sobre as do contexto (ex.: pos-mocks).
 */
export type PaymentLinkMockState = {
  /** Backend oferece o login "Conectar com Mercado Pago" (flag + credenciais no ambiente). */
  mercadoPagoOAuthAvailable: boolean;
  mercadoPagoConnectedByLogin: boolean;
  /** URL devolvida pelo início do login; nos testes aponta de volta para o próprio app. */
  mercadoPagoAuthorizeUrl: string;
  failOAuthStart: boolean;
  failAsaasConnect: boolean;
  lastAsaasConnectBody: Record<string, unknown> | null;
  lastInfinityPayConnectBody: Record<string, unknown> | null;
};

const PAYMENT_LINK_API =
  /\/api\/configuracoes\/integracoes\/(stripe-payments|mercadopago-payments|asaas-patient|pagbank-payments|infinitypay-payments|oauth\/[a-z]+\/start)/i;

export function createPaymentLinkMockState(overrides: Partial<PaymentLinkMockState> = {}): PaymentLinkMockState {
  return {
    mercadoPagoOAuthAvailable: false,
    mercadoPagoConnectedByLogin: false,
    mercadoPagoAuthorizeUrl: '',
    failOAuthStart: false,
    failAsaasConnect: false,
    lastAsaasConnectBody: null,
    lastInfinityPayConnectBody: null,
    ...overrides,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function notConfigured(provider: string, oauthAvailable = false): Record<string, unknown> {
  return { configurado: false, provider, status: 'not_configured', oauthAvailable, settingsResumo: {} };
}

function createPaymentLinkRouteHandler(state: PaymentLinkMockState) {
  return async (route: Route): Promise<void> => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.toLowerCase();

    if (path.includes('/oauth/mercadopago/start') && method === 'GET') {
      if (state.failOAuthStart) {
        await fulfillJson(route, { erro: 'Login com Mercado Pago indisponivel. Use a chave de acesso.' }, 404);
        return;
      }
      state.mercadoPagoConnectedByLogin = true;
      await fulfillJson(route, { authorizeUrl: state.mercadoPagoAuthorizeUrl });
      return;
    }

    if (path.endsWith('/mercadopago-payments') && method === 'GET') {
      if (state.mercadoPagoConnectedByLogin) {
        await fulfillJson(route, {
          configurado: true,
          provider: 'mercadopago_payments',
          status: 'active',
          oauthAvailable: state.mercadoPagoOAuthAvailable,
          authMode: 'oauth',
          reconnectRequired: false,
          accessTokenConfigured: true,
          accountLabel: 'Clínica E2E',
        });
        return;
      }
      await fulfillJson(route, notConfigured('mercadopago_payments', state.mercadoPagoOAuthAvailable));
      return;
    }

    if (path.endsWith('/asaas-patient/connect') && method === 'POST') {
      state.lastAsaasConnectBody = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      if (state.failAsaasConnect) {
        await fulfillJson(route, { erro: 'Nao foi possivel validar a chave do Asaas.' }, 400);
        return;
      }
      await fulfillJson(route, { status: 'active', mensagem: 'Asaas conectado.' });
      return;
    }

    if (path.endsWith('/infinitypay-payments/connect') && method === 'POST') {
      state.lastInfinityPayConnectBody = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      await fulfillJson(route, { status: 'active', mensagem: 'InfinitePay conectado.' });
      return;
    }

    if (method === 'GET') {
      const provider = path.split('/').pop() ?? '';
      await fulfillJson(route, notConfigured(provider));
      return;
    }

    await route.continue();
  };
}

export async function installPaymentLinkMocks(page: Page, state: PaymentLinkMockState): Promise<void> {
  await page.route(PAYMENT_LINK_API, createPaymentLinkRouteHandler(state));
}
