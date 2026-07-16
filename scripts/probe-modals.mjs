/**
 * Inspeciona modais/formulários ao clicar em ações principais.
 * Uso: node scripts/probe-modals.mjs
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

async function dismissModals(page) {
  for (const label of ['Pular tour', 'Fechar', 'Entendi', 'Continuar']) {
    const btn = page.getByRole('button', { name: label, exact: true });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => undefined);
      await page.waitForTimeout(300);
    }
  }
}

async function probeAction(page, route, action, probeFn) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
  await dismissModals(page);
  await page.waitForTimeout(800);
  const result = { route, action, ...((await probeFn(page)) ?? {}) };
  return result;
}

async function extractDialogInfo(page) {
  const dialog = page.locator('[role="dialog"]:visible, .p-dialog:visible, dialog:visible').first();
  if (!(await dialog.isVisible().catch(() => false))) {
    return { dialogVisible: false };
  }

  return page.evaluate(() => {
    const dialogEl =
      document.querySelector('[role="dialog"]:not([hidden])') ??
      document.querySelector('.p-dialog:not(.p-dialog-hidden)') ??
      document.querySelector('dialog[open]');
    if (!dialogEl) return { dialogVisible: false };

    const inputs = [...dialogEl.querySelectorAll('input, textarea, select')].map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      id: el.id,
      placeholder: el.getAttribute('placeholder'),
      label: el.getAttribute('aria-label'),
      disabled: el.disabled,
    }));

    const buttons = [...dialogEl.querySelectorAll('button')].map((b) => ({
      text: b.textContent?.trim().slice(0, 80),
      type: b.getAttribute('type'),
      disabled: b.disabled,
      ariaLabel: b.getAttribute('aria-label'),
    }));

    const headings = [...dialogEl.querySelectorAll('h1,h2,h3,h4')].map((h) => h.textContent?.trim());

    return { dialogVisible: true, headings, inputs, buttons };
  });
}

const probes = [
  {
    route: '/agenda',
    action: 'Novo agendamento',
    run: async (page) => {
      await page.getByRole('button', { name: /Novo agendamento/i }).first().click();
      await page.waitForTimeout(600);
      return extractDialogInfo(page);
    },
  },
  {
    route: '/financeiro',
    action: 'Novo lançamento',
    run: async (page) => {
      await page.getByRole('button', { name: /Novo lançamento/i }).click();
      await page.waitForTimeout(600);
      return extractDialogInfo(page);
    },
  },
  {
    route: '/estoque',
    action: 'Novo material',
    run: async (page) => {
      await page.getByRole('button', { name: /Novo material/i }).click();
      await page.waitForTimeout(600);
      return extractDialogInfo(page);
    },
  },
  {
    route: '/controle-protese',
    action: 'Nova solicitação',
    run: async (page) => {
      await page.getByRole('button', { name: /Nova solicitação/i }).click();
      await page.waitForTimeout(600);
      return extractDialogInfo(page);
    },
  },
  {
    route: '/controle-protese/laboratorios',
    action: 'Novo laboratório',
    run: async (page) => {
      await page.getByRole('button', { name: /Novo laboratório/i }).click();
      await page.waitForTimeout(600);
      return extractDialogInfo(page);
    },
  },
  {
    route: '/configuracoes',
    action: 'Adicionar membro',
    run: async (page) => {
      await page.locator('nav[aria-label="Seções"]').getByRole('button', { name: 'Equipe e permissões' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Adicionar membro/i }).click();
      await page.waitForTimeout(600);
      return extractDialogInfo(page);
    },
  },
  {
    route: '/configuracoes',
    action: 'Novo dentista',
    run: async (page) => {
      await page.locator('nav[aria-label="Seções"]').getByRole('button', { name: 'Dentistas' }).click();
      await page.waitForTimeout(500);
      const novo = page.getByRole('button', { name: /Novo dentista|Adicionar dentista/i });
      if ((await novo.count()) === 0) return { dialogVisible: false, note: 'botão novo dentista não encontrado' };
      await novo.first().click();
      await page.waitForTimeout(600);
      return extractDialogInfo(page);
    },
  },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext(
  fs.existsSync(authFile) ? { storageState: authFile } : {}
);
const page = await context.newPage();
const results = [];

for (const probe of probes) {
  try {
    results.push(await probeAction(page, probe.route, probe.action, probe.run));
  } catch (error) {
    results.push({ route: probe.route, action: probe.action, error: String(error) });
  }
}

await browser.close();
const out = path.join(root, 'docs/modal-probe-report.json');
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`Salvo em ${out}`);
