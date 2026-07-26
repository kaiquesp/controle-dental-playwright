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

async function dismissBilling(page) {
  await page.evaluate(() => {
    const s = window.controleDentalSession;
    if (s?.plano) s.plano.pagamentoEmDia = true;
  }).catch(() => undefined);
  await page.locator('.p-dialog-mask').evaluateAll((els) => els.forEach((el) => el.remove())).catch(() => undefined);
}

async function collectUi(page, scope = page) {
  const buttons = await scope.locator('button:visible').evaluateAll((els) =>
    els.map((el) => ({
      text: (el.textContent ?? '').trim().slice(0, 80),
      aria: el.getAttribute('aria-label') ?? '',
      id: el.id,
      disabled: el.disabled,
      form: el.getAttribute('form') ?? '',
    }))
  );
  const inputs = await scope.locator('input, textarea, [role="combobox"]').evaluateAll((els) =>
    els.map((el) => ({
      id: el.id,
      role: el.getAttribute('role'),
      ariaDisabled: el.getAttribute('aria-disabled'),
      type: el.getAttribute('type'),
      placeholder: el.getAttribute('placeholder'),
      readonly: el.hasAttribute('readonly'),
    }))
  );
  return { buttons, inputs };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authFile, baseURL });
const page = await context.newPage();
const report = {};

await page.goto('/', { waitUntil: 'domcontentloaded' });
const token = await page.evaluate(() => localStorage.getItem('accessToken'));
const patientRes = await context.request.post(`${apiUrl}/pacientes`, {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  data: { nome_completo: `E2E-Modal-${Date.now()}`, cpf: '', celular_whatsapp: '5511987654321', convenio: 'Particular' },
});
const patientBody = await patientRes.json();
const patientId = String(patientBody.id ?? patientBody.paciente?.id ?? '').trim();
report.patientId = patientId;

// Orçamento modal
await page.goto(`/pacientes/${patientId}/edit/orcamentos`, { waitUntil: 'domcontentloaded' });
await dismissBilling(page);
await page.getByRole('button', { name: /Criar orçamento/i }).click();
await page.waitForTimeout(1500);
report.orcamentoModal = await collectUi(page);

// Tratamento modal
await page.goto(`/pacientes/${patientId}/edit/tratamentos`, { waitUntil: 'domcontentloaded' });
await dismissBilling(page);
await page.getByRole('button', { name: /Novo tratamento/i }).click();
await page.waitForTimeout(1500);
report.tratamentoModal = await collectUi(page);

// Arquivos upload
await page.goto(`/pacientes/${patientId}/edit/arquivos`, { waitUntil: 'domcontentloaded' });
await dismissBilling(page);
await page.getByRole('button', { name: /Fazer Upload/i }).click();
await page.waitForTimeout(1500);
report.arquivosUpload = await collectUi(page);
report.arquivosFileInputs = await page.locator('input[type="file"]').count();

// Anamnese
await page.goto(`/pacientes/${patientId}/edit/anamneses`, { waitUntil: 'domcontentloaded' });
await dismissBilling(page);
await page.getByRole('button', { name: /Nova anamnese|Criar primeira anamnese/i }).first().click();
await page.waitForTimeout(1500);
report.anamneseAfterNova = await collectUi(page);

// Pagamentos link
await page.goto(`/pacientes/${patientId}/edit/pagamentos`, { waitUntil: 'domcontentloaded' });
await dismissBilling(page);
await page.getByRole('button', { name: /Link de cobrança/i }).click();
await page.waitForTimeout(1500);
report.pagamentoLink = await collectUi(page);

await context.request.delete(`${apiUrl}/pacientes/${patientId}`, { headers: { Authorization: `Bearer ${token}` } });
const out = path.join(root, 'docs/prontuario-modals-probe.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('Wrote', out);
await browser.close();
