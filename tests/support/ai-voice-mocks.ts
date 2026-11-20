import { expect, type APIRequestContext, type Browser, type Page, type Request, type Route } from '@playwright/test';
import { createAuthenticatedE2eContext, readAccessToken } from './crud-helpers';
import { e2eEnv } from './env';
import { setAiVoiceFeatureFlag } from './feature-mocks';

/**
 * Kit de mocks do Assistente IA por Voz (prontuário).
 *
 * Regra de ouro: a suíte NUNCA chama a IA real nem consome créditos. Todas as rotas
 * `/api/ai-voice/**` e `/api/ai-voice-public/**` são interceptadas aqui; qualquer rota
 * sem resposta configurada devolve 501 (nunca `route.continue()`).
 */

export type AiVoiceRouteKey =
  | 'balance'
  | 'clinicalRecord'
  | 'clinicalImprove'
  | 'textRecord'
  | 'textImprove'
  | 'treatmentFill';

const ROUTE_SUFFIX: Record<AiVoiceRouteKey, string> = {
  balance: '/api/ai-voice/balance',
  clinicalRecord: '/api/ai-voice/clinical-record/record',
  clinicalImprove: '/api/ai-voice/clinical-record/improve',
  textRecord: '/api/ai-voice/text/record',
  textImprove: '/api/ai-voice/text/improve',
  treatmentFill: '/api/ai-voice/treatment/fill',
};

export type AiVoiceBalanceBody = {
  saldo_creditos?: unknown;
  franquia_mensal?: number;
  pode_comprar_pacote?: boolean;
  ia_disponivel?: boolean;
  creditos_por_acao?: number;
  max_segundos_gravacao?: number;
};

export function aiVoiceBalance(credits: number, overrides: AiVoiceBalanceBody = {}): AiVoiceBalanceBody {
  return {
    saldo_creditos: credits,
    franquia_mensal: 100,
    pode_comprar_pacote: true,
    ia_disponivel: true,
    creditos_por_acao: 1,
    max_segundos_gravacao: 300,
    ...overrides,
  };
}

/** Resposta configurada para uma rota de IA. */
export type AiVoiceReply = {
  status?: number;
  json?: unknown;
  /** Corpo cru (ex.: HTML) — usado quando `json` não é informado. */
  body?: string;
  contentType?: string;
  /** Atraso antes de responder (relógio real do Node, não afetado por `page.clock`). */
  delayMs?: number;
  /** Falha de rede (`route.abort('failed')`). */
  abort?: boolean;
  /** Nunca responde (timeout do front). */
  hang?: boolean;
  /** Responde só quando a promessa resolver (controle fino de "processando"). */
  gate?: Promise<void>;
};

export type AiVoiceReplyFactory = AiVoiceReply | ((body: Record<string, unknown>) => AiVoiceReply);

export type AiVoiceCall = { key: AiVoiceRouteKey | 'unknown'; method: string; url: string; body: Record<string, unknown> };

/** Corpos de erro reais do backend (`ai-voice.route.ts`). */
export const AI_VOICE_ERROR_BODIES = {
  insufficientCredits: (saldo = 0) => ({
    codigo: 'INSUFFICIENT_MESSAGE_CREDITS',
    canal: 'ai_voice',
    saldo,
    necessario: 1,
    podeComprarPacote: true,
    renovacaoPlanoEm: null,
    erro: 'Saldo insuficiente de creditos do Assistente IA.',
    motivo: 'insufficient_credits',
  }),
  aiNotConfigured: {
    erro: 'Assistente IA indisponivel no momento.',
    mensagem: 'O Assistente IA ainda nao esta configurado.',
    motivo: 'ai_not_configured',
  },
  providerFailure: {
    erro: 'Nao foi possivel processar com a IA.',
    mensagem: 'O servico de IA falhou. Nenhum credito foi debitado. Tente novamente.',
    motivo: 'ai_provider_failure',
  },
  roleForbidden: { erro: 'Sem permissao para este recurso.' },
  flagForbidden: { erro: 'Funcionalidade indisponivel.', feature: 'is_ai_voice' },
  planBlocked: {
    erro: 'Assinatura inativa ou periodo de teste encerrado. Contrate um plano para continuar.',
    acao: 'contratar',
  },
  featureNotInPlan: {
    erro: 'Funcionalidade indisponível no plano atual.',
    feature: 'mod_pacientes',
    planAtual: 'basico',
    motivo: 'feature_not_in_plan',
  },
  textTooLong: { erro: 'Texto muito longo (maximo 8000 caracteres).' },
  transcriptTooLong: { erro: 'Transcricao muito longa (maximo 4000 caracteres).' },
  audioTooBig: { erro: 'Audio muito grande (maximo 15 MB).' },
  durationExceeded: (max: number) => ({ erro: `Gravacao excede ${max} segundos.` }),
};

