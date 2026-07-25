/**
 * Mapeia API e campos do modal da agenda no app.
 * Uso: node scripts/probe-agenda.mjs
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
const apiUrl = process.env.E2E_API_URL ?? 'https://api.controledental.com.br/api';
const authFile = path.join(root, 'playwright/.auth/user.json');

async function dismissModals(page) {
  for (const label of [
    'Pular tour',
    'Fechar',
    'Entendi',
    'Continuar',
    'Regularizar',
    'Ver assinatura',
  ]) {
    const btn = page.getByRole('button', { name: label, exact: true });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => undefined);
      await page.waitForTimeout(300);
    }
  }
  const blocked = page.getByRole('dialog', { name: /pendência na assinatura|Acesso bloqueado/i });
  if (await blocked.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => undefined);
  }
}

async function extractDialogInfo(page) {
  return page.evaluate(() => {
    const dialogEl =
      document.querySelector('[role="dialog"]:not([hidden])') ??
      document.querySelector('.p-dialog:not(.p-dialog-hidden)') ??
      document.querySelector('dialog[open]');
    if (!dialogEl) return { dialogVisible: false };

    const inputs = [...dialogEl.querySelectorAll('input, textarea, select, [role="combobox"]')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      id: el.id,
      placeholder: el.getAttribute('placeholder'),
      label: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
      disabled: el.disabled,
    }));

    const buttons = [...dialogEl.querySelectorAll('button')].map((b) => ({
      text: b.textContent?.trim().slice(0, 100),
      ariaLabel: b.getAttribute('aria-label'),
      disabled: b.disabled,
    }));

    const headings = [...dialogEl.querySelectorAll('h1,h2,h3,h4,label')].map((h) => h.textContent?.trim()).filter(Boolean);
    const tabs = [...dialogEl.querySelectorAll('[role="tab"], .agenda-schedule-modal__tab')].map((t) =>
      t.textContent?.trim()
    );

    return { dialogVisible: true, headings: headings.slice(0, 40), inputs, buttons: buttons.slice(0, 30), tabs };
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext(
  fs.existsSync(authFile) ? { storageState: authFile, baseURL } : { baseURL }
);
const page = await context.newPage();

const apiCalls = [];
page.on('request', (req) => {
  const url = req.url();
  if (url.includes('/api/') && (url.includes('agenda') || url.includes('dentist') || url.includes('profission') || url.includes('sala') || url.includes('etiquet'))) {
    apiCalls.push({ method: req.method(), url });
  }
});
page.on('response', async (res) => {
  const url = res.url();
  if (!url.includes('/api/')) return;
  if (!url.includes('agenda') && !url.includes('dentist') && !url.includes('profission') && !url.includes('sala') && !url.includes('etiquet')) {
    return;
  }
  let sample = null;
  try {
    const json = await res.json();
    if (Array.isArray(json)) {
      sample = { type: 'array', length: json.length, first: json[0] };
    } else if (json && typeof json === 'object') {
      const keys = Object.keys(json);
      sample = { keys, preview: JSON.stringify(json).slice(0, 500) };
    }
  } catch {
    sample = { error: 'non-json' };
  }
  apiCalls.push({ method: res.request().method(), url, status: res.status(), sample });
});

await page.goto('/agenda', { waitUntil: 'domcontentloaded' });
await dismissModals(page);
await page.waitForTimeout(2000);

const report = {
  probedAt: new Date().toISOString(),
  baseURL,
  apiUrl,
  initialApiCalls: [...apiCalls],
  modals: {},
  filters: {},
  views: ['Dia', 'Semana', 'Mês'],
};

// Modal tabs
await page.getByRole('button', { name: /Novo agendamento/i }).first().click();
await page.waitForTimeout(800);
const dialog = page.locator('[role="dialog"]:visible, .p-dialog:visible').last();

for (const tab of ['Consulta', 'Compromisso', 'Tarefa']) {
  const tabBtn = dialog.locator('[role="tablist"]').getByRole('button', { name: tab, exact: true });
  if (await tabBtn.isVisible().catch(() => false)) {
    await tabBtn.click();
    await page.waitForTimeout(500);
    report.modals[tab] = await extractDialogInfo(page);
  }
}

// Buttons in consulta modal
const consultaButtons = await dialog.evaluate((el) =>
  [...el.querySelectorAll('button, a')].map((n) => ({
    text: n.textContent?.trim().slice(0, 80),
    ariaLabel: n.getAttribute('aria-label'),
    href: n.getAttribute('href'),
  }))
);
report.consultaActions = consultaButtons.filter(
  (b) =>
    b.text &&
    /retornar|encontrar|repeti|etiquet|horário|horario/i.test(b.text + (b.ariaLabel ?? ''))
);

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const stillOpen = await page.locator('[role="dialog"]:visible, .p-dialog:visible').count();
if (stillOpen > 0) {
  const cancel = page.getByRole('button', { name: /Cancelar|Fechar/i }).first();
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(400);
}

// Filters
await page.getByRole('button', { name: /Todos os profissionais/i }).click();
await page.waitForTimeout(500);
report.filters.professionals = await page.evaluate(() =>
  [...document.querySelectorAll('[role="option"], .p-select-option, button, li')].map((el) => el.textContent?.trim()).filter((t) => t && t.length < 80).slice(0, 30)
);
await page.keyboard.press('Escape');

await page.getByRole('button', { name: /Outros filtros/i }).click();
await page.waitForTimeout(500);
report.filters.other = await page.evaluate(() => {
  const panel = document.querySelector('[role="dialog"], .p-popover, .p-overlaypanel');
  if (!panel) return { visible: false };
  return {
    visible: true,
    text: panel.textContent?.trim().slice(0, 500),
    labels: [...panel.querySelectorAll('label, span, button')].map((el) => el.textContent?.trim()).filter(Boolean).slice(0, 40),
  };
});
await page.keyboard.press('Escape');

// GET eventos sample via page context
const token = await page.evaluate(() => localStorage.getItem('accessToken'));
let apiSamples = {};
if (token) {
  const endpoints = [
    '/agenda/eventos',
    '/agenda/etiquetas',
    '/dentistas',
    '/configuracoes/salas-cadeiras',
  ];
  for (const ep of endpoints) {
    try {
      const res = await page.request.get(`${apiUrl}${ep}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => null);
      apiSamples[ep] = { status: res.status(), body: JSON.stringify(body).slice(0, 800) };
    } catch (e) {
      apiSamples[ep] = { error: String(e) };
    }
  }
}

report.apiSamples = apiSamples;
report.allApiCalls = apiCalls;

await browser.close();

const out = path.join(root, 'docs/agenda-probe-report.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`Salvo em ${out}`);
