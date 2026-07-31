/**
 * Remove resíduos E2E-* da agenda (compromissos/consultas/tarefas).
 * Uso: node scripts/purge-e2e-agenda.mjs
 * Requer sessão válida em playwright/.auth/user.json
 */
import dotenv from 'dotenv';
import path from 'path';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const authFile = path.join(root, 'playwright/.auth/user.json');
const apiUrl = process.env.E2E_API_URL ?? 'https://api.controledental.com.br/api';
const baseURL = process.env.E2E_BASE_URL ?? 'https://app.controledental.com.br';

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authFile, baseURL });
const page = await context.newPage();
await page.goto('/agenda', { waitUntil: 'domcontentloaded' });
const token = await page.evaluate(() => localStorage.getItem('accessToken'));
if (!token) {
  console.error('Sem accessToken — rode npm run test:setup:app antes');
  await browser.close();
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const de = formatDate(addDays(new Date(), -14));
const ate = formatDate(addDays(new Date(), 30));

const eventosRes = await context.request.get(`${apiUrl}/agenda/eventos?de=${de}&ate=${ate}`, { headers });
const eventosBody = await eventosRes.json().catch(() => ({}));
const eventos = eventosBody.eventos ?? [];

let removed = 0;
for (const event of eventos) {
  const label = String(event.titulo ?? event.paciente_nome ?? '');
  if (!/^E2E[- ]/i.test(label) || !event.id) continue;
  const tipo = String(event.tipo ?? event.tipo_evento ?? event.tipoEvento ?? '').toLowerCase();
  const paths = tipo.includes('tarefa')
    ? [`/agenda/tarefas/${event.id}`]
    : tipo.includes('consulta')
      ? [`/agenda/consultas/${event.id}`, `/consultas/${event.id}`, `/agenda/consulta/${event.id}`]
      : [`/agenda/compromissos/${event.id}`];
  for (const p of paths) {
    const res = await context.request.delete(`${apiUrl}${p}`, { headers });
    if (res.ok() || res.status() === 404) {
      removed += 1;
      console.log('removed', label, p, res.status());
      break;
    }
  }
}

const tarefasRes = await context.request.get(`${apiUrl}/agenda/tarefas?de=${de}&ate=${ate}`, { headers });
const tarefasBody = await tarefasRes.json().catch(() => ({}));
for (const tarefa of tarefasBody.tarefas ?? []) {
  if (!/^E2E[- ]/i.test(tarefa.titulo ?? '')) continue;
  const res = await context.request.delete(`${apiUrl}/agenda/tarefas/${tarefa.id}`, { headers });
  if (res.ok() || res.status() === 404) {
    removed += 1;
    console.log('removed tarefa', tarefa.titulo, res.status());
  }
}

console.log(`Done. Removed ~${removed} E2E leftovers (${de} → ${ate})`);
await browser.close();