/** Sugestões de sucesso padrão (formato snake_case do backend). */
export const AI_VOICE_OK = {
  clinicalImprove: (realizado: string, plano = '', saldo = 9) => ({
    sugestao: { realizado, plano_proxima_consulta: plano },
    saldo_creditos: saldo,
  }),
  clinicalRecord: (realizado: string, plano = '', saldo = 9) => ({
    transcricao: `${realizado} ${plano}`.trim(),
    sugestao: { realizado, plano_proxima_consulta: plano },
    saldo_creditos: saldo,
  }),
  text: (texto: string, saldo = 9) => ({ transcricao: texto, texto, saldo_creditos: saldo }),
  treatmentFill: (sugestao: Record<string, unknown>, saldo = 9, transcricao = 'transcricao da IA') => ({
    transcricao,
    sugestao: {
      procedimento_id: null,
      procedimento_texto: '',
      denticao: null,
      dente: null,
      faces: [],
      status: null,
      profissional_id: null,
      data: null,
      detalhes_prox_consulta: '',
      obs: '',
      nao_identificado: [],
      ...sugestao,
    },
    saldo_creditos: saldo,
  }),
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function keyFromUrl(url: string): AiVoiceRouteKey | 'unknown' {
  const path = new URL(url).pathname;
  const hit = (Object.keys(ROUTE_SUFFIX) as AiVoiceRouteKey[]).find((key) => path.endsWith(ROUTE_SUFFIX[key]));
  return hit ?? 'unknown';
}

function safeJson(request: Request): Record<string, unknown> {
  try {
    const body = request.postDataJSON() as unknown;
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type AiVoiceMockOptions = {
  /** Valor de `is_ai_voice` em `/api/feature-flags` (padrão true). */
  flag?: boolean;
  balance?: AiVoiceReplyFactory;
  /** Resposta da rota pública do modelo Vosk (padrão 404 — nunca baixa o modelo real). */
  wakeWordModel?: AiVoiceReply;
};

/**
 * Intercepta todas as rotas do Assistente IA por Voz e registra as chamadas para validação de payload.
 * Use `reply(key, ...)` para configurar respostas por teste.
 */
export class AiVoiceMock {
  readonly calls: AiVoiceCall[] = [];
  readonly wakeWordModelRequests: { url: string; hasAuthorization: boolean }[] = [];
  private readonly replies = new Map<AiVoiceRouteKey, AiVoiceReplyFactory[]>();
  private readonly defaults = new Map<AiVoiceRouteKey, AiVoiceReplyFactory>();
  private wakeWordModel: AiVoiceReply = { status: 404, json: { erro: 'Modelo de voz indisponivel.' } };

  constructor(private readonly page: Page) {}

  async install(options: AiVoiceMockOptions = {}): Promise<this> {
    await setAiVoiceFeatureFlag(this.page, options.flag ?? true);
    this.defaults.set('balance', options.balance ?? { json: aiVoiceBalance(10) });
    if (options.wakeWordModel) {
      this.wakeWordModel = options.wakeWordModel;
    }
    await this.page.route('**/api/ai-voice/**', (route) => this.handle(route));
    await this.page.route('**/api/ai-voice-public/**', async (route) => {
      const headers = await route.request().allHeaders();
      this.wakeWordModelRequests.push({ url: route.request().url(), hasAuthorization: 'authorization' in headers });
      await this.fulfill(route, this.wakeWordModel);
    });
    return this;
  }

  /** Resposta padrão (todas as chamadas) da rota. */
  setDefault(key: AiVoiceRouteKey, reply: AiVoiceReplyFactory): void {
    this.defaults.set(key, reply);
  }

  /** Enfileira respostas para as próximas chamadas (depois volta ao padrão). */
  reply(key: AiVoiceRouteKey, ...replies: AiVoiceReplyFactory[]): void {
    this.replies.set(key, [...(this.replies.get(key) ?? []), ...replies]);
  }

  setBalance(reply: AiVoiceReplyFactory): void {
    this.setDefault('balance', reply);
  }

  setWakeWordModel(reply: AiVoiceReply): void {
    this.wakeWordModel = reply;
  }

  callsTo(key: AiVoiceRouteKey): AiVoiceCall[] {
    return this.calls.filter((call) => call.key === key);
  }

  /** Chamadas pagas (tudo que não é `/balance`). */
  chargedCalls(): AiVoiceCall[] {
    return this.calls.filter((call) => call.key !== 'balance');
  }

  lastBody(key: AiVoiceRouteKey): Record<string, unknown> {
    const list = this.callsTo(key);
    expect(list.length, `nenhuma chamada a ${ROUTE_SUFFIX[key]}`).toBeGreaterThan(0);
    return list[list.length - 1].body;
  }

  async waitForCall(key: AiVoiceRouteKey, count = 1, timeout = 15_000): Promise<Record<string, unknown>> {
    await expect.poll(() => this.callsTo(key).length, { timeout, message: `aguardando ${ROUTE_SUFFIX[key]}` }).toBeGreaterThanOrEqual(count);
    return this.callsTo(key)[count - 1].body;
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const key = keyFromUrl(request.url());
    const body = request.method() === 'POST' ? safeJson(request) : {};
    this.calls.push({ key, method: request.method(), url: request.url(), body });

    if (key === 'unknown') {
      await route.fulfill({ status: 501, contentType: 'application/json', body: JSON.stringify({ erro: 'Rota de IA não mockada no E2E.' }) });
      return;
    }
    const queue = this.replies.get(key);
    const factory = queue && queue.length > 0 ? queue.shift()! : this.defaults.get(key);
    if (!factory) {
      await route.fulfill({ status: 501, contentType: 'application/json', body: JSON.stringify({ erro: `Resposta não configurada para ${key}.` }) });
      return;
    }
    const reply = typeof factory === 'function' ? factory(body) : factory;
    await this.fulfill(route, reply);
  }

  private async fulfill(route: Route, reply: AiVoiceReply): Promise<void> {
    if (reply.hang) {
      return;
    }
    if (reply.gate) {
      await reply.gate;
    }
    if (reply.delayMs) {
      await sleep(reply.delayMs);
    }
    try {
      if (reply.abort) {
        await route.abort('failed');
        return;
      }
      const hasJson = reply.json !== undefined;
      await route.fulfill({
        status: reply.status ?? 200,
        contentType: reply.contentType ?? (hasJson ? 'application/json' : 'text/plain'),
        body: hasJson ? JSON.stringify(reply.json) : (reply.body ?? ''),
      });
    } catch {
      /* página fechada antes da resposta (ex.: navegação) */
    }
  }
}

/** Cria uma "porteira" para segurar a resposta da IA até o teste liberar. */
export function createGate(): { promise: Promise<void>; release: () => void } {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

// ---------------------------------------------------------------------------
// Navegador: SpeechRecognition, getUserMedia, MediaRecorder e AudioContext fakes
// ---------------------------------------------------------------------------

export type FakeVoiceBrowserOptions = {
  /** `fake`: SpeechRecognition controlável (modo grátis); `none`: remove (força modo pago). */
  speech?: 'fake' | 'none';
  /** `fake`: MediaRecorder determinístico; `none`: remove; `empty`: grava blob de 0 bytes. */
  mediaRecorder?: 'fake' | 'none' | 'empty';
  /** Nome do DOMException rejeitado por getUserMedia (ex.: NotAllowedError). */
  getUserMediaError?: string;
  /** Atraso (ms, relógio da página) antes de getUserMedia resolver. */
  getUserMediaDelayMs?: number;
  /**
   * Stream devolvido por getUserMedia:
   * `fake` — objeto sem áudio (sem detecção de silêncio);
   * `silent` — MediaStream real silencioso (detector de silêncio ativo);
   * `noise` — MediaStream real com tom contínuo (nunca silencia).
   */
  stream?: 'fake' | 'silent' | 'noise';
  /** Remove `window.AudioContext`. */
  noAudioContext?: boolean;
  /** `SpeechRecognition.start()` lança exceção síncrona (ex.: InvalidStateError do Chrome). */
  speechStartThrows?: boolean;
};

declare global {
  interface Window {
    __voice: {
      starts: number;
      stops: number;
      sessions: unknown[];
      current: unknown;
      gumCalls: number;
      trackStops: number;
      liveTracks: number;
      recorderStarts: number;
      say(text: string, isFinal?: boolean): void;
      error(code: string): void;
      end(): void;
    };
    __xss?: number;
  }
}

/** Instala os fakes antes do carregamento da página (chamar antes de `goto`). */
export async function installFakeVoiceBrowser(page: Page, options: FakeVoiceBrowserOptions = {}): Promise<void> {
  const opts: Required<Omit<FakeVoiceBrowserOptions, 'getUserMediaError' | 'getUserMediaDelayMs'>> &
    Pick<FakeVoiceBrowserOptions, 'getUserMediaError' | 'getUserMediaDelayMs'> = {
    speech: options.speech ?? 'fake',
    mediaRecorder: options.mediaRecorder ?? 'fake',
    stream: options.stream ?? 'fake',
    noAudioContext: options.noAudioContext ?? false,
    speechStartThrows: options.speechStartThrows ?? false,
    getUserMediaError: options.getUserMediaError,
    getUserMediaDelayMs: options.getUserMediaDelayMs,
  };

  await page.addInitScript((o) => {
    type FakeResult = { isFinal: boolean; 0: { transcript: string } };
    type FakeSession = {
      onresult: ((event: unknown) => void) | null;
      onerror: ((event: unknown) => void) | null;
      onend: (() => void) | null;
      results: FakeResult[];
      active: boolean;
    };

    const state = {
      starts: 0,
      stops: 0,
      sessions: [] as FakeSession[],
      current: null as FakeSession | null,
      gumCalls: 0,
      trackStops: 0,
      liveTracks: 0,
      recorderStarts: 0,
      say(text: string, isFinal = true) {
        const session = state.current;
        if (!session || !session.onresult) {
          throw new Error('Nenhuma sessão de SpeechRecognition ativa');
        }
        const last = session.results[session.results.length - 1];
        let index: number;
        if (last && !last.isFinal) {
          index = session.results.length - 1;
          session.results[index] = { isFinal, 0: { transcript: text } };
        } else {
          session.results.push({ isFinal, 0: { transcript: text } });
          index = session.results.length - 1;
        }
        session.onresult({ resultIndex: index, results: session.results.slice() });
      },
      error(code: string) {
        const session = state.current;
        session?.onerror?.({ error: code });
      },
      end() {
        const session = state.current;
        if (session) {
          session.active = false;
          state.current = null;
          session.onend?.();
        }
      },
    };
    (window as unknown as { __voice: typeof state }).__voice = state;

    const w = window as unknown as Record<string, unknown>;
    if (o.speech === 'none') {
      for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
        try {
          delete w[name];
        } catch {
          /* ignore */
        }
        try {
          Object.defineProperty(window, name, { value: undefined, configurable: true, writable: true });
        } catch {
          /* ignore */
        }
      }
    } else {
      class FakeSpeechRecognition {
        lang = '';
        continuous = false;
        interimResults = false;
        onresult: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        results: FakeResult[] = [];
        active = false;
        start() {
          if (o.speechStartThrows) {
            throw new DOMException('recognition has already started', 'InvalidStateError');
          }
          state.starts++;
          this.active = true;
          state.current = this;
          state.sessions.push(this);
        }
        stop() {
          state.stops++;
          this.active = false;
          if (state.current === this) {
            state.current = null;
          }
          Promise.resolve().then(() => this.onend?.());
        }
        abort() {
          this.stop();
        }
      }
      Object.defineProperty(window, 'SpeechRecognition', { value: FakeSpeechRecognition, configurable: true, writable: true });
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: FakeSpeechRecognition, configurable: true, writable: true });
    }

    const RealAudioContext = window.AudioContext;
    if (o.noAudioContext) {
      Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true, writable: true });
      Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true, writable: true });
    }

    const wrapTrack = (track: { stop: () => void }) => {
      state.liveTracks++;
      const original = track.stop.bind(track);
      let stopped = false;
      track.stop = () => {
        if (!stopped) {
          stopped = true;
          state.trackStops++;
          state.liveTracks--;
        }
        original();
      };
    };

    const createStream = (): MediaStream => {
      if (o.stream === 'fake') {
        const track = { kind: 'audio', enabled: true, readyState: 'live', stop() {} };
        wrapTrack(track);
        return { getTracks: () => [track], getAudioTracks: () => [track], active: true } as unknown as MediaStream;
      }
      const ctx = new RealAudioContext();
      const destination = ctx.createMediaStreamDestination();
      if (o.stream === 'noise') {
        const osc = ctx.createOscillator();
        osc.frequency.value = 440;
        const gain = ctx.createGain();
        gain.gain.value = 0.8;
        osc.connect(gain).connect(destination);
        osc.start();
      }
      void ctx.resume().catch(() => undefined);
      destination.stream.getTracks().forEach((track) => wrapTrack(track));
      return destination.stream;
    };

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      writable: true,
      value: async () => {
        state.gumCalls++;
        if (o.getUserMediaDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, o.getUserMediaDelayMs));
        }
        if (o.getUserMediaError) {
          throw new DOMException('fake getUserMedia error', o.getUserMediaError);
        }
        return createStream();
      },
    });

    if (o.mediaRecorder === 'none') {
      Object.defineProperty(window, 'MediaRecorder', { value: undefined, configurable: true, writable: true });
    } else {
      class FakeMediaRecorder {
        static isTypeSupported(type: string) {
          return type.startsWith('audio/webm');
        }
        mimeType: string;
        state = 'inactive';
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        constructor(_stream: unknown, options?: { mimeType?: string }) {
          this.mimeType = options?.mimeType ?? 'audio/webm';
        }
        start() {
          state.recorderStarts++;
          this.state = 'recording';
        }
        stop() {
          if (this.state === 'inactive') {
            return;
          }
          this.state = 'inactive';
          const bytes = o.mediaRecorder === 'empty' ? [] : [new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04])];
          const data = new Blob(bytes, { type: this.mimeType });
          Promise.resolve().then(() => {
            this.ondataavailable?.({ data });
            this.onstop?.();
          });
        }
      }
      Object.defineProperty(window, 'MediaRecorder', { value: FakeMediaRecorder, configurable: true, writable: true });
    }
  }, opts);
}

