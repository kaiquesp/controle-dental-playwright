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

const captured = [];

async function dismiss(page) {
  for (const label of ['Pular tour', 'Fechar', 'Entendi', 'Continuar']) {
    const btn = page.getByRole('button', { name: label, exact: true });
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authFile, baseURL });
const page = await context.newPage();

page.on('request', (req) => {
  const url = req.url();
  if (!url.includes('/api/financeiro')) return;
  captured.push({
    method: req.method(),
    url,
    body: req.postData()?.slice(0, 600) ?? null,
  });
});

await page.goto('/financeiro/fluxo-caixa', { waitUntil: 'domcontentloaded' });
await dismiss(page);
await page.waitForTimeout(2000);

const novoBtn = page.getByRole('button', { name: /Novo lançamento/i }).first();
if (await novoBtn.isVisible().catch(() => false)) {
  await novoBtn.click();
  await page.waitForTimeout(1500);
  const inputs = await page.locator('[role="dialog"]:visible input, .p-dialog:visible input, .p-dialog:visible textarea').evaluateAll((els) =>
    els.map((el) => ({
      id: el.id,
      name: el.getAttribute('name'),
      type: el.getAttribute('type'),
      placeholder: el.getAttribute('placeholder'),
    }))
  );
  const buttons = await page.locator('[role="dialog"]:visible button, .p-dialog:visible button').evaluateAll((els) =>
    els.map((el) => el.textContent?.trim()).filter(Boolean)
  );
  captured.push({ probe: 'modal-fields', inputs, buttons });
  await page.keyboard.press('Escape');
}

const token = await page.evaluate(() => localStorage.getItem('accessToken'));
const apiProbes = [];
for (const endpoint of [
  '/financeiro/transacoes',
  '/financeiro/lancamentos',
  '/financeiro/movimentos',
  '/financeiro/fluxo-caixa',
  '/financeiro/dashboard',
  '/financeiro/resumo',
]) {
  const res = await context.request.get(`${apiUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  apiProbes.push({ endpoint, status: res.status(), sample: (await res.text()).slice(0, 300) });
}

const out = path.join(root, 'docs/financeiro-api-probe.json');
fs.writeFileSync(out, JSON.stringify({ captured, apiProbes, url: page.url() }, null, 2));
console.log('Wrote', out);
await browser.close();
