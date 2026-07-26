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
  if (!url.includes('/api/')) return;
  if (req.method() === 'GET' && /\/api\/(pacientes|agenda|feature-flags)/.test(url)) return;
  captured.push({ method: req.method(), url, body: req.postData()?.slice(0, 400) ?? null });
});

await page.goto('/', { waitUntil: 'domcontentloaded' });
const token = await page.evaluate(() => localStorage.getItem('accessToken'));

const patientRes = await context.request.post(`${apiUrl}/pacientes`, {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  data: {
    nome_completo: `E2E-Probe-Pag-${Date.now()}`,
    cpf: '',
    celular_whatsapp: '5511987654321',
    convenio: 'Particular',
  },
});
const patientBody = await patientRes.json();
const patientId = String(patientBody.id ?? patientBody.paciente?.id ?? '');
if (!patientId) throw new Error('Falha ao criar paciente probe');

await page.goto(`/pacientes/${patientId}/edit/pagamentos`, { waitUntil: 'domcontentloaded' });
await dismiss(page);
await page.waitForTimeout(2000);

const actions = [
  /Novo lançamento|Adicionar|Nova receita/i,
  /link de cobrança|cobrança|copiar link/i,
  /boleto|emitir boleto/i,
  /^Pagar$/i,
  /extrato/i,
];

for (const pattern of actions) {
  const btn = page.getByRole('button', { name: pattern }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => undefined);
    await page.waitForTimeout(1200);
    const confirm = page.getByRole('button', { name: /Confirmar|Gerar|Emitir|Salvar|Copiar/i }).first();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click().catch(() => undefined);
      await page.waitForTimeout(1200);
    }
    await page.keyboard.press('Escape').catch(() => undefined);
  }
}

await context.request.delete(`${apiUrl}/pacientes/${patientId}`, {
  headers: { Authorization: `Bearer ${token}` },
});

const out = path.join(root, 'docs/pagamentos-api-probe.json');
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), captured }, null, 2));
console.log('Wrote', out, `(${captured.length} requests)`);
await browser.close();