/** Emite uma fala (final por padrão) no SpeechRecognition fake. */
export async function say(page: Page, text: string, isFinal = true): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.__voice.current !== null), { timeout: 5_000 }).toBe(true);
  await page.evaluate(([t, f]) => window.__voice.say(t as string, f as boolean), [text, isFinal] as const);
}

export async function speechError(page: Page, code: string): Promise<void> {
  await page.evaluate((c) => window.__voice.error(c), code);
}

export async function speechSessionEnd(page: Page): Promise<void> {
  await page.evaluate(() => window.__voice.end());
}

export async function voiceStats(page: Page): Promise<{ gumCalls: number; trackStops: number; liveTracks: number; starts: number; stops: number; recorderStarts: number }> {
  return page.evaluate(() => ({
    gumCalls: window.__voice.gumCalls,
    trackStops: window.__voice.trackStops,
    liveTracks: window.__voice.liveTracks,
    starts: window.__voice.starts,
    stops: window.__voice.stops,
    recorderStarts: window.__voice.recorderStarts,
  }));
}

// ---------------------------------------------------------------------------
// Dados auxiliares (catálogo e profissionais) — mocks só de leitura
// ---------------------------------------------------------------------------

export type CatalogItemMock = { id: number; nome: string; codigo?: string; categoria?: string; valor_base?: number };

