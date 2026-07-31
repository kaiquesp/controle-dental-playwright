import { expect, type APIRequestContext } from '@playwright/test';
import { e2eEnv } from './env';
import { createPatientByApi, e2eName } from './crud-helpers';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export interface ProteseCasoSeed {
  id: number;
  patientName: string;
  tipoProtese: string;
}

export interface ProteseLabSeed {
  id: number;
  nome: string;
}

export async function listLaboratoriosByApi(
  request: APIRequestContext,
  token: string
): Promise<Array<{ id: number; nome: string; ativo: boolean }>> {
  const res = await request.get(`${e2eEnv.apiUrl}/controle-protese/laboratorios`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return [];
  const body = (await res.json()) as { laboratorios?: Array<{ id: number; nome: string; ativo: boolean }> };
  return body.laboratorios ?? [];
}

export async function createLaboratorioByApi(
  request: APIRequestContext,
  token: string,
  nome: string
): Promise<number> {
  const res = await request.post(`${e2eEnv.apiUrl}/controle-protese/laboratorios`, {
    headers: authHeaders(token),
    data: {
      nome,
      telefone: '(11) 98765-4321',
      ativo: true,
    },
  });
  if (!res.ok()) {
    throw new Error(`createLaboratorioByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { laboratorio?: { id?: number }; id?: number };
  const id = body.laboratorio?.id ?? body.id;
  if (!id) throw new Error('createLaboratorioByApi: resposta sem id');
  return id;
}

export async function updateLaboratorioByApi(
  request: APIRequestContext,
  token: string,
  id: number,
  data: Record<string, unknown>
): Promise<void> {
  const res = await request.put(`${e2eEnv.apiUrl}/controle-protese/laboratorios/${id}`, {
    headers: authHeaders(token),
    data,
  });
  if (!res.ok()) {
    throw new Error(`updateLaboratorioByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
}

export async function setLaboratorioAtivoByApi(
  request: APIRequestContext,
  token: string,
  id: number,
  ativo: boolean,
  nome: string
): Promise<void> {
  await updateLaboratorioByApi(request, token, id, {
    nome,
    telefone: '(11) 98765-4321',
    ativo,
  });
}

export async function createCasoByApi(
  request: APIRequestContext,
  token: string,
  options: {
    patientId: number;
    professionalId: number;
    laboratorioId?: number;
    tipoProtese?: string;
    denteRegiao?: string;
    detalhes?: string;
  }
): Promise<number> {
  const res = await request.post(`${e2eEnv.apiUrl}/controle-protese/casos`, {
    headers: authHeaders(token),
    data: {
      patient_id: options.patientId,
      professional_id: options.professionalId,
      tipo_protese: options.tipoProtese ?? 'Coroa unitária',
      dente_regiao: options.denteRegiao ?? '11',
      prioridade: 'normal',
      laboratorio_id: options.laboratorioId,
      detalhes: options.detalhes ?? '',
    },
  });
  if (!res.ok()) {
    throw new Error(`createCasoByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { caso?: { id?: number }; id?: number };
  const id = body.caso?.id ?? body.id;
  if (!id) throw new Error('createCasoByApi: resposta sem id');
  return id;
}

const CASO_STATUS_BY_COLUMN: Record<string, string> = {
  Solicitação: 'solicitacao',
  'Enviado para laboratório': 'enviado_laboratorio',
  'Retornado à clínica': 'retornado_clinica',
  Instalado: 'instalado',
};

export async function moveCasoToColumnByApi(
  request: APIRequestContext,
  token: string,
  casoId: number,
  column: keyof typeof CASO_STATUS_BY_COLUMN | string
): Promise<void> {
  const status = CASO_STATUS_BY_COLUMN[column] ?? column;
  const attempts = [
  { status },
  { etapa: status },
  { fase: status },
  { status_kanban: status },
  ];

  for (const data of attempts) {
    const res = await request.patch(`${e2eEnv.apiUrl}/controle-protese/casos/${casoId}`, {
      headers: authHeaders(token),
      data,
    });
    if (res.ok()) return;
  }

  throw new Error(`moveCasoToColumnByApi: não foi possível mover caso ${casoId} para ${column}`);
}

export async function deleteCasoByApi(
  request: APIRequestContext,
  token: string,
  casoId: number
): Promise<void> {
  await request.delete(`${e2eEnv.apiUrl}/controle-protese/casos/${casoId}`, {
    headers: authHeaders(token),
  });
}

export async function deleteLaboratorioByApi(
  request: APIRequestContext,
  token: string,
  laboratorioId: number
): Promise<void> {
  await request.delete(`${e2eEnv.apiUrl}/controle-protese/laboratorios/${laboratorioId}`, {
    headers: authHeaders(token),
  });
}

export async function createPatientForProtese(
  request: APIRequestContext,
  token: string,
  prefix = 'Protese'
): Promise<{ id: number; name: string }> {
  const name = e2eName(prefix);
  const id = await createPatientByApi(request, token, name);
  return { id: Number.parseInt(id, 10), name };
}

export async function cleanupProteseSeeds(
  request: APIRequestContext,
  token: string,
  casos: number[],
  laboratorios: number[],
  patientIds: string[] = []
): Promise<void> {
  for (const casoId of casos) {
    await deleteCasoByApi(request, token, casoId).catch(() => undefined);
  }
  for (const labId of laboratorios) {
    await deleteLaboratorioByApi(request, token, labId).catch(() => undefined);
  }
  const { deletePatientByApi } = await import('./crud-helpers');
  for (const patientId of patientIds) {
    await deletePatientByApi(request, token, patientId).catch(() => undefined);
  }
}

export async function expectCasoInApi(
  request: APIRequestContext,
  token: string,
  casoId: number
): Promise<void> {
  const res = await request.get(`${e2eEnv.apiUrl}/controle-protese/casos/${casoId}`, {
    headers: authHeaders(token),
  });
  expect(res.ok()).toBeTruthy();
}
