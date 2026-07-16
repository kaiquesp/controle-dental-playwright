import type { BrowserContext, Page, Route } from '@playwright/test';
import { e2eEnv } from './env';

export type GoogleCalendarStatusDto = {
  conectado: boolean;
  habilitadoNoServidor: boolean;
  status: string;
  googleAccountEmail: string | null;
  googleCalendarId: string | null;
  lastSyncAt: string | null;
  errorMessage: string | null;
  professionalId: number | null;
  syncConsultasParaGoogle: boolean;
  alertasMinutosAntes: number[];
  precisaReconectarParaEscrita: boolean;
};

export type GoogleCalendarMockState = {
  current: GoogleCalendarStatusDto;
  /** How many times the mock served GET /status (avoids response.json on fulfilled routes). */
  statusHits?: number;
  /** Last authorizeUrl returned by GET /connect. */
  lastConnectAuthorizeUrl?: string | null;
};

export function createGoogleCalendarMockState(
  current: GoogleCalendarStatusDto
): GoogleCalendarMockState {
  return { current, statusHits: 0, lastConnectAuthorizeUrl: null };
}

const GOOGLE_CALENDAR_API = /\/api\/integracoes\/google-calendar(?:\/|\?|$)/i;
const GOOGLE_ACCOUNTS = /accounts\.google\.com/i;

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    },
    body: JSON.stringify(body),
  });
}

export function buildDisconnectedStatus(
  overrides: Partial<GoogleCalendarStatusDto> = {}
): GoogleCalendarStatusDto {
  return {
    conectado: false,
    habilitadoNoServidor: true,
    status: 'not_configured',
    googleAccountEmail: null,
    googleCalendarId: null,
    lastSyncAt: null,
    errorMessage: null,
    professionalId: 1,
    syncConsultasParaGoogle: true,
    alertasMinutosAntes: [1440, 60],
    precisaReconectarParaEscrita: false,
    ...overrides,
  };
}

export function buildConnectedStatus(
  overrides: Partial<GoogleCalendarStatusDto> = {}
): GoogleCalendarStatusDto {
  return {
    conectado: true,
    habilitadoNoServidor: true,
    status: 'active',
    googleAccountEmail: 'e2e-google@example.com',
    googleCalendarId: 'e2e-cal@group.calendar.google.com',
    lastSyncAt: new Date().toISOString(),
    errorMessage: null,
    professionalId: 1,
    syncConsultasParaGoogle: true,
    alertasMinutosAntes: [1440, 60],
    precisaReconectarParaEscrita: false,
    ...overrides,
  };
}

/** OAuth seguro: authorizeUrl aponta de volta ao app (sem Google real). */
export function e2eGoogleAuthorizeUrl(): string {
  return `${e2eEnv.baseUrl}/agenda?google_calendar=connected`;
}

function createGoogleCalendarRouteHandler(state: GoogleCalendarMockState) {
  return async (route: Route): Promise<void> => {
    const request = route.request();
    const method = request.method();
    const url = request.url();

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
        },
      });
      return;
    }

    if (method === 'GET' && url.includes('/status')) {
      state.statusHits = (state.statusHits ?? 0) + 1;
      await fulfillJson(route, state.current);
      return;
    }

    if (method === 'GET' && url.includes('/connect')) {
      const authorizeUrl = e2eGoogleAuthorizeUrl();
      state.lastConnectAuthorizeUrl = authorizeUrl;
      await fulfillJson(route, {
        authorizeUrl,
        professionalId: state.current.professionalId ?? 1,
      });
      return;
    }

    if (method === 'POST' && url.includes('/disconnect')) {
      state.current = buildDisconnectedStatus({
        professionalId: state.current.professionalId,
        habilitadoNoServidor: state.current.habilitadoNoServidor,
      });
      await fulfillJson(route, {
        desconectado: true,
        mensagem: 'Conta desconectada.',
      });
      return;
    }

    if (method === 'PUT' && url.includes('/settings')) {
      const body = (request.postDataJSON() ?? {}) as {
        sync_consultas_para_google?: boolean;
        alertas_minutos_antes?: number[];
      };
      if (typeof body.sync_consultas_para_google === 'boolean') {
        state.current = {
          ...state.current,
          syncConsultasParaGoogle: body.sync_consultas_para_google,
        };
      }
      if (Array.isArray(body.alertas_minutos_antes)) {
        state.current = {
          ...state.current,
          alertasMinutosAntes: body.alertas_minutos_antes,
        };
      }
      await fulfillJson(route, {
        ...state.current,
        mensagem: 'Configurações salvas.',
      });
      return;
    }

    await route.continue();
  };
}