/** Mocka o catálogo de procedimentos (`GET /api/tratamentos?page=...`). Mantém ids reais quando a gravação vai ao backend. */
export async function mockTreatmentCatalog(page: Page, items: CatalogItemMock[]): Promise<void> {
  await page.route(/\/api\/tratamentos(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tratamentos: items.map((item) => ({
          id: item.id,
          nome_procedimento: item.nome,
          codigo: item.codigo ?? `E2E${item.id}`,
          categoria: item.categoria ?? 'Dentística',
          valor_base: item.valor_base ?? 150,
        })),
        total: items.length,
        page: 1,
        pageSize: 500,
      }),
    });
  });
}

export type ProfessionalMock = { id: number; nome: string };

/** Mocka `GET /api/profissionais` (lista de dentistas do modal). */
export async function mockProfessionals(page: Page, professionals: ProfessionalMock[]): Promise<void> {
  await page.route(/\/api\/profissionais(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(professionals.map((p) => ({ id: p.id, nome: p.nome, nome_exibicao: p.nome, ativo: true }))),
    });
  });
}

/**
 * A conta E2E é admin vinculada a um profissional, então o campo Dentista vem travado.
 * Para os cenários de "dentista por voz", remove o `professional_id` da sessão local e
 * esconde o vínculo em `GET /api/auth/users` (somente leitura, nada é gravado).
 */
