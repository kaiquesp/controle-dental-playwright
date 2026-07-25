/**
 * Descobre payloads da API de agenda via tentativas controladas.
 * Uso: node scripts/probe-agenda-api.mjs
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const apiUrl = process.env.E2E_API_URL ?? 'https://api.controledental.com.br/api';
const authFile = path.join(root, 'playwright/.auth/user.json');

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authFile });
const page = await context.newPage();
await page.goto('https://app.controledental.com.br/agenda', { waitUntil: 'domcontentloaded' });
const token = await page.evaluate(() => localStorage.getItem('accessToken'));

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const request = context.request;

const profRes = await request.get(`${apiUrl}/profissionais`, { headers });
const profBody = await profRes.json();
const professional = profBody.profissionais?.[0];

const salasRes = await request.get(`${apiUrl}/salas-cadeiras`, { headers });
const salasBody = await salasRes.json();
const sala = salasBody.salasCadeiras?.[0];

const patientRes = await request.post(`${apiUrl}/pacientes`, {
  headers,
  data: {
    nome_completo: `E2E-Probe-${Date.now()}`,
    cpf: '',
    data_nascimento: '',
    sexo: '',
    celular_whatsapp: '5511987654321',
    convenio: 'Particular',
  },
});
const patientBody = await patientRes.json();
const patientId = patientBody.id ?? patientBody.paciente?.id ?? patientBody.data?.id;

const targetDate = formatDate(addDays(new Date(), 2));
const inicio = `${targetDate}T10:00:00`;
const fim = `${targetDate}T10:30:00`;

const attempts = [
  {
    name: 'consulta_v1',
    url: `${apiUrl}/agenda/consultas`,
    data: {
      paciente_id: patientId,
      profissional_id: professional?.id,
      sala_cadeira_id: sala?.id,
      inicio,
      fim,
      observacoes: 'E2E probe consulta',
    },
  },
  {
    name: 'consulta_v2',
    url: `${apiUrl}/agenda/eventos`,
    data: {
      tipo: 'consulta',
      paciente_id: patientId,
      profissional_id: professional?.id,
      sala_cadeira_id: sala?.id,
      inicio,
      fim,
      titulo: 'E2E probe consulta',
    },
  },
  {
    name: 'compromisso_v1',
    url: `${apiUrl}/agenda/compromissos`,
    data: {
      profissional_id: professional?.id,
      sala_cadeira_id: sala?.id,
      inicio,
      fim,
      titulo: 'E2E probe compromisso',
      descricao: 'Probe',
    },
  },
  {
    name: 'tarefa_v1',
    url: `${apiUrl}/agenda/tarefas`,
    data: {
      profissional_id: professional?.id,
      data: targetDate,
      hora_inicio: '11:00',
      hora_fim: '11:30',
      titulo: 'E2E probe tarefa',
      prioridade: 'media',
      area: 'administrativo',
    },
  },
];

const results = { patientId, professional, sala, targetDate, attempts: [] };
const created = [];

for (const attempt of attempts) {
  const res = await request.post(attempt.url, { headers, data: attempt.data });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 500);
  }
  results.attempts.push({ ...attempt, status: res.status(), body });
  if (res.ok()) {
    const id =
      body?.id ??
      body?.consulta?.id ??
      body?.compromisso?.id ??
      body?.tarefa?.id ??
      body?.evento?.id;
    if (id) created.push({ type: attempt.name, id, url: attempt.url });
  }
}

// Cleanup
for (const item of created) {
  const deleteUrls = [
    `${apiUrl}/agenda/consultas/${item.id}`,
    `${apiUrl}/agenda/compromissos/${item.id}`,
    `${apiUrl}/agenda/tarefas/${item.id}`,
    `${apiUrl}/agenda/eventos/${item.id}`,
  ];
  for (const url of deleteUrls) {
    const del = await request.delete(url, { headers });
    if (del.ok()) break;
  }
}
if (patientId) {
  await request.delete(`${apiUrl}/pacientes/${patientId}`, { headers });
}

await browser.close();

const out = path.join(root, 'docs/agenda-api-probe.json');
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`Salvo em ${out}`);
