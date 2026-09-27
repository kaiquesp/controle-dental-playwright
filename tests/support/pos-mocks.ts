import type { BrowserContext, Page, Route } from '@playwright/test';

export type PosProviderId = 'mercadopago_pos' | 'stone_pos' | 'cielo_lio' | 'sumup_pos';
export type PosByokProviderId = 'stone_pos' | 'cielo_lio' | 'sumup_pos';
export type PosChargeStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';

export type PosTerminalMock = {
  id: number;
  tenant_id: number;
  nome: string;
  tipo_pagamento: string;
  provider: PosProviderId;
  provider_terminal_id: string;
  status: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PosChargeMock = {
  id: number;
  tenant_id: number;
  patient_id: number;
  financial_transaction_id: number;
  terminal_id: number;
  terminal_nome: string | null;
  provider: string;
  provider_charge_id: string | null;
  amount_minor: number;
  payment_method: string;
  installments: number;
  status: PosChargeStatus;
  created_at: string;
  updated_at: string | null;
  expires_at: string | null;
};

export type PosMockState = {
  terminals: PosTerminalMock[];
  mercadoPagoActive: boolean;
  byokLinked: Record<PosByokProviderId, boolean>;
  nextTerminalId: number;
  charges: PosChargeMock[];
  nextChargeId: number;
  failList: boolean;
  failRegister: boolean;
  failSync: boolean;
  failDelete: boolean;
  failCharge: boolean;
  failCancel: boolean;
  chargeStatusOnCreate: PosChargeStatus;
};

const POS_API =
  /\/api\/(configuracoes\/maquininhas|configuracoes\/integracoes\/(mercadopago-payments|stone-pos|cielo-lio|sumup-pos)|pacientes\/\d+\/pagamentos\/\d+\/maquininha)/i;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

export function createPosTerminalMock(overrides: Partial<PosTerminalMock> = {}): PosTerminalMock {
  const now = new Date().toISOString();
  return {
    id: 1,
    tenant_id: 1,
    nome: 'Point recepção',
    tipo_pagamento: 'credito_debito',
    provider: 'mercadopago_pos',
    provider_terminal_id: 'SBX0001',
    status: 'online',
    last_seen_at: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function createPosMockState(overrides: Partial<PosMockState> = {}): PosMockState {
  return {
    terminals: [],
    mercadoPagoActive: true,
    byokLinked: {
      stone_pos: false,
      cielo_lio: false,
      sumup_pos: false,
    },
    nextTerminalId: 10,
    charges: [],
    nextChargeId: 100,
    failList: false,
    failRegister: false,
    failSync: false,
    failDelete: false,
    failCharge: false,
    failCancel: false,
    chargeStatusOnCreate: 'pending',
    ...overrides,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

async function fulfillError(route: Route, mensagem: string): Promise<void> {
  await fulfillJson(route, { erro: mensagem, mensagem }, 500);
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function byokProviderFromPath(path: string): PosByokProviderId | null {
  if (path.includes('/stone-pos')) return 'stone_pos';
  if (path.includes('/cielo-lio')) return 'cielo_lio';
  if (path.includes('/sumup-pos')) return 'sumup_pos';
  return null;
}

function createCharge(
  state: PosMockState,
  terminal: PosTerminalMock | undefined,
  payload: { terminal_id?: number; metodo?: string; parcelas?: number }
): PosChargeMock {
  const now = new Date().toISOString();
  const charge: PosChargeMock = {
    id: state.nextChargeId,
    tenant_id: 1,
    patient_id: 1,
    financial_transaction_id: 1,
    terminal_id: payload.terminal_id ?? terminal?.id ?? 0,
    terminal_nome: terminal?.nome ?? null,
    provider: terminal?.provider ?? 'mercadopago_pos',
    provider_charge_id: `e2e-charge-${state.nextChargeId}`,
    amount_minor: 15000,
    payment_method: payload.metodo ?? 'credit_card',
    installments: payload.parcelas ?? 1,
    status: state.chargeStatusOnCreate,
    created_at: now,
    updated_at: now,
    expires_at: null,
  };
  state.nextChargeId += 1;
  state.charges.push(charge);
  return charge;
}

function createPosRouteHandler(state: PosMockState) {
  return async (route: Route): Promise<void> => {
    const request = route.request();
    const method = request.method();
    const path = pathnameOf(request.url());

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    if (path.includes('/configuracoes/maquininhas')) {
      if (path.endsWith('/sincronizar') && method === 'POST') {
        if (state.failSync) {
          await fulfillError(route, 'Não foi possível atualizar as maquininhas (falha simulada E2E).');
          return;
        }
        await fulfillJson(route, {
          mensagem: 'Status das maquininhas cadastradas atualizado.',
          sincronizados: state.terminals.length,
          maquininhas: state.terminals,
        });
        return;
      }

      const idMatch = path.match(/\/maquininhas\/(\d+)\/?$/);
      if (idMatch && method === 'PATCH') {
        const id = Number(idMatch[1]);
        const body = (request.postDataJSON() ?? {}) as { nome?: string };
        const current = state.terminals.find((item) => item.id === id);
        if (current && typeof body.nome === 'string') {
          current.nome = body.nome;
          current.updated_at = new Date().toISOString();
        }
        await fulfillJson(route, {
          mensagem: 'Maquininha atualizada.',
          maquininha: current ?? null,
        });
        return;
      }

      if (idMatch && method === 'DELETE') {
        if (state.failDelete) {
          await fulfillError(route, 'Não foi possível remover a maquininha (falha simulada E2E).');
          return;
        }
        const id = Number(idMatch[1]);
        state.terminals = state.terminals.filter((item) => item.id !== id);
        await fulfillJson(route, { mensagem: 'Maquininha removida.' });
        return;
      }

      if (method === 'GET') {
        if (state.failList) {
          await fulfillError(route, 'Não foi possível carregar as maquininhas (falha simulada E2E).');
          return;
        }
        await fulfillJson(route, { maquininhas: state.terminals });
        return;
      }

      if (method === 'POST') {
        if (state.failRegister) {
          await fulfillError(route, 'Não foi possível adicionar a maquininha (falha simulada E2E).');
          return;
        }
        const body = (request.postDataJSON() ?? {}) as {
          provider?: PosProviderId;
          provider_terminal_id?: string;
          nome?: string;
        };
        const terminal = createPosTerminalMock({
          id: state.nextTerminalId,
          provider: body.provider ?? 'mercadopago_pos',
          provider_terminal_id: body.provider_terminal_id ?? `E2E-${state.nextTerminalId}`,
          nome: body.nome?.trim() || 'Recepção',
        });
        state.nextTerminalId += 1;
        state.terminals.push(terminal);
        await fulfillJson(route, { mensagem: 'Maquininha adicionada.', maquininha: terminal });
        return;
      }
    }

    if (path.includes('/integracoes/mercadopago-payments') && method === 'GET') {
      await fulfillJson(route, {
        configurado: state.mercadoPagoActive,
        status: state.mercadoPagoActive ? 'active' : 'not_configured',
        provider: 'mercadopago_payments',
      });
      return;
    }

    const byok = byokProviderFromPath(path);
    if (byok) {
      if (path.endsWith('/connect') && method === 'POST') {
        state.byokLinked[byok] = true;
        await fulfillJson(route, { mensagem: 'Conta ligada.', status: 'active' });
        return;
      }
      if (path.endsWith('/test') && method === 'POST') {
        await fulfillJson(route, { ok: true, mensagem: 'Acesso verificado.' });
        return;
      }
      if (method === 'GET') {
        const linked = state.byokLinked[byok];
        await fulfillJson(route, {
          configurado: linked,
          provider: byok,
          status: linked ? 'active' : 'not_configured',
          sandbox: true,
        });
        return;
      }
    }

    if (path.includes('/maquininha')) {
      const chargeIdMatch = path.match(/\/maquininha\/(\d+)/);
      if (path.endsWith('/cancelar') && method === 'POST') {
        if (state.failCancel) {
          await fulfillError(route, 'Não foi possível cancelar a cobrança (falha simulada E2E).');
          return;
        }
        const chargeId = chargeIdMatch ? Number(chargeIdMatch[1]) : 0;
        const charge = state.charges.find((item) => item.id === chargeId);
        if (charge) {
          charge.status = 'cancelled';
        }
        await fulfillJson(route, {
          mensagem: 'Cobrança cancelada. A parcela permanece pendente.',
          charge: charge ?? { id: chargeId, status: 'cancelled' },
        });
        return;
      }

      if (chargeIdMatch && method === 'GET') {
        const charge = state.charges.find((item) => item.id === Number(chargeIdMatch[1]));
        await fulfillJson(route, { charge: charge ?? { id: Number(chargeIdMatch[1]), status: 'pending' } });
        return;
      }

      if (method === 'POST') {
        if (state.failCharge) {
          await fulfillError(route, 'Não foi possível enviar a cobrança (falha simulada E2E).');
          return;
        }
        const body = (request.postDataJSON() ?? {}) as {
          terminal_id?: number;
          metodo?: string;
          parcelas?: number;
        };
        const terminal = state.terminals.find((item) => item.id === Number(body.terminal_id));
        const charge = createCharge(state, terminal, body);
        await fulfillJson(route, {
          mensagem:
            charge.status === 'paid'
              ? 'Pagamento confirmado na maquininha.'
              : 'Aguardando o paciente na maquininha.',
          charge,
        });
        return;
      }
    }

    await route.continue();
  };
}

/**
 * Mocka cadastro de maquininhas, credenciais BYOK e cobrança presencial.
 * Instale no `context` (não page+context juntos) para evitar duplo fulfill.
 */
export async function installPosMocks(
  target: Page | BrowserContext,
  state: PosMockState = createPosMockState()
): Promise<void> {
  await target.route(POS_API, createPosRouteHandler(state));
}
