import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
const authFile = path.join(root, 'playwright/.auth/user.json');

const captured = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authFile, baseURL: 'https://app.controledental.com.br' });
const page = await context.newPage();

page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('/api/agenda/')) {
    captured.push({ method: req.method(), url: req.url(), body: req.postDataJSON() });
  }
});
page.on('response', async (res) => {
  if (res.request().method() === 'POST' && res.url().includes('/api/agenda/')) {
    captured.push({ url: res.url(), status: res.status(), response: (await res.text()).slice(0, 600) });
  }
});

async function dismiss(page) {
  for (const label of ['Pular tour', 'Fechar', 'Entendi', 'Continuar']) {
    const btn = page.getByRole('button', { name: label, exact: true });
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
  }
}

await page.goto('/agenda', { waitUntil: 'domcontentloaded' });
await dismiss(page);
await page.waitForTimeout(1500);

// Create patient first via API for consulta
const token = await page.evaluate(() => localStorage.getItem('accessToken'));
const apiUrl = 'https://api.controledental.com.br/api';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const patientRes = await context.request.post(`${apiUrl}/pacientes`, {
  headers,
  data: { nome_completo: `E2E-UI-Probe-${Date.now()}`, cpf: '', celular_whatsapp: '5511987654321', convenio: 'Particular' },
});
const patient = await patientRes.json();
const patientName = patient.nome_completo ?? `E2E-UI-Probe`;

await page.getByRole('button', { name: /Novo agendamento/i }).first().click();
await page.waitForTimeout(800);
const dialog = page.locator('[role="dialog"]:visible, .p-dialog:visible').last();

// Try fill consulta form - look for patient autocomplete
const patientInput = dialog.locator('input').filter({ hasText: '' }).first();
// Search by placeholder or label
const inputs = dialog.locator('input:visible, textarea:visible, [role="combobox"]:visible');
const count = await inputs.count();
const inputInfo = [];
for (let i = 0; i < count; i++) {
  const el = inputs.nth(i);
  inputInfo.push({
    id: await el.getAttribute('id'),
    placeholder: await el.getAttribute('placeholder'),
    aria: await el.getAttribute('aria-label'),
    role: await el.getAttribute('role'),
  });
}

// Try patient search field
const pacienteField = dialog.locator('#agenda-paciente, [id*="paciente"], input[placeholder*="Paciente" i]').first();
if (await pacienteField.isVisible().catch(() => false)) {
  await pacienteField.fill(patientName.slice(0, 8));
  await page.waitForTimeout(1000);
  const option = page.getByRole('option').filter({ hasText: patientName.slice(0, 8) }).first();
  if (await option.isVisible().catch(() => false)) await option.click();
}

const saveBtn = dialog.getByRole('button', { name: /Salvar|Agendar|Criar/i }).first();
if (await saveBtn.isVisible().catch(() => false)) {
  await saveBtn.click();
  await page.waitForTimeout(2000);
}

const out = path.join(root, 'docs/agenda-ui-probe.json');
fs.writeFileSync(out, JSON.stringify({ inputInfo, captured, patientName, patientId: patient.id }, null, 2));
console.log('saved', out);

await context.request.delete(`${apiUrl}/pacientes/${patient.id}`, { headers }).catch(() => undefined);
await browser.close();
