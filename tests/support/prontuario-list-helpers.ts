import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { e2eName } from './crud-helpers';
import { e2eEnv } from './env';
import { listProfessionalsByApi } from './agenda-helpers';

export const PRONTUARIO_INFINITE_SCROLL_PAGE_SIZE = 10;
export const PRONTUARIO_INFINITE_SCROLL_MIN_TOTAL = PRONTUARIO_INFINITE_SCROLL_PAGE_SIZE + 1;

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function postJson(
  request: APIRequestContext,
  token: string,
  url: string,
  data: unknown
): Promise<void> {
  const response = await request.post(url, { headers: authHeaders(token), data });
  if (!response.ok()) {
    throw new Error(`POST ${url} failed (${response.status()}): ${(await response.text()).slice(0, 300)}`);
  }
}

export type InfiniteScrollFooter = {
  loaded: number;
  total: number;
};

export function parseInfiniteScrollFooter(text: string): InfiniteScrollFooter | null {
  const match = text.match(/Exibindo\s+(\d+)\s+de\s+(\d+)/i);
  if (!match) {
    return null;
  }
  return { loaded: Number(match[1]), total: Number(match[2]) };
}

export async function expectInfiniteScrollLoadsMore(
  page: Page,
  options: {
    footerPattern: RegExp;
    loadingPattern: RegExp;
    minTotal?: number;
  }
): Promise<void> {
  const minTotal = options.minTotal ?? PRONTUARIO_INFINITE_SCROLL_MIN_TOTAL;
  const footer = page.getByText(options.footerPattern);
  await expect(footer).toBeVisible({ timeout: 20_000 });

  const beforeText = (await footer.textContent()) ?? '';
  const before = parseInfiniteScrollFooter(beforeText);
  if (!before) {
    throw new Error(`Rodapé de scroll infinito inesperado: "${beforeText}"`);
  }

  expect(before.total).toBeGreaterThanOrEqual(minTotal);
  expect(before.loaded).toBeLessThanOrEqual(PRONTUARIO_INFINITE_SCROLL_PAGE_SIZE);
  expect(before.loaded).toBeLessThan(before.total);

  await expect(page.locator('.novo-paciente__prontuario-paginator, .p-paginator')).toHaveCount(0);

  const sentinel = page.locator('.novo-paciente__prontuario-infinite-sentinel').last();
  await sentinel.scrollIntoViewIfNeeded();
  await expect(page.getByText(options.loadingPattern)).toBeVisible({ timeout: 15_000 });

  await expect
    .poll(async () => parseInfiniteScrollFooter((await footer.textContent()) ?? '')?.loaded ?? 0)
    .toBeGreaterThan(before.loaded);

  const afterText = (await footer.textContent()) ?? '';
  const after = parseInfiniteScrollFooter(afterText);
  expect(after?.total).toBe(before.total);
  expect(after?.loaded).toBeGreaterThan(before.loaded);
}

export async function seedOrcamentosForInfiniteScroll(
  request: APIRequestContext,
  token: string,
  patientId: string,
  count = PRONTUARIO_INFINITE_SCROLL_MIN_TOTAL
): Promise<void> {
  const url = `${e2eEnv.apiUrl}/pacientes/${patientId}/orcamentos`;
  for (let index = 0; index < count; index += 1) {
    await postJson(request, token, url, {
      nome_descricao_orcamento: e2eName(`Orc-Inf-${index}`),
      data_validade: '2026-12-31',
      status: 'pendente',
      observacoes: `E2E infinite scroll seed ${index}`,
      itens: [
        {
          nome_procedimento: 'Consulta',
          valor_unitario: 100,
          total_linha: 100,
          valor: 100,
        },
      ],
    });
  }
}

export async function seedTratamentosForInfiniteScroll(
  request: APIRequestContext,
  token: string,
  patientId: string,
  count = PRONTUARIO_INFINITE_SCROLL_MIN_TOTAL
): Promise<void> {
  const url = `${e2eEnv.apiUrl}/pacientes/${patientId}/tratamentos-clinicos`;
  for (let index = 0; index < count; index += 1) {
    await postJson(request, token, url, {
      nome_procedimento: e2eName(`Trat-Inf-${index}`),
      data: todayIso(),
      status: 'a_realizar',
      obs: `E2E infinite scroll seed ${index}`,
    });
  }
}

export async function seedDocumentosForInfiniteScroll(
  request: APIRequestContext,
  token: string,
  patientId: string,
  count = PRONTUARIO_INFINITE_SCROLL_MIN_TOTAL
): Promise<void> {
  const url = `${e2eEnv.apiUrl}/pacientes/${patientId}/documentos`;
  for (let index = 0; index < count; index += 1) {
    await postJson(request, token, url, {
      tipo_documento: 'termo',
      titulo: e2eName(`Doc-Inf-${index}`),
      conteudo_html: `<p>E2E infinite scroll seed ${index}</p>`,
      data_documento: todayIso(),
      status: 'rascunho',
    });
  }
}

export async function seedReceituariosForInfiniteScroll(
  request: APIRequestContext,
  token: string,
  patientId: string,
  count = PRONTUARIO_INFINITE_SCROLL_MIN_TOTAL
): Promise<void> {
  const professionals = await listProfessionalsByApi(request, token);
  const professionalId = professionals[0]?.id;
  if (professionalId == null) {
    throw new Error('Nenhum profissional disponível para seed de receituário E2E');
  }

  const url = `${e2eEnv.apiUrl}/pacientes/${patientId}/receituarios`;
  for (let index = 0; index < count; index += 1) {
    await postJson(request, token, url, {
      tipo_documento: 'prescricao',
      data: todayIso(),
      professional_id: professionalId,
      controle_especial: false,
      salvar_no_prontuario: true,
      medicamentos: [{ nome: e2eName(`Med-Inf-${index}`), posologia: '1x ao dia' }],
    });
  }
}

export async function seedPagamentosForInfiniteScroll(
  request: APIRequestContext,
  token: string,
  patientId: string,
  count = PRONTUARIO_INFINITE_SCROLL_MIN_TOTAL
): Promise<void> {
  const url = `${e2eEnv.apiUrl}/pacientes/${patientId}/pagamentos`;
  for (let index = 0; index < count; index += 1) {
    await postJson(request, token, url, {
      valor: 50 + index,
      data: todayIso(),
      data_transacao: todayIso(),
      data_vencimento: todayIso(),
      descricao: e2eName(`Pag-Inf-${index}`),
      categoria: 'tratamento',
      status: 'pendente',
      forma_pagamento: 'dinheiro',
      tipo: 'receita',
    });
  }
}

export async function seedPendingPagamento(
  request: APIRequestContext,
  token: string,
  patientId: string,
  descricao: string,
  valor = 150
): Promise<void> {
  await postJson(request, token, `${e2eEnv.apiUrl}/pacientes/${patientId}/pagamentos`, {
    valor,
    data: todayIso(),
    data_transacao: todayIso(),
    data_vencimento: todayIso(),
    descricao,
    categoria: 'tratamento',
    status: 'pendente',
    forma_pagamento: 'dinheiro',
    tipo: 'receita',
  });
}
