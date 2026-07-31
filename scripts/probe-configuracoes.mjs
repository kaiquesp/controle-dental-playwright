import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
const authFile = path.join(root, 'playwright/.auth/user.json');
const apiUrl = process.env.E2E_API_URL ?? 'https://api.controledental.com.br/api';
const baseURL = process.env.E2E_BASE_URL ?? 'https://app.controledental.com.br';

const SECTIONS = [
  'Meu perfil',
  'Dados da clínica',
  'Modelos de mensagens',
  'Créditos de mensagens',
  'Notificações',
  'Integrações',
  'Assinatura',
  'Plano e cobrança',
  'Equipe e permissões',
  'Dentistas',
  'Convênios',
  'Fornecedores',
  'Salas e cadeiras',
  'Formas de Pagamento',
  'Tratamentos / Procedimentos',
  'Modelos de Anamnese',
  'Medicamentos',
  'Modelos de encaminhamento',
];

const CTAS = [
  { section: 'Equipe e permissões', button: /Adicionar membro/i },
  { section: 'Dentistas', button: /Novo dentista/i },
  { section: 'Convênios', button: /Criar convênio|Novo convênio/i },
  { section: 'Fornecedores', button: /Novo fornecedor|Adicionar fornecedor/i },
  { section: 'Salas e cadeiras', button: /Nova sala|Adicionar sala|Nova cadeira/i },
  { section: 'Formas de Pagamento', button: /Nova forma|Adicionar forma|Nova forma de pagamento/i },
  { section: 'Tratamentos / Procedimentos', button: /Novo tratamento|Novo procedimento|Adicionar/i },
  { section: 'Modelos de Anamnese', button: /Novo modelo|Adicionar modelo|Nova anamnese/i },
  { section: 'Medicamentos', button: /Novo medicamento|Adicionar medicamento/i },
  { section: 'Modelos de encaminhamento', button: /Novo modelo|Adicionar modelo/i },
  { section: 'Modelos de mensagens', button: /Novo modelo|Adicionar modelo|Criar modelo/i },
];

const API_CANDIDATES = [
  '/configuracoes/perfil/me',
  '/configuracoes/personalizacao',
  '/configuracoes/clinica',
  '/configuracoes/notificacoes',
  '/configuracoes/convenios',
  '/configuracoes/convenios?ativo=1',
  '/configuracoes/equipe',
  '/configuracoes/membros',
  '/configuracoes/fornecedores',
  '/configuracoes/formas-pagamento',
  '/configuracoes/formas_pagamento',
  '/configuracoes/medicamentos',
  '/configuracoes/tratamentos',
  '/configuracoes/procedimentos',
  '/configuracoes/anamneses',
  '/configuracoes/modelos-anamnese',
  '/configuracoes/encaminhamentos',
  '/configuracoes/modelos-encaminhamento',
  '/configuracoes/modelos-mensagem',
  '/configuracoes/mensagens',
  '/configuracoes/salas-cadeiras',
  '/configuracoes/comissoes',
  '/configuracoes/modelos-contrato',
  '/profissionais',
  '/salas-cadeiras',
  '/fornecedores',
  '/formas-pagamento',
  '/convenios',
  '/medicamentos',
  '/tratamentos',
  '/procedimentos',
  '/modelos-contrato',
];

const captured = [];
const sectionReports = [];
const toasts = [];
const validationProbes = [];

async function dismiss(page) {
  for (const label of ['Pular tour', 'Fechar', 'Entendi', 'Continuar', 'Cancelar', 'Voltar']) {
    const btn = page.getByRole('button', { name: label, exact: true });
    if (await btn.isVisible().catch(() => false)) await btn.click({ force: true }).catch(() => undefined);
  }
  for (let i = 0; i < 3; i++) {
    const mask = page.locator('.p-dialog-mask, [role="dialog"]:visible, .p-dialog:visible').first();
    if (!(await mask.isVisible().catch(() => false))) break;
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(300);
    const close = page.locator('.p-dialog-header-close, button[aria-label="Close"], button[aria-label="Fechar"]').first();
    if (await close.isVisible().catch(() => false)) await close.click({ force: true }).catch(() => undefined);
  }
}

async function openSection(page, label) {
  await dismiss(page);
  const nav = page.locator('nav[aria-label="Seções"], .config__tabs, nav[aria-label*="Seç"]');
  const tab = nav.getByRole('button', { name: label }).first();
  if (!(await tab.isVisible().catch(() => false))) return false;
  await tab.click({ force: true });
  await page.waitForTimeout(800);
  await dismiss(page);
  return true;
}

async function collectVisibleInputs(page) {
  return page
    .locator('main input:visible, main textarea:visible, [role="dialog"]:visible input, [role="dialog"]:visible textarea, .p-dialog:visible input, .p-dialog:visible textarea')
    .evaluateAll((els) =>
      els.slice(0, 40).map((el) => ({
        id: el.id || null,
        name: el.getAttribute('name'),
        type: el.getAttribute('type'),
        placeholder: el.getAttribute('placeholder'),
        ariaInvalid: el.getAttribute('aria-invalid'),
      }))
    )
    .catch(() => []);
}

