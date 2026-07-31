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
const token = await context.storageState().then(() => null);

page.on('request', (req) => {
  const url = req.url();
  if (!url.includes('/api/financeiro/transacoes')) return;
  if (req.method() === 'GET') return;
  captured.push({ method: req.method(), url, body: req.postData() });
});

page.on('response', async (res) => {
  const url = res.url();
  if (!url.includes('/api/financeiro/transacoes')) return;
  if (res.request().method() === 'GET') return;
  captured.push({
    method: res.request().method(),
    url,
    status: res.status(),
    response: (await res.text().catch(() => '')).slice(0, 500),
  });
});

await page.goto('/financeiro/fluxo-caixa', { waitUntil: 'domcontentloaded' });
await dismiss(page);
await page.waitForTimeout(1500);

const desc = `E2E-Probe-${Date.now()}`;
await page.getByRole('button', { name: /Novo lançamento/i }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /^Receita$/i }).click();
await page.locator('#nt-valor').fill('150,00');
await page.locator('#nt-desc').fill(desc);
await page.locator('#nt-st-pago').check({ force: true }).catch(() => page.locator('#nt-st-pago').click({ force: true }));
await page.getByRole('button', { name: /Salvar lançamento/i }).click();
await page.waitForTimeout(3000);

let createdId = null;
for (const item of captured) {
  if (item.response) {
    try {
      const body = JSON.parse(item.response);
      createdId = body.id ?? body.transacao?.id ?? body.data?.id;
    } catch {
      /* ignore */
    }
  }
}

const authToken = await page.evaluate(() => localStorage.getItem('accessToken'));

// try edit/delete UI
if (createdId) {
  await page.getByRole('searchbox', { name: /Buscar lançamento/i }).fill(desc.slice(0, 12));
  await page.waitForTimeout(1000);
  const row = page.getByRole('row').filter({ hasText: desc.slice(0, 12) }).first();
  if (await row.isVisible().catch(() => false)) {
    const editBtn = row.getByRole('button', { name: /Editar/i });
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1000);
      await page.locator('#nt-desc').fill(`${desc}-Edit`);
      await page.getByRole('button', { name: /Salvar/i }).click();
      await page.waitForTimeout(2000);
    }
    const delBtn = row.getByRole('button', { name: /Excluir|Remover/i });
    if (await delBtn.isVisible().catch(() => false)) {
      await delBtn.click();
      await page.waitForTimeout(500);
      const confirm = page.getByRole('button', { name: /Confirmar|Excluir|Sim/i }).first();
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      await page.waitForTimeout(2000);
    }
  }
}

if (!createdId && authToken) {
  const list = await context.request.get(`${apiUrl}/financeiro/transacoes?pagina=1&limite=5`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const body = await list.json();
  const match = body.transacoes?.find((t) => t.descricao?.includes('E2E-Probe'));
  createdId = match?.id;
}

if (createdId && authToken) {
  await context.request.delete(`${apiUrl}/financeiro/transacoes/${createdId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  }).catch(() => undefined);
}

const exportBtn = page.getByRole('button', { name: /Exportar/i }).first();
const exportVisible = await exportBtn.isVisible().catch(() => false);

const out = path.join(root, 'docs/financeiro-crud-probe.json');
fs.writeFileSync(
  out,
  JSON.stringify({ captured, createdId, exportVisible, desc }, null, 2)
);
console.log('Wrote', out);
await browser.close();
