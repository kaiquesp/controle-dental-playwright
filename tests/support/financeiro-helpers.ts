import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { e2eEnv } from './env';
import { FEATURE_GATED_FINANCEIRO_PATHS } from '../data/financeiro';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function isFinanceiroSectionAvailable(page: Page, path: string): Promise<boolean> {
  if (page.url().includes(path)) return true;

  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  if (page.url().includes('/login')) return false;
  return page.url().includes(path);
}

export async function assertFinanceiroSectionOrGated(
  page: Page,
  path: string,
  expectPattern: RegExp
): Promise<boolean> {
  const available = await isFinanceiroSectionAvailable(page, path);
  if (available) {
    await expect(page.getByText(expectPattern).first()).toBeVisible({ timeout: 15_000 });
    return true;
  }

  if (FEATURE_GATED_FINANCEIRO_PATHS.has(path)) {
    await expect(page).toHaveURL(/\/financeiro/);
    return false;
  }

  expect(page.url()).not.toContain('/login');
  return false;
}

function readStringField(obj: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nome = (value as { nome?: unknown }).nome;
      if (typeof nome === 'string' && nome.trim()) return nome;
    }
  }
  return fallback;
}

function readTransacaoDate(obj: Record<string, unknown>): string {
  const raw = obj.data ?? obj.data_transacao ?? obj.data_transacao_iso;
  if (typeof raw === 'string' && raw.length >= 10) {
    return raw.slice(0, 10);
  }
  return todayIso();
}

function buildTransacaoUpdatePayload(
  current: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const tipo = readStringField(current, ['tipo'], 'despesa');
  const valor = overrides.valor ?? current.valor ?? 50;
  const descricao = overrides.descricao ?? readStringField(current, ['descricao'], '');

  const payload: Record<string, unknown> = {
    tipo,
    valor: typeof valor === 'number' ? valor : Number(valor) || 50,
    data: overrides.data ?? readTransacaoDate(current),
    descricao,
    categoria: readStringField(current, ['categoria', 'categoria_nome'], 'Outros'),
    forma_pagamento: readStringField(current, ['forma_pagamento', 'forma_pagamento_nome'], 'Dinheiro'),
    status: readStringField(current, ['status'], 'pago'),
    patient_id: current.patient_id ?? null,
    supplier_id: current.supplier_id ?? null,
    origem_tipo: readStringField(
      current,
      ['origem_tipo'],
      tipo === 'receita' ? 'paciente' : 'clinica'
    ),
    ...overrides,
  };

  for (const field of ['tipo', 'valor', 'data', 'descricao', 'categoria', 'forma_pagamento', 'status']) {
    const value = payload[field];
    if (value === undefined || value === null || value === '') {
      throw new Error(`buildTransacaoUpdatePayload: campo obrigatório ausente: ${field}`);
    }
  }

  return payload;
}

export async function createTransacaoByApi(
  request: APIRequestContext,
  token: string,
  options: {
    tipo?: 'receita' | 'despesa';
    valor?: number;
    descricao: string;
    status?: 'pago' | 'pendente';
    patientId?: number;
    categoria?: string;
    formaPagamento?: string;
  }
): Promise<number> {
  const tipo = options.tipo ?? 'despesa';
  const data: Record<string, unknown> = {
    tipo,
    valor: options.valor ?? 50,
    data: todayIso(),
    descricao: options.descricao,
    categoria: options.categoria ?? 'Outros',
    forma_pagamento: options.formaPagamento ?? 'Dinheiro',
    status: options.status ?? 'pago',
    supplier_id: null,
    origem_tipo: tipo === 'receita' ? 'paciente' : 'fornecedor',
  };

  if (tipo === 'receita') {
    if (!options.patientId) {
      throw new Error('createTransacaoByApi: receita exige patientId');
    }
    data.patient_id = options.patientId;
  } else {
    data.patient_id = null;
    data.origem_tipo = 'clinica';
  }

  const res = await request.post(`${e2eEnv.apiUrl}/financeiro/transacoes`, {
    headers: authHeaders(token),
    data,
  });

  if (!res.ok()) {
    throw new Error(`createTransacaoByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }

  const body = (await res.json()) as { id?: number; transacao?: { id?: number } };
  const id = body.id ?? body.transacao?.id;
  if (!id) throw new Error('createTransacaoByApi: resposta sem id');
  return Number(id);
}

export async function getTransacaoByApi(
  request: APIRequestContext,
  token: string,
  id: number
): Promise<Record<string, unknown>> {
  const direct = await request.get(`${e2eEnv.apiUrl}/financeiro/transacoes/${id}`, {
    headers: authHeaders(token),
  });
  if (direct.ok()) {
    const body = (await direct.json()) as { transacao?: Record<string, unknown> };
    return (body.transacao ?? body) as Record<string, unknown>;
  }

  const list = await request.get(`${e2eEnv.apiUrl}/financeiro/transacoes?pagina=1&limite=200`, {
    headers: authHeaders(token),
  });
  if (!list.ok()) {
    throw new Error(`getTransacaoByApi failed (${list.status()}): ${(await list.text()).slice(0, 300)}`);
  }
  const body = (await list.json()) as { transacoes?: Array<Record<string, unknown>> };
  const found = body.transacoes?.find((item) => Number(item.id) === id);
  if (!found) throw new Error(`getTransacaoByApi: transação ${id} não encontrada`);
  return found;
}

export async function updateTransacaoDescricaoByApi(
  request: APIRequestContext,
  token: string,
  id: number,
  descricao: string
): Promise<void> {
  const current = await getTransacaoByApi(request, token, id);
  await updateTransacaoByApi(request, token, id, buildTransacaoUpdatePayload(current, { descricao }));
}

export async function updateTransacaoByApi(
  request: APIRequestContext,
  token: string,
  id: number,
  data: Record<string, unknown>
): Promise<void> {
  const res = await request.put(`${e2eEnv.apiUrl}/financeiro/transacoes/${id}`, {
    headers: authHeaders(token),
    data,
  });
  if (!res.ok()) {
    throw new Error(`updateTransacaoByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
}

export async function deleteTransacaoByApi(
  request: APIRequestContext,
  token: string,
  id: number
): Promise<void> {
  await request.delete(`${e2eEnv.apiUrl}/financeiro/transacoes/${id}`, {
    headers: authHeaders(token),
  });
}

export async function cleanupFinanceiroSeeds(
  request: APIRequestContext,
  token: string,
  transacaoIds: number[]
): Promise<void> {
  for (const id of transacaoIds) {
    await deleteTransacaoByApi(request, token, id).catch(() => undefined);
  }
}
