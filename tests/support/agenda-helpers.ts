import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { e2eEnv } from './env';
import { createPatientByApi, deletePatientByApi, e2eName, readAccessToken } from './crud-helpers';

export { e2eName };

export interface AgendaProfessional {
  id: number;
  nome_exibicao: string;
}

export interface AgendaRoom {
  id: number;
  nome: string;
}

export interface AgendaEventSeed {
  id: number;
  tipo: 'consulta' | 'compromisso' | 'tarefa';
  titulo: string;
  data: string;
  professionalId?: number;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function skipWeekend(date: Date): Date {
  const d = new Date(date);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Gera slot único no expediente para evitar colisões entre execuções. */
export function uniqueAgendaSlot(offsetDays = 2, hour = 10, minute = 0, salt = 0): {
  data: string;
  hora: string;
  inicio: string;
  fim: string;
} {
  const t = Date.now() + salt * 9973;
  const uniqueMinute = (minute + Math.floor(t / 1000) + salt * 7) % 60;
  const uniqueHour = 9 + ((hour + Math.floor(t / 60000) % 9 + salt * 3) % 9);
  const extraDays = Math.floor(t / 3_600_000) % 14;
  const date = skipWeekend(addDays(new Date(), offsetDays + extraDays + salt));
  const data = formatDate(date);
  const hora = `${String(uniqueHour).padStart(2, '0')}:${String(uniqueMinute).padStart(2, '0')}`;
  const inicio = `${data}T${hora}:00`;
  const endMinute = (uniqueMinute + 30) % 60;
  const endHour = uniqueHour + (uniqueMinute + 30 >= 60 ? 1 : 0);
  const fim = `${data}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`;
  return { data, hora, inicio, fim };
}

export async function listProfessionalsByApi(
  request: APIRequestContext,
  token: string
): Promise<AgendaProfessional[]> {
  const res = await request.get(`${e2eEnv.apiUrl}/profissionais`, { headers: authHeaders(token) });
  if (!res.ok()) return [];
  const body = (await res.json()) as { profissionais?: AgendaProfessional[] };
  return body.profissionais ?? [];
}

export async function listRoomsByApi(request: APIRequestContext, token: string): Promise<AgendaRoom[]> {
  const res = await request.get(`${e2eEnv.apiUrl}/salas-cadeiras`, { headers: authHeaders(token) });
  if (!res.ok()) return [];
  const body = (await res.json()) as { salasCadeiras?: AgendaRoom[] };
  return body.salasCadeiras ?? [];
}

export function slotEndHora(hora: string, minutes = 30): string {
  const [h, m] = hora.split(':').map((v) => Number.parseInt(v, 10));
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export async function listEventsByApi(
  request: APIRequestContext,
  token: string,
  de: string,
  ate: string
): Promise<unknown[]> {
  const res = await request.get(`${e2eEnv.apiUrl}/agenda/eventos?de=${de}&ate=${ate}`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return [];
  const body = (await res.json()) as { eventos?: unknown[] };
  return body.eventos ?? [];
}

export async function listTarefasByApi(
  request: APIRequestContext,
  token: string,
  de: string,
  ate?: string
): Promise<Array<{ id: number; titulo: string }>> {
  const query = ate ? `de=${de}&ate=${ate}` : `data=${de}`;
  const res = await request.get(`${e2eEnv.apiUrl}/agenda/tarefas?${query}`, {
    headers: authHeaders(token),
  });
  if (!res.ok()) return [];
  const body = (await res.json()) as { tarefas?: Array<{ id: number; titulo: string }> };
  return body.tarefas ?? [];
}

export async function expectEventInApi(
  request: APIRequestContext,
  token: string,
  titulo: string | RegExp,
  data: string
): Promise<void> {
  await expect
    .poll(async () => {
      const events = await listEventsByApi(request, token, data, data);
      return events.some((event) => {
        const label = (event as { titulo?: string }).titulo ?? '';
        return typeof titulo === 'string' ? label === titulo : titulo.test(label);
      });
    }, { timeout: 15_000 })
    .toBe(true);
}

export async function expectTarefaCreatedByApi(
  request: APIRequestContext,
  token: string,
  titulo: string,
  data: string
): Promise<number> {
  const tarefas = await listTarefasByApi(request, token, data, data);
  const match = tarefas.find((t) => t.titulo === titulo);
  expect(match, `Tarefa "${titulo}" não encontrada na API`).toBeTruthy();
  return match!.id;
}

export async function createTarefaByApi(
  request: APIRequestContext,
  token: string,
  options: {
    titulo: string;
    data: string;
    horaInicio?: string;
    horaFim?: string;
    profissionalId?: number;
    prioridade?: string;
    area?: string;
  }
): Promise<number> {
  const res = await request.post(`${e2eEnv.apiUrl}/agenda/tarefas`, {
    headers: authHeaders(token),
    data: {
      titulo: options.titulo,
      data: options.data,
      hora_inicio: options.horaInicio ?? '09:00',
      hora_fim: options.horaFim ?? '09:30',
      profissional_id: options.profissionalId,
      prioridade: options.prioridade ?? 'media',
      area: options.area ?? 'administrativo',
    },
  });
  if (!res.ok()) {
    throw new Error(`createTarefaByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { tarefa?: { id?: number } };
  const id = body.tarefa?.id;
  if (!id) throw new Error('createTarefaByApi: resposta sem id');
  return id;
}

export async function createCompromissoByApi(
  request: APIRequestContext,
  token: string,
  options: {
    titulo: string;
    data: string;
    horaInicio?: string;
    horaFim?: string;
    professionalId: number;
    salaId?: number;
    descricao?: string;
  }
): Promise<number> {
  const res = await request.post(`${e2eEnv.apiUrl}/agenda/compromissos`, {
    headers: authHeaders(token),
    data: {
      professional_id: options.professionalId,
      sala_cadeira_id: options.salaId,
      data: options.data,
      hora_inicio: options.horaInicio ?? '09:00',
      hora_fim: options.horaFim ?? '09:30',
      titulo: options.titulo,
      descricao: options.descricao ?? '',
    },
  });
  if (!res.ok()) {
    throw new Error(`createCompromissoByApi failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { compromisso?: { id?: number }; id?: number };
  const id = body.compromisso?.id ?? body.id;
  if (!id) throw new Error('createCompromissoByApi: resposta sem id');
  return id;
}

/** Cria compromisso em slot livre, tentando horários alternativos em caso de conflito 409. */
export async function createCompromissoByApiUnique(
  request: APIRequestContext,
  token: string,
  options: {
    titulo: string;
    professionalId: number;
    salaId?: number;
    descricao?: string;
    offsetDays?: number;
    baseHour?: number;
  }
): Promise<{ id: number; slot: ReturnType<typeof uniqueAgendaSlot> }> {
  const maxAttempts = 10;
  let lastError = '';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const slot = uniqueAgendaSlot(options.offsetDays ?? 3, options.baseHour ?? 8, 0, attempt);
    const res = await request.post(`${e2eEnv.apiUrl}/agenda/compromissos`, {
      headers: authHeaders(token),
      data: {
        professional_id: options.professionalId,
        sala_cadeira_id: options.salaId,
        data: slot.data,
        hora_inicio: slot.hora,
        hora_fim: slotEndHora(slot.hora),
        titulo: options.titulo,
        descricao: options.descricao ?? '',
      },
    });

    if (res.status() === 409) {
      lastError = (await res.text()).slice(0, 300);
      continue;
    }

    if (!res.ok()) {
      throw new Error(`createCompromissoByApiUnique failed (${res.status()}): ${(await res.text()).slice(0, 300)}`);
    }

    const body = (await res.json()) as { compromisso?: { id?: number }; id?: number };
    const id = body.compromisso?.id ?? body.id;
    if (!id) throw new Error('createCompromissoByApiUnique: resposta sem id');
    return { id, slot };
  }

  throw new Error(
    `createCompromissoByApiUnique: sem slot livre após ${maxAttempts} tentativas. Último 409: ${lastError}`
  );
}

export async function deleteTarefaByApi(request: APIRequestContext, token: string, id: number): Promise<void> {
  await request.delete(`${e2eEnv.apiUrl}/agenda/tarefas/${id}`, { headers: authHeaders(token) });
}

export async function deleteCompromissoByApi(
  request: APIRequestContext,
  token: string,
  id: number
): Promise<void> {
  await request.delete(`${e2eEnv.apiUrl}/agenda/compromissos/${id}`, { headers: authHeaders(token) });
}

export async function deleteConsultaByApi(
  request: APIRequestContext,
  token: string,
  id: number
): Promise<void> {
  for (const url of [
    `${e2eEnv.apiUrl}/agenda/consultas/${id}`,
    `${e2eEnv.apiUrl}/agenda/consulta/${id}`,
  ]) {
    const res = await request.delete(url, { headers: authHeaders(token) });
    if (res.ok()) return;
  }
}

export async function deleteEventByApi(
  request: APIRequestContext,
  token: string,
  seed: AgendaEventSeed
): Promise<void> {
  if (seed.tipo === 'tarefa') await deleteTarefaByApi(request, token, seed.id);
  else if (seed.tipo === 'compromisso') await deleteCompromissoByApi(request, token, seed.id);
  else await deleteConsultaByApi(request, token, seed.id);
}

export async function createPatientForAgenda(
  request: APIRequestContext,
  token: string,
  prefix = 'Agenda'
): Promise<{ id: string; name: string }> {
  const name = e2eName(prefix);
  const id = await createPatientByApi(request, token, name);
  return { id, name };
}

export async function cleanupAgendaSeeds(
  request: APIRequestContext,
  token: string,
  seeds: AgendaEventSeed[],
  patientIds: string[] = []
): Promise<void> {
  for (const seed of seeds) {
    await deleteEventByApi(request, token, seed).catch(() => undefined);
  }
  for (const patientId of patientIds) {
    await deletePatientByApi(request, token, patientId).catch(() => undefined);
  }
}

export async function waitForAgendaEventsReload(page: Page): Promise<void> {
  await page
    .waitForResponse((res) => res.url().includes('/api/agenda/eventos') && res.request().method() === 'GET', {
      timeout: 20_000,
    })
    .catch(() => undefined);
}

export async function installPrintStub(page: Page): Promise<{ getCount: () => Promise<number> }> {
  await page.addInitScript(() => {
    (window as unknown as { __e2ePrintCount?: number }).__e2ePrintCount = 0;
    window.print = () => {
      (window as unknown as { __e2ePrintCount?: number }).__e2ePrintCount =
        ((window as unknown as { __e2ePrintCount?: number }).__e2ePrintCount ?? 0) + 1;
    };
  });
  await page.evaluate(() => {
    (window as unknown as { __e2ePrintCount?: number }).__e2ePrintCount = 0;
    window.print = () => {
      (window as unknown as { __e2ePrintCount?: number }).__e2ePrintCount =
        ((window as unknown as { __e2ePrintCount?: number }).__e2ePrintCount ?? 0) + 1;
    };
  });
  return {
    getCount: () =>
      page.evaluate(() => (window as unknown as { __e2ePrintCount?: number }).__e2ePrintCount ?? 0),
  };
}

export async function readTokenFromPage(page: Page): Promise<string> {
  const token = await readAccessToken(page);
  expect(token).toBeTruthy();
  return token!;
}

export function toBrDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}