export async function unlockProfessionalField(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      const raw = localStorage.getItem('controleDentalSession');
      if (!raw) {
        return;
      }
      const session = JSON.parse(raw) as { usuario?: Record<string, unknown> };
      if (session.usuario) {
        delete session.usuario.professional_id;
        localStorage.setItem('controleDentalSession', JSON.stringify(session));
      }
    } catch {
      /* sessão inválida: mantém */
    }
  });
  await page.route(/\/api\/auth\/users(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

/** Data ISO local (YYYY-MM-DD) com deslocamento em dias. */
export function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function brDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Massa E2E via API (dados reais, prefixo E2E-, limpos junto com o paciente)
// ---------------------------------------------------------------------------

async function withE2eToken<T>(browser: Browser, run: (request: APIRequestContext, token: string) => Promise<T>): Promise<T> {
  const context = await createAuthenticatedE2eContext(browser);
  try {
    const page = await context.newPage();
    await page.goto('/');
    const token = await readAccessToken(page);
    if (!token) {
      throw new Error('Token ausente para semear dados E2E');
    }
    return await run(context.request, token);
  } finally {
    await context.close();
  }
}

/** Cria um tratamento clínico "Em aberto" (botão Finalizar disponível na lista). */
export async function createE2eClinicalTreatmentByApi(browser: Browser, patientId: string, procedureName: string): Promise<void> {
  await withE2eToken(browser, async (request, token) => {
    const response = await request.post(`${e2eEnv.apiUrl}/pacientes/${patientId}/tratamentos-clinicos`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { nome_procedimento: procedureName, procedimentos: procedureName, data: isoDate(0), status: 'a_realizar' },
    });
    if (!response.ok()) {
      throw new Error(`createE2eClinicalTreatmentByApi (${response.status()}): ${(await response.text()).slice(0, 300)}`);
    }
  });
}

/** Cria um registro na ficha clínica (para os cenários de edição). */
export async function createE2eClinicalRecordByApi(browser: Browser, patientId: string, realizado: string): Promise<void> {
  await withE2eToken(browser, async (request, token) => {
    const response = await request.post(`${e2eEnv.apiUrl}/pacientes/${patientId}/ficha-clinica/registros`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { data_registro: isoDate(0), data: isoDate(0), realizado },
    });
    if (!response.ok()) {
      throw new Error(`createE2eClinicalRecordByApi (${response.status()}): ${(await response.text()).slice(0, 300)}`);
    }
  });
}

/** Textos "realizado" dos registros da ficha clínica do paciente (leitura via API). */
export async function listClinicalRecordTextsByApi(page: Page, patientId: string): Promise<string[]> {
  const token = await readAccessToken(page);
  const response = await page.request.get(`${e2eEnv.apiUrl}/pacientes/${patientId}/ficha-clinica/registros?pagina=1&limite=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const list = (body.registros_ficha_clinica ?? body.registros ?? body.data ?? []) as Record<string, unknown>[];
  return Array.isArray(list) ? list.map((item) => String(item.realizado ?? '')) : [];
}