/**
 * Mocka `/api/integracoes/google-calendar/**` e bloqueia accounts.google.com.
 * Prefira `context` (intercepta todas as páginas); evita registrar page+context juntos
 * (duplo fulfill quebra a rota).
 */
export async function installGoogleCalendarMocks(
  page: Page,
  state: GoogleCalendarMockState,
  context?: BrowserContext
): Promise<void> {
  const handler = createGoogleCalendarRouteHandler(state);
  const target = context ?? page;

  await target.route(GOOGLE_CALENDAR_API, handler);
  await target.route(GOOGLE_ACCOUNTS, async (route) => {
    await route.abort('blockedbyclient');
  });
}

/** Captures outbound redirects without leaving the app when possible. */
export async function stubLocationAssign(page: Page): Promise<void> {
  const install = () => {
    const w = window as unknown as { __cdE2eRedirects?: string[] };
    const redirects = w.__cdE2eRedirects ?? [];
    w.__cdE2eRedirects = redirects;

    const capture = (url: string | URL): void => {
      redirects.push(String(url));
    };

    try {
      Location.prototype.assign = function assignStub(url: string | URL) {
        capture(url);
      };
      Location.prototype.replace = function replaceStub(url: string | URL) {
        capture(url);
      };
    } catch {
      /* prototype may be non-configurable in some embeds */
    }

    // Chromium often ignores Location.prototype patches for window.location.assign.
    try {
      const loc = window.location;
      const assignFn = loc.assign.bind(loc);
      const replaceFn = loc.replace.bind(loc);
      loc.assign = ((url: string | URL) => {
        capture(url);
      }) as typeof loc.assign;
      loc.replace = ((url: string | URL) => {
        capture(url);
      }) as typeof loc.replace;
      void assignFn;
      void replaceFn;
    } catch {
      /* location methods may be non-writable — tests fall back to in-app URL assert */
    }
  };

  await page.addInitScript(install);
  await page.evaluate(install).catch(() => undefined);
}

export async function readStubbedRedirects(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    return (window as unknown as { __cdE2eRedirects?: string[] }).__cdE2eRedirects ?? [];
  });
}

function localIsoDateTime(hours: number, minutes = 0): { inicio: string; fim: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const inicio = `${y}-${m}-${d}T${pad(hours)}:${pad(minutes)}:00`;
  const endH = hours + 1;
  const fim = `${y}-${m}-${d}T${pad(endH)}:${pad(minutes)}:00`;
  return { inicio, fim };
}

/** Injeta um evento `tipo: google` no feed da agenda (mantém eventos reais). */
export async function installAgendaGoogleOverlayMock(
  page: Page,
  options: { title?: string; professionalId?: number } = {}
): Promise<void> {
  const title = options.title ?? 'E2E-Google-Evento';
  const professionalId = options.professionalId ?? 1;
  const { inicio, fim } = localIsoDateTime(10);

  await page.route(/\/api\/agenda\/eventos/i, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    let body: Record<string, unknown> = { eventos: [] };
    try {
      const response = await route.fetch();
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      /* feed vazio se a API falhar */
    }

    const eventos = Array.isArray(body.eventos) ? [...body.eventos] : [];
    const already = eventos.some(
      (e) =>
        e &&
        typeof e === 'object' &&
        (e as { id?: string }).id === 'e2e-google-event-1'
    );
    if (!already) {
      eventos.push({
        tipo: 'google',
        id: 'e2e-google-event-1',
        inicio,
        fim,
        titulo: title,
        all_day: false,
        html_link: 'https://www.google.com/calendar/event?eid=e2e',
        professional_id: professionalId,
      });
    }

    await fulfillJson(route, { ...body, eventos });
  });
}
