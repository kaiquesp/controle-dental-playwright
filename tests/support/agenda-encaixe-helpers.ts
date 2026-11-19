import { expect, type APIRequestContext, type Locator, type Page, type Response } from '@playwright/test';
import { AGENDA_FORM_IDS } from '../data/agenda';
import type { AgendaPage } from '../pages/agenda.page';
import { e2eEnv } from './env';
import { selectIftaByInputId } from './interaction-helpers';

export type EncaixePriorityLabel = 'Normal' | 'Alta';

export interface ConsultaEncaixeState {
  ehEncaixe: boolean;
  prioridade: string | null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Profissional do formulário de consulta, pelo nome de exibição (o rótulo pode vir com "Dr."/"Dra."). */
export async function selectConsultaProfessional(agendaPage: AgendaPage, professionalName: string): Promise<void> {
  await selectIftaByInputId(
    agendaPage.page,
    AGENDA_FORM_IDS.consulta.profissional,
    new RegExp(escapeRegExp(professionalName.trim()), 'i'),
    agendaPage.scheduleDialog()
  );
}

export function encaixeCheckbox(agendaPage: AgendaPage): Locator {
  return agendaPage.scheduleDialog().getByRole('checkbox', { name: /Marcar como encaixe/i });
}

export async function markAsEncaixe(agendaPage: AgendaPage, priority: EncaixePriorityLabel): Promise<void> {
  const checkbox = encaixeCheckbox(agendaPage);
  await checkbox.scrollIntoViewIfNeeded();
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  if (priority !== 'Normal') {
    await selectIftaByInputId(
      agendaPage.page,
      'agenda-consulta-encaixe-prioridade',
      new RegExp(`^\\s*${priority}\\s*$`, 'i'),
      agendaPage.scheduleDialog()
    );
  }
}

/**
 * Clica em "Agendar consulta" e devolve a resposta do POST, sem o fallback de horário alternativo do
 * `saveAppointment` — aqui o 409 por conflito é justamente o que o teste precisa enxergar.
 */
export async function submitConsultaAndCapture(agendaPage: AgendaPage): Promise<Response> {
  const page = agendaPage.page;
  const isConsultaPost = (res: Response) =>
    res.request().method() === 'POST' && /\/api\/consultas(\?|$)/.test(res.url());
  const save = agendaPage.scheduleDialog().getByRole('button', { name: /Agendar consulta|Agendar|Salvar/i }).first();
  await save.scrollIntoViewIfNeeded();

  const [first] = await Promise.all([page.waitForResponse(isConsultaPost, { timeout: 30_000 }), save.click()]);
  const body = (await first.json().catch(() => ({}))) as { confirmavel?: boolean };
  if (!body.confirmavel) {
    return first;
  }
  // Horário fora do expediente: a API pede confirmação e o front reenvia com `confirmar_fora_horario`.
  const [second] = await Promise.all([
    page.waitForResponse(isConsultaPost, { timeout: 30_000 }),
    agendaPage.confirmOutsideHoursIfNeeded(true),
  ]);
  return second;
}

export function dayEventCard(page: Page, patientName: string): Locator {
  return page.getByTestId('agenda-day-event').filter({ hasText: new RegExp(escapeRegExp(patientName.slice(0, 18))) });
}

export async function readConsultaEncaixeByApi(
  request: APIRequestContext,
  token: string,
  id: number
): Promise<ConsultaEncaixeState> {
  const res = await request.get(`${e2eEnv.apiUrl}/consultas/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `GET /consultas/${id} falhou (${res.status()})`).toBe(true);
  const body = (await res.json()) as {
    consulta?: { eh_encaixe?: number | boolean; prioridade_encaixe?: string | null };
    eh_encaixe?: number | boolean;
    prioridade_encaixe?: string | null;
  };
  const row = body.consulta ?? body;
  return { ehEncaixe: Boolean(Number(row.eh_encaixe ?? 0)), prioridade: row.prioridade_encaixe ?? null };
}

export async function patchConsultaStatusByApi(
  request: APIRequestContext,
  token: string,
  id: number,
  status: string
): Promise<number> {
  const res = await request.patch(`${e2eEnv.apiUrl}/consultas/${id}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { status },
  });
  return res.status();
}
