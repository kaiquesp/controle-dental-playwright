import { chromium, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { e2eEnv, requireCredentials } from './env';
import { LoginPage } from '../pages/login.page';
import { acceptPendingLegalDocuments, dismissAppModals, waitForPostLoginDestination } from './onboarding';
import { AUTH_FILE, TOKEN_KEY, authFileHasToken, authFileIsFresh } from './auth-state';

interface LoginApiResponse {
  accessToken?: string;
  access_token?: string;
  token?: string;
  usuario?: unknown;
  tenant?: unknown;
  plano?: unknown;
  areasConfiguracao?: unknown;
}

function resolveToken(body: LoginApiResponse): string {
  return body.accessToken ?? body.access_token ?? body.token ?? '';
}

function buildSessionSnapshot(body: LoginApiResponse): Record<string, unknown> {
  const usuario =
    body.usuario && typeof body.usuario === 'object'
      ? { ...(body.usuario as Record<string, unknown>) }
      : undefined;

  if (usuario) {
    const permissoes = Array.isArray(usuario.permissoes)
      ? [...(usuario.permissoes as string[])]
      : [];
    for (const permission of ['contratos:read', 'contratos:write', 'pacientes:read', 'pacientes:write']) {
      if (!permissoes.includes(permission)) {
        permissoes.push(permission);
      }
    }
    usuario.permissoes = permissoes;
  }

  const planoRaw =
    body.plano && typeof body.plano === 'object' ? ({ ...(body.plano as Record<string, unknown>) } as Record<string, unknown>) : undefined;

  if (planoRaw) {
    planoRaw.pagamentoEmDia = true;
    const modulos = Array.isArray(planoRaw.modulos)
      ? [...(planoRaw.modulos as Array<Record<string, unknown>>)]
      : [];
    const ensureModule = (moduleId: string): void => {
      const existing = modulos.find((item) => item.id === moduleId);
      if (existing) {
        existing.habilitadoNoPlano = true;
        existing.leitura = true;
        existing.escrita = true;
        return;
      }
      modulos.push({
        id: moduleId,
        nome: moduleId,
        secao: '',
        habilitadoNoPlano: true,
        leitura: true,
        escrita: true,
      });
    };
    ensureModule('pacientes');
    ensureModule('contratos');
    planoRaw.modulos = modulos;
  }

  return {
    usuario,
    tenant: body.tenant,
    plano: planoRaw ?? body.plano,
    ...(body.areasConfiguracao ? { areasConfiguracao: body.areasConfiguracao } : {}),
  };
}

async function authenticateViaApi(request: APIRequestContext): Promise<LoginApiResponse | null> {
  const response = await request.post(`${e2eEnv.apiUrl}/auth/login`, {
    data: {
      email: e2eEnv.userEmail,
      senha: e2eEnv.userPassword,
    },
  });

  if (!response.ok()) {
    const body = await response.text();
    console.warn(`API login failed with status ${response.status()}: ${body.slice(0, 300)}`);
    return null;
  }

  return (await response.json()) as LoginApiResponse;
}

async function injectSession(page: Page, apiBody: LoginApiResponse): Promise<void> {
  const token = resolveToken(apiBody);
  const snapshot = buildSessionSnapshot(apiBody);

  await page.goto(e2eEnv.baseUrl);
  await page.evaluate(
    ({ tokenValue, sessionValue, rememberKey, tokenKey, sessionKey }) => {
      localStorage.setItem(tokenKey, tokenValue);
      localStorage.setItem(sessionKey, JSON.stringify(sessionValue));
      localStorage.setItem('rememberMePreference', rememberKey);
    },
    {
      tokenValue: token,
      sessionValue: snapshot,
      rememberKey: '1',
      tokenKey: TOKEN_KEY,
      sessionKey: 'controleDentalSession',
    }
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await acceptPendingLegalDocuments(page, 15_000);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

async function authenticateViaUi(page: Page): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.fillCredentials(e2eEnv.userEmail, e2eEnv.userPassword);
  await loginPage.submit();

  const hasRecaptcha = await loginPage.waitForRecaptcha();
  if (hasRecaptcha) {
    console.warn(
      'reCAPTCHA exigido em produção. Resolva manualmente no navegador (npm run test:auth:headed) e aguarde o redirecionamento.'
    );
  }

  await waitForPostLoginDestination(page, 120_000);
  await acceptPendingLegalDocuments(page, 3_000);
}

async function readAccessToken(page: Page): Promise<string | null> {
  return page.evaluate((tokenKey) => localStorage.getItem(tokenKey), TOKEN_KEY);
}

async function ensureAuthenticated(page: Page, request: APIRequestContext): Promise<void> {
  await page.goto(`${e2eEnv.baseUrl}/agenda`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const token = await readAccessToken(page);
  const onLogin = page.url().includes('/login');

  if (token && !onLogin) {
    return;
  }

  console.log('Sessão inválida ou expirada — autenticando novamente via API/UI.');

  let loggedIn = false;
  try {
    const apiBody = await authenticateViaApi(request);
    if (apiBody && resolveToken(apiBody)) {
      await injectSession(page, apiBody);
      loggedIn = true;
    }
  } catch (error) {
    console.warn('Falha no login via API, tentando UI:', error);
  }

  if (!loggedIn) {
    console.warn(
      'Login via API falhou. Tentando UI — confira E2E_USER_EMAIL e E2E_USER_PASSWORD no .env se o erro foi 401.'
    );
    await page.goto(`${e2eEnv.baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await authenticateViaUi(page);
  }

  const refreshedToken = await readAccessToken(page);
  expect(refreshedToken).toBeTruthy();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

export async function ensureAuthStorage(options: { headed?: boolean } = {}): Promise<void> {
  requireCredentials();
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  if (!authFileHasToken()) {
    console.log('Arquivo de sessão ausente ou inválido — autenticando.');
  } else if (authFileIsFresh()) {
    console.log('Validando sessão existente em playwright/.auth/user.json');
  }

  const browser: Browser = await chromium.launch({
    headless: !options.headed && !process.env.HEADED,
  });

  try {
    const context = await browser.newContext(
      authFileHasToken() ? { storageState: AUTH_FILE } : {}
    );
    const page = await context.newPage();
    const request = context.request;

    await ensureAuthenticated(page, request);
    await dismissAppModals(page);

    const tokenBeforeSave = await readAccessToken(page);
    expect(tokenBeforeSave).toBeTruthy();

    await context.storageState({ path: AUTH_FILE });
  } finally {
    await browser.close();
  }
}
