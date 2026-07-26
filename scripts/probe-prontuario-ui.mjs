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

async function dismiss(page) {
  for (const label of ['Pular tour', 'Fechar', 'Entendi', 'Continuar']) {
    const btn = page.getByRole('button', { name: label, exact: true });
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
}

async function collectUi(page) {
  const buttons = await page.locator('button:visible').evaluateAll((els) =>
    els.map((el) => ({
      text: (el.textContent ?? '').trim().slice(0, 80),
      aria: el.getAttribute('aria-label') ?? '',
      id: el.id,
    }))
  );
  const headings = await page.locator('h1:visible, h2:visible, h3:visible').evaluateAll((els) =>
    els.map((el) => (el.textContent ?? '').trim())
  );
  const inputs = await page.locator('input:visible, textarea:visible, select:visible').evaluateAll((els) =>
    els.map((el) => ({
      id: el.id,
      name: el.getAttribute('name'),
      type: el.getAttribute('type'),
      placeholder: el.getAttribute('placeholder'),
    }))
  );
  return { url: page.url(), buttons, headings, inputs };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authFile, baseURL });
const page = await context.newPage();
const report = { generatedAt: new Date().toISOString(), screens: {} };

await page.goto('/', { waitUntil: 'domcontentloaded' });
const token = await page.evaluate(() => localStorage.getItem('accessToken'));
report.hasToken = Boolean(token);

const patientRes = await context.request.post(`${apiUrl}/pacientes`, {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  data: {
    nome_completo: `E2E-Probe-Pront-${Date.now()}`,
    cpf: '',
    celular_whatsapp: '5511987654321',
    convenio: 'Particular',
  },
});
const patientBody = await patientRes.json();
const patientId = String(patientBody.id ?? patientBody.paciente?.id ?? patientBody.data?.id ?? '').trim() || null;
report.patientCreateStatus = patientRes.status();
report.patientBody = patientBody;
if (!patientRes.ok() || !patientId) {
  throw new Error(`create patient failed (${patientRes.status()}): ${JSON.stringify(patientBody).slice(0, 400)}`);
}
report.patientId = patientId;

const tabs = [
  'informacoes',
  'plano-ficha',
  'orcamentos',
  'tratamentos',
  'receituario',
  'arquivos',
  'anamneses',
  'documentos',
  'pagamentos',
];

await page.goto('/pacientes/buscar', { waitUntil: 'domcontentloaded' });
await dismiss(page);
await page.waitForTimeout(2000);
report.screens.listagem = await collectUi(page);

for (const tab of tabs) {
  await page.goto(`/pacientes/${patientId}/edit/${tab}`, { waitUntil: 'domcontentloaded' });
  await dismiss(page);
  await page.waitForTimeout(2000);
  report.screens[tab] = await collectUi(page);
}

await page.goto(`/pacientes/${patientId}/edit/orcamentos`, { waitUntil: 'domcontentloaded' });
await dismiss(page);
const novoOrc = page.getByRole('button', { name: /Novo orçamento|Novo Orçamento|Criar orçamento/i }).first();
if (await novoOrc.isVisible().catch(() => false)) {
  await novoOrc.click();
  await page.waitForTimeout(1200);
  report.screens.orcamentoModal = await collectUi(page);
}

await context.request.delete(`${apiUrl}/pacientes/${patientId}`, {
  headers: { Authorization: `Bearer ${token}` },
});

const out = path.join(root, 'docs/prontuario-probe-report.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('Wrote', out);
await browser.close();