async function collectButtons(page) {
  return page
    .locator('main button:visible, [role="dialog"]:visible button, .p-dialog:visible button')
    .evaluateAll((els) =>
      els
        .map((el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 40)
    )
    .catch(() => []);
}

async function collectToasts(page) {
  return page
    .locator('.p-toast-message, .p-message, .p-inline-message')
    .evaluateAll((els) =>
      els.map((el) => ({
        className: el.className,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      }))
    )
    .catch(() => []);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authFile, baseURL });
const page = await context.newPage();

page.on('request', (req) => {
  const url = req.url();
  if (!url.includes('/api/')) return;
  if (url.includes('analytics') || url.includes('sockjs') || url.includes('hot-update')) return;
  captured.push({
    method: req.method(),
    url: url.replace(apiUrl, '/api').replace(/https?:\/\/[^/]+\/api/, '/api'),
    body: req.postData()?.slice(0, 400) ?? null,
  });
});

page.on('response', async (res) => {
  const url = res.url();
  if (!url.includes('/api/')) return;
  const method = res.request().method();
  if (method === 'GET' && res.status() < 400) return;
  captured.push({
    type: 'response',
    method,
    status: res.status(),
    url: url.replace(/https?:\/\/[^/]+\/api/, '/api'),
    sample: (await res.text().catch(() => '')).slice(0, 300),
  });
});

await page.goto('/configuracoes', { waitUntil: 'domcontentloaded' });
await dismiss(page);
await page.waitForTimeout(1500);

for (const label of SECTIONS) {
  try {
    const opened = await openSection(page, label);
    const report = {
      label,
      opened,
      inputs: [],
      buttons: [],
      headings: [],
    };
    if (opened) {
      report.inputs = await collectVisibleInputs(page);
      report.buttons = await collectButtons(page);
      report.headings = await page
        .locator('main h1, main h2, main h3')
        .evaluateAll((els) => els.map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 10))
        .catch(() => []);
    }
    sectionReports.push(report);
  } catch (err) {
    sectionReports.push({ label, opened: false, error: String(err?.message || err).slice(0, 200) });
    await dismiss(page);
  }
}

for (const cta of CTAS) {
  try {
    const opened = await openSection(page, cta.section);
    if (!opened) {
      validationProbes.push({ section: cta.section, sectionOpened: false });
      continue;
    }
    const btn = page.getByRole('button', { name: cta.button }).first();
    if (!(await btn.isVisible().catch(() => false))) {
      validationProbes.push({ section: cta.section, buttonFound: false });
      continue;
    }
    await btn.click({ force: true });
    await page.waitForTimeout(1000);
    const inputs = await collectVisibleInputs(page);
    const buttons = await collectButtons(page);

    const saveBtn = page
      .locator('[role="dialog"]:visible button, .p-dialog:visible button')
      .filter({ hasText: /Salvar|Criar|Adicionar|Confirmar|Enviar/i })
      .first();
    let validation = null;
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(800);
      validation = {
        toasts: await collectToasts(page),
        invalidInputs: await page
          .locator('[role="dialog"]:visible [aria-invalid="true"], .p-dialog:visible .ng-invalid, .p-invalid')
          .count()
          .catch(() => 0),
        messages: await page
          .locator('[role="dialog"]:visible .p-error, [role="dialog"]:visible .error, .p-dialog:visible .p-error, small.p-error')
          .evaluateAll((els) => els.map((el) => (el.textContent || '').trim()).filter(Boolean))
          .catch(() => []),
      };
      toasts.push(...(validation.toasts || []));
    }

    validationProbes.push({
      section: cta.section,
      buttonFound: true,
      inputs,
      buttons,
      validation,
    });
  } catch (err) {
    validationProbes.push({ section: cta.section, error: String(err?.message || err).slice(0, 200) });
  }
  await dismiss(page);
  await page.waitForTimeout(300);
}

// direct routes
const directRoutes = [];
for (const route of ['/configuracoes/modelos-contrato', '/configuracoes/comissoes-profissionais']) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await dismiss(page);
  await page.waitForTimeout(1200);
  directRoutes.push({
    route,
    url: page.url(),
    buttons: await collectButtons(page),
    headings: await page
      .locator('main h1, main h2')
      .evaluateAll((els) => els.map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 8))
      .catch(() => []),
  });
}

await page.goto('/configuracoes', { waitUntil: 'domcontentloaded' });
await dismiss(page);
const token = await page.evaluate(() => localStorage.getItem('accessToken'));
const apiProbes = [];
for (const endpoint of API_CANDIDATES) {
  const res = await context.request.get(`${apiUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  apiProbes.push({
    endpoint,
    status: res.status(),
    sample: text.slice(0, 350),
  });
}

// unique API paths from capture
const uniqueApis = [
  ...new Set(
    captured
      .map((c) => c.url)
      .filter(Boolean)
      .map((u) => u.replace(/\?.*$/, ''))
  ),
].sort();

const out = path.join(root, 'docs/configuracoes-api-probe.json');
fs.writeFileSync(
  out,
  JSON.stringify(
    {
      url: page.url(),
      uniqueApis,
      apiProbes: apiProbes.filter((p) => p.status < 500),
      sectionReports,
      validationProbes,
      toasts,
      captured: captured.slice(0, 200),
      directRoutes,
    },
    null,
    2
  )
);
console.log('Wrote', out);
console.log('API OK:', apiProbes.filter((p) => p.status >= 200 && p.status < 300).map((p) => `${p.status} ${p.endpoint}`));
console.log('Sections opened:', sectionReports.filter((s) => s.opened).map((s) => s.label));
await browser.close();
