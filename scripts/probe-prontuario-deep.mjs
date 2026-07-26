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
const uploadFile = path.join(root, 'tests/assets/e2e-sample.txt');

async function dismissBilling(page) {
  await page.evaluate(() => {
    const s = window.controleDentalSession;
    if (s?.plano) s.plano.pagamentoEmDia = true;
  }).catch(() => undefined);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authFile, baseURL });
const page = await context.newPage();
const report = {};

await page.goto('/', { waitUntil: 'domcontentloaded' });
const token = await page.evaluate(() => localStorage.getItem('accessToken'));
const patientRes = await context.request.post(`${apiUrl}/pacientes`, {
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  data: { nome_completo: `E2E-Deep-${Date.now()}`, cpf: '', celular_whatsapp: '5511987654321', convenio: 'Particular' },
});
const patientBody = await patientRes.json();
const patientId = String(patientBody.id ?? patientBody.paciente?.id ?? '');
if (!patientId) throw new Error(JSON.stringify(patientBody));
report.patientId = patientId;

// Tratamento procedure search
await page.goto(`/pacientes/${patientId}/edit/tratamentos`, { waitUntil: 'domcontentloaded' });
await dismissBilling(page);
await page.waitForTimeout(2000);
const novoTrat = page.getByRole('button', { name: /Novo tratamento/i });
if (!(await novoTrat.isVisible().catch(() => false))) {
  report.tratSkip = await page.locator('button:visible').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()).slice(0, 20));
} else {
  await novoTrat.click();
await page.waitForTimeout(1000);
const proc = page.locator('#trat-modal-proc');
for (const q of ['a', 'con', 'limpeza', 'restaura', 'consulta', 'protese']) {
  await proc.fill('');
  await proc.fill(q);
  await page.waitForTimeout(800);
  const options = await page.locator('.p-autocomplete-option, .p-autocomplete-item, [role="option"], .p-select-option').allTextContents();
  report[`trat_proc_${q}`] = options.slice(0, 8);
}
await page.keyboard.press('Escape');
}

// Upload file
await page.goto(`/pacientes/${patientId}/edit/arquivos`, { waitUntil: 'domcontentloaded' });
await dismissBilling(page);
await page.getByRole('button', { name: /Fazer Upload/i }).click();
await page.waitForTimeout(800);
const dialog = page.getByRole('dialog').filter({ hasText: /arquivo|upload/i });
const input = dialog.locator('input[type="file"]');
await input.setInputFiles(uploadFile);
await page.waitForTimeout(1000);
report.upload = {
  confirmDisabled: await dialog.getByRole('button', { name: /^Enviar arquivos$/i }).isDisabled(),
  html: await dialog.innerHTML().then((h) => h.slice(0, 2000)),
};

// Anamnese save state
await page.goto(`/pacientes/${patientId}/edit/anamneses`, { waitUntil: 'domcontentloaded' });
await dismissBilling(page);
await page.getByRole('button', { name: /Nova anamnese|Criar primeira anamnese/i }).first().click();
await page.waitForTimeout(1000);
await page.locator('#anam-queixa').fill('Queixa E2E teste');
await page.locator('#anam-obs-inicial').fill('Obs E2E');
report.anamAfterQueixa = await page.getByRole('button', { name: /Salvar anamnese/i }).isDisabled();
await page.getByRole('button', { name: /Adicionar pergunta/i }).click().catch(() => undefined);
await page.waitForTimeout(500);
const lastField = page.locator('textarea:visible, input:visible:not([readonly])').last();
if (await lastField.isVisible().catch(() => false)) await lastField.fill('Resposta E2E');
report.anamAfterPergunta = await page.getByRole('button', { name: /Salvar anamnese/i }).isDisabled();

// Pagamentos dialog
await page.goto(`/pacientes/${patientId}/edit/pagamentos`, { waitUntil: 'domcontentloaded' });
await dismissBilling(page);
await page.getByRole('button', { name: /Link de cobrança/i }).click();
await page.waitForTimeout(1000);
report.paylink = {
  hostVisible: await page.locator('p-dialog[header="Gerar pagamento pelo link"]').isVisible(),
  innerVisible: await page.locator('.paciente-paylink-modal').isVisible(),
  visibleDialog: await page.locator('[role="dialog"]:visible').count(),
};

// Orcamento checkboxes
await page.goto(`/pacientes/${patientId}/edit/orcamentos`, { waitUntil: 'domcontentloaded' });
await dismissBilling(page);
await page.getByRole('button', { name: /Criar orçamento/i }).click();
await page.waitForTimeout(1000);
report.orcCheckboxes = await page.locator('input[type="checkbox"]:visible, label:visible').evaluateAll((els) =>
  els.map((el) => ({ tag: el.tagName, text: (el.textContent ?? '').trim().slice(0, 80), id: el.id }))
);

await context.request.delete(`${apiUrl}/pacientes/${patientId}`, { headers: { Authorization: `Bearer ${token}` } });
fs.writeFileSync(path.join(root, 'docs/prontuario-deep-probe.json'), JSON.stringify(report, null, 2));
console.log('done');
await browser.close();
