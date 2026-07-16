/**
 * Script de exploração — mapeia rotas, abas, botões e links da aplicação.
 * Uso: node scripts/explore-flows.mjs
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const baseURL = process.env.E2E_BASE_URL ?? 'https://app.controledental.com.br';
const authFile = path.join(root, 'playwright/.auth/user.json');

const AUTHENTICATED_ROUTES = [
  '/agenda',
  '/pacientes/buscar',
  '/pacientes/novo',
  '/controle-protese',
  '/controle-protese/laboratorios',
  '/financeiro',
  '/financeiro/fluxo-caixa',
  '/financeiro/comissoes',
  '/financeiro/boletos',
  '/financeiro/notas-fiscais',
  '/estoque',
  '/relatorios',
  '/configuracoes',
  '/configuracoes/comissoes-profissionais',
  '/configuracoes/modelos-contrato',
];

const PUBLIC_ROUTES = [
  '/login',
  '/recuperar-senha',
  '/registro',
  '/politica-de-privacidade',
  '/portal-titular',
  '/validar-documento',
  '/validar-receita',
];

async function dismissModals(page) {
  const skipTour = page.getByText('Pular tour', { exact: true });
  if (await skipTour.isVisible().catch(() => false)) {
    await skipTour.click();
    await page.waitForTimeout(400);
  }
  const closeSelectors = [
    'button[aria-label="Fechar"]',
    'button:has-text("Fechar")',
    'button:has-text("Entendi")',
    'button:has-text("Continuar")',
    '.p-dialog-header-close',
  ].join(', ');
  for (let i = 0; i < 3; i++) {
    const btn = page.locator(closeSelectors).first();
    if (!(await btn.isVisible().catch(() => false))) break;
    await btn.click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(300);
  }
}

async function extractPageInfo(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const textOf = (el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);

    const buttons = [...document.querySelectorAll('button, [role="button"], a.btn, .p-button')]
      .filter(visible)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: textOf(el),
        ariaLabel: el.getAttribute('aria-label') ?? '',
        type: el.getAttribute('type') ?? '',
      }))
      .filter((b) => b.text || b.ariaLabel)
      .slice(0, 80);

    const links = [...document.querySelectorAll('a[href]')]
      .filter(visible)
      .map((el) => ({
        text: textOf(el),
        href: el.getAttribute('href') ?? '',
      }))
      .filter((l) => l.text && !l.href.startsWith('javascript:'))
      .slice(0, 80);

    const headings = [...document.querySelectorAll('h1, h2, h3, h4, .page-title, [class*="title"]')]
      .filter(visible)
      .map((el) => textOf(el))
      .filter(Boolean)
      .slice(0, 20);

    const tabs = [
      ...document.querySelectorAll(
        '[role="tab"], .p-tab, nav[aria-label] a, .config__tabs a, .financeiro__tabs a, .side-nav__menu-item'
      ),
    ]
      .filter(visible)
      .map((el) => ({
        text: textOf(el),
        role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
        ariaSelected: el.getAttribute('aria-selected'),
        href: el.getAttribute('href') ?? '',
      }))
      .filter((t) => t.text)
      .slice(0, 40);

    const inputs = [...document.querySelectorAll('input, select, textarea')]
      .filter(visible)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') ?? '',
        name: el.getAttribute('name') ?? el.id ?? '',
        placeholder: el.getAttribute('placeholder') ?? '',
        label: el.getAttribute('aria-label') ?? '',
      }))
      .filter((i) => i.name || i.placeholder || i.label)
      .slice(0, 50);

    const tables = [...document.querySelectorAll('table, .p-datatable, [role="grid"]')]
      .filter(visible)
      .length;

    return {
      title: document.title,
      headings,
      buttons,
      links,
      tabs,
      inputs,
      tableCount: tables,
    };
  });
}

async function exploreRoute(page, routePath, authenticated = true) {
  const result = {
    path: routePath,
    url: '',
    status: 'ok',
    redirectedToLogin: false,
    info: null,
    error: null,
  };

  try {
    await page.goto(routePath, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1500);
    if (authenticated) await dismissModals(page);
    await page.waitForTimeout(800);

    result.url = page.url();
    result.redirectedToLogin = page.url().includes('/login');

    if (result.redirectedToLogin && authenticated) {
      result.status = 'redirect_login';
      return result;
    }

    result.info = await extractPageInfo(page);
  } catch (err) {
    result.status = 'error';
    result.error = String(err.message ?? err).slice(0, 300);
  }

  return result;
}

async function main() {
  if (!fs.existsSync(authFile)) {
    console.error('Sessão não encontrada. Execute: npm run test:auth');
    process.exit(1);
  }

  const headless = process.env.HEADED !== '1';
  const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 150 });
  const publicContext = await browser.newContext({ baseURL, locale: 'pt-BR' });
  const authContext = await browser.newContext({
    baseURL,
    locale: 'pt-BR',
    storageState: authFile,
  });

  const report = {
    exploredAt: new Date().toISOString(),
    baseURL,
    publicRoutes: [],
    authenticatedRoutes: [],
    sidebarModules: [],
    postLoginRedirects: [],
  };

  // Rotas públicas
  const publicPage = await publicContext.newPage();
  for (const route of PUBLIC_ROUTES) {
    console.log(`Explorando pública: ${route}`);
    report.publicRoutes.push(await exploreRoute(publicPage, route, false));
  }
  await publicPage.close();

  // Sidebar autenticada
  const authPage = await authContext.newPage();
  const pageWait = async (page) => page.waitForTimeout(1200);

  const safeGoto = async (route) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await authPage.goto(route, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await pageWait(authPage);
        await dismissModals(authPage);
        return true;
      } catch (err) {
        console.warn(`Tentativa ${attempt} falhou em ${route}:`, err.message?.slice(0, 120));
        await authPage.waitForTimeout(1000 * attempt);
      }
    }
    return false;
  };

  if (!(await safeGoto('/agenda'))) {
    throw new Error('Não foi possível acessar a agenda autenticada.');
  }
  const sidebarItems = await authPage.evaluate(() =>
    [...document.querySelectorAll('app-sidebar a.side-nav__menu-item')]
      .map((el) => ({
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        href: el.getAttribute('href') ?? '',
      }))
      .filter((i) => i.text)
  );
  report.sidebarModules = sidebarItems;

  // Rotas autenticadas
  for (const route of AUTHENTICATED_ROUTES) {
    console.log(`Explorando autenticada: ${route}`);
    report.authenticatedRoutes.push(await exploreRoute(authPage, route, true));
  }

  // Abas de configurações
  if (await safeGoto('/configuracoes')) {
  report.configTabs = await authPage.evaluate(() =>
    [...document.querySelectorAll('.config__tabs a, nav[aria-label="Seções"] a')]
      .map((el) => ({
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        href: el.getAttribute('href') ?? '',
      }))
      .filter((t) => t.text)
  );
  }

  // Abas financeiro
  if (await safeGoto('/financeiro')) {
  report.financeiroTabs = await authPage.evaluate(() =>
    [...document.querySelectorAll('.financeiro__tabs a, nav[aria-label="Seções do financeiro"] a')]
      .map((el) => ({
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        href: el.getAttribute('href') ?? '',
      }))
      .filter((t) => t.text)
  );
  }

  // Abas formulário paciente (se disponível)
  if (await safeGoto('/pacientes/novo')) {
  report.patientFormTabs = await authPage.evaluate(() =>
    [...document.querySelectorAll('[class*="paciente"] nav a, .patient-tabs a, nav a[href*="pacientes"]')]
      .map((el) => ({
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        href: el.getAttribute('href') ?? '',
      }))
      .filter((t) => t.text)
      .slice(0, 20)
  );
  }

  // Relatórios — tipos disponíveis
  if (await safeGoto('/relatorios')) {
  report.relatoriosItems = await authPage.evaluate(() =>
    [...document.querySelectorAll('.relatorios a, .relatorios button, [class*="relatorio"] a, [class*="relatorio"] button')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 40)
  );
  }

  await authPage.close();
  await browser.close();

  const outPath = path.join(root, 'docs', 'exploration-report.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Relatório salvo em ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
