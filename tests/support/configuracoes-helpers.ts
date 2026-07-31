import { expect, type APIRequestContext } from '@playwright/test';
import { CONFIG_API } from '../data/configuracoes';
import { e2eEnv } from './env';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function extractId(body: Record<string, unknown>): number | null {
  if (typeof body.id === 'number') return body.id;
  for (const key of Object.keys(body)) {
    const nested = body[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const id = (nested as Record<string, unknown>).id;
      if (typeof id === 'number') return id;
    }
  }
  return null;
}

async function deleteByApi(request: APIRequestContext, token: string, path: string, id: number): Promise<void> {
  await request.delete(`${e2eEnv.apiUrl}${path}/${id}`, {
    headers: authHeaders(token),
  });
}

// --- Fornecedores ---

export async function createFornecedorByApi(
  request: APIRequestContext,
  token: string,
  options: { nome: string; email?: string; telefone?: string }
): Promise<number> {
  const res = await request.post(`${e2eEnv.apiUrl}${CONFIG_API.fornecedores}`, {
    headers: authHeaders(token),
    data: {
      nome: options.nome,
      cpf_cnpj: '',
      telefone: options.telefone ?? '',
      email: options.email ?? '',
      observacoes: 'E2E seed',
      ativo: true,
    },
  });
  if (!res.ok()) {
    throw new Error(`createFornecedorByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const id = extractId((await res.json()) as Record<string, unknown>);
  if (!id) throw new Error('createFornecedorByApi: resposta sem id');
  return id;
}

export async function deleteFornecedorByApi(request: APIRequestContext, token: string, id: number): Promise<void> {
  await deleteByApi(request, token, CONFIG_API.fornecedores, id);
}

export async function listFornecedoresByApi(
  request: APIRequestContext,
  token: string
): Promise<Array<Record<string, unknown>>> {
  const res = await request.get(`${e2eEnv.apiUrl}${CONFIG_API.fornecedores}`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return [];
  const body = (await res.json()) as { fornecedores?: Array<Record<string, unknown>> };
  return body.fornecedores ?? [];
}

export async function expectFornecedorInApi(
  request: APIRequestContext,
  token: string,
  nome: string | RegExp
): Promise<Record<string, unknown>> {
  let found: Record<string, unknown> | undefined;
  await expect
    .poll(async () => {
      const list = await listFornecedoresByApi(request, token);
      found = list.find((item) => {
        const label = String(item.nome ?? '');
        return typeof nome === 'string' ? label === nome : nome.test(label);
      });
      return !!found;
    }, { timeout: 15_000 })
    .toBe(true);
  return found!;
}

// --- Salas ---

export async function createSalaByApi(
  request: APIRequestContext,
  token: string,
  options: { nome: string; descricao?: string }
): Promise<number> {
  const res = await request.post(`${e2eEnv.apiUrl}${CONFIG_API.salas}`, {
    headers: authHeaders(token),
    data: {
      nome: options.nome,
      descricao: options.descricao ?? 'E2E seed',
      ativo: true,
    },
  });
  if (!res.ok()) {
    throw new Error(`createSalaByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const id = extractId((await res.json()) as Record<string, unknown>);
  if (!id) throw new Error('createSalaByApi: resposta sem id');
  return id;
}

export async function deleteSalaByApi(request: APIRequestContext, token: string, id: number): Promise<void> {
  await deleteByApi(request, token, CONFIG_API.salas, id);
}

export async function listSalasByApi(
  request: APIRequestContext,
  token: string
): Promise<Array<Record<string, unknown>>> {
  const res = await request.get(`${e2eEnv.apiUrl}${CONFIG_API.salas}`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return [];
  const body = (await res.json()) as {
    salasCadeiras?: Array<Record<string, unknown>>;
    salas?: Array<Record<string, unknown>>;
  };
  return body.salasCadeiras ?? body.salas ?? [];
}

// --- Profissionais / dentistas ---

export async function createProfissionalByApi(
  request: APIRequestContext,
  token: string,
  options: { nome: string; especialidade?: string }
): Promise<number> {
  const res = await request.post(`${e2eEnv.apiUrl}${CONFIG_API.profissionais}`, {
    headers: authHeaders(token),
    data: {
      nome: options.nome,
      especialidade: options.especialidade ?? 'Clínico Geral',
      ativo: true,
    },
  });
  if (!res.ok()) {
    throw new Error(`createProfissionalByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const id = extractId((await res.json()) as Record<string, unknown>);
  if (!id) throw new Error('createProfissionalByApi: resposta sem id');
  return id;
}

export async function deleteProfissionalByApi(request: APIRequestContext, token: string, id: number): Promise<void> {
  await deleteByApi(request, token, CONFIG_API.profissionais, id);
}

export async function listProfissionaisByApi(
  request: APIRequestContext,
  token: string
): Promise<Array<Record<string, unknown>>> {
  const res = await request.get(`${e2eEnv.apiUrl}${CONFIG_API.profissionais}`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return [];
  const body = (await res.json()) as { profissionais?: Array<Record<string, unknown>> };
  return body.profissionais ?? [];
}

// --- Medicamentos ---

export async function createMedicamentoByApi(
  request: APIRequestContext,
  token: string,
  options: { nome: string; principioAtivo?: string; posologia?: string }
): Promise<number> {
  const res = await request.post(`${e2eEnv.apiUrl}${CONFIG_API.medicamentos}`, {
    headers: authHeaders(token),
    data: {
      nome: options.nome,
      principio_ativo: options.principioAtivo ?? 'E2E',
      categoria: 'Analgésico',
      apresentacao: 'Comprimido',
      concentracao: '500mg',
      via: 'Oral',
      codigo: `E2E-${Date.now()}`,
      posologia: options.posologia ?? '1x ao dia',
      orientacoes: '',
      observacoes: 'E2E seed',
    },
  });
  if (!res.ok()) {
    throw new Error(`createMedicamentoByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const id = extractId((await res.json()) as Record<string, unknown>);
  if (!id) throw new Error('createMedicamentoByApi: resposta sem id');
  return id;
}

export async function deleteMedicamentoByApi(request: APIRequestContext, token: string, id: number): Promise<void> {
  await deleteByApi(request, token, CONFIG_API.medicamentos, id);
}

export async function listMedicamentosByApi(
  request: APIRequestContext,
  token: string
): Promise<Array<Record<string, unknown>>> {
  const res = await request.get(`${e2eEnv.apiUrl}${CONFIG_API.medicamentos}?pagina=1&limite=100`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return [];
  const body = (await res.json()) as { medicamentos?: Array<Record<string, unknown>> };
  return body.medicamentos ?? [];
}

// --- Tratamentos ---

export async function createTratamentoByApi(
  request: APIRequestContext,
  token: string,
  options: { nome: string; valor?: number; codigo?: string }
): Promise<number> {
  const res = await request.post(`${e2eEnv.apiUrl}${CONFIG_API.tratamentos}`, {
    headers: authHeaders(token),
    data: {
      nome: options.nome,
      codigo: options.codigo ?? `E2E-${Date.now()}`,
      descricao: 'E2E seed',
      valor: options.valor ?? 100,
      custo: 50,
      comissao: 0,
    },
  });
  if (!res.ok()) {
    throw new Error(`createTratamentoByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const id = extractId((await res.json()) as Record<string, unknown>);
  if (!id) throw new Error('createTratamentoByApi: resposta sem id');
  return id;
}

export async function deleteTratamentoByApi(request: APIRequestContext, token: string, id: number): Promise<void> {
  await deleteByApi(request, token, CONFIG_API.tratamentos, id);
}

export async function updatePerfilByApi(
  request: APIRequestContext,
  token: string,
  data: Record<string, unknown>
): Promise<void> {
  const res = await request.put(`${e2eEnv.apiUrl}${CONFIG_API.perfil}`, {
    headers: authHeaders(token),
    data,
  });
  if (!res.ok()) {
    // alguns backends usam PATCH
    await request.patch(`${e2eEnv.apiUrl}${CONFIG_API.perfil}`, {
      headers: authHeaders(token),
      data,
    });
  }
}

export async function getPerfilByApi(
  request: APIRequestContext,
  token: string
): Promise<Record<string, unknown>> {
  const res = await request.get(`${e2eEnv.apiUrl}${CONFIG_API.perfil}`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return {};
  const body = (await res.json()) as { perfil?: Record<string, unknown> };
  return body.perfil ?? (body as Record<string, unknown>);
}

export async function getClinicaByApi(
  request: APIRequestContext,
  token: string
): Promise<Record<string, unknown>> {
  const res = await request.get(`${e2eEnv.apiUrl}${CONFIG_API.clinica}`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return {};
  const body = (await res.json()) as { clinica?: Record<string, unknown> };
  return body.clinica ?? (body as Record<string, unknown>);
}

export type ConfigSeedBucket = {
  fornecedores?: number[];
  salas?: number[];
  profissionais?: number[];
  medicamentos?: number[];
  tratamentos?: number[];
};

export async function cleanupConfigSeeds(
  request: APIRequestContext,
  token: string,
  seeds: ConfigSeedBucket
): Promise<void> {
  for (const id of seeds.fornecedores ?? []) {
    await deleteFornecedorByApi(request, token, id).catch(() => undefined);
  }
  for (const id of seeds.salas ?? []) {
    await deleteSalaByApi(request, token, id).catch(() => undefined);
  }
  for (const id of seeds.profissionais ?? []) {
    await deleteProfissionalByApi(request, token, id).catch(() => undefined);
  }
  for (const id of seeds.medicamentos ?? []) {
    await deleteMedicamentoByApi(request, token, id).catch(() => undefined);
  }
  for (const id of seeds.tratamentos ?? []) {
    await deleteTratamentoByApi(request, token, id).catch(() => undefined);
  }
}
