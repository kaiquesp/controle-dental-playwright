import { expect, type APIRequestContext } from '@playwright/test';
import { e2eEnv } from './env';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type EstoqueMaterialSeed = {
  id: number;
  nome: string;
  codigo: string;
};

export async function listMateriaisByApi(
  request: APIRequestContext,
  token: string
): Promise<Array<Record<string, unknown>>> {
  const res = await request.get(`${e2eEnv.apiUrl}/estoque/materiais?pagina=1&limite=200`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return [];
  const body = (await res.json()) as { materiais?: Array<Record<string, unknown>> };
  return body.materiais ?? [];
}

export async function getMaterialByApi(
  request: APIRequestContext,
  token: string,
  id: number
): Promise<Record<string, unknown>> {
  const res = await request.get(`${e2eEnv.apiUrl}/estoque/materiais/${id}`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) {
    throw new Error(`getMaterialByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { material?: Record<string, unknown> };
  return (body.material ?? body) as Record<string, unknown>;
}

export async function createMaterialByApi(
  request: APIRequestContext,
  token: string,
  options: {
    nome: string;
    codigo: string;
    categoria?: string;
    quantidade?: number;
    estoqueMinimo?: number;
    unidade?: string;
    custo?: number;
    descricao?: string;
    alertaEstoqueBaixo?: boolean;
  }
): Promise<number> {
  const res = await request.post(`${e2eEnv.apiUrl}/estoque/materiais`, {
    headers: authHeaders(token),
    data: {
      nome_material: options.nome,
      codigo_item: options.codigo,
      categoria: options.categoria ?? 'Consumiveis',
      quantidade_inicial: options.quantidade ?? 10,
      unidade_medida: options.unidade ?? 'un',
      estoque_minimo: options.estoqueMinimo ?? 5,
      custo_unitario: options.custo ?? 10,
      descricao_apresentacao: options.descricao ?? '',
      alerta_estoque_baixo: options.alertaEstoqueBaixo ?? true,
    },
  });
  if (!res.ok()) {
    throw new Error(`createMaterialByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { material?: { id?: number }; id?: number };
  const id = body.material?.id ?? body.id;
  if (!id) throw new Error('createMaterialByApi: resposta sem id');
  return Number(id);
}

export async function updateMaterialQuantidadeByApi(
  request: APIRequestContext,
  token: string,
  id: number,
  quantidade: number
): Promise<void> {
  const current = await getMaterialByApi(request, token, id);
  const res = await request.put(`${e2eEnv.apiUrl}/estoque/materiais/${id}`, {
    headers: authHeaders(token),
    data: {
      nome_material: current.nome_material ?? current.nomeMaterial,
      codigo_item: current.codigo_item ?? current.codigoItem,
      categoria: current.categoria ?? 'Consumiveis',
      quantidade_atual: quantidade,
      unidade_medida: current.unidade_medida ?? current.unidadeMedida ?? 'un',
      estoque_minimo: current.estoque_minimo ?? current.estoqueMinimo ?? 0,
      custo_unitario: current.custo_unitario ?? current.custoUnitario ?? 0,
      alerta_estoque_baixo: current.alerta_estoque_baixo ?? current.alertaEstoqueBaixo ?? true,
    },
  });
  if (!res.ok()) {
    throw new Error(`updateMaterialQuantidadeByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
}

export async function deleteMaterialByApi(
  request: APIRequestContext,
  token: string,
  id: number
): Promise<void> {
  await request.delete(`${e2eEnv.apiUrl}/estoque/materiais/${id}`, {
    headers: authHeaders(token),
  });
}

export async function expectMaterialInApi(
  request: APIRequestContext,
  token: string,
  nome: string | RegExp
): Promise<Record<string, unknown>> {
  let found: Record<string, unknown> | undefined;
  await expect
    .poll(async () => {
      const list = await listMateriaisByApi(request, token);
      found = list.find((item) => {
        const label = String(item.nome_material ?? item.nomeMaterial ?? '');
        return typeof nome === 'string' ? label === nome : nome.test(label);
      });
      return !!found;
    }, { timeout: 15_000 })
    .toBe(true);
  return found!;
}

export async function cleanupEstoqueSeeds(
  request: APIRequestContext,
  token: string,
  materialIds: number[]
): Promise<void> {
  for (const id of materialIds) {
    await deleteMaterialByApi(request, token, id).catch(() => undefined);
  }
}
