import dotenv from 'dotenv';
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

const prof = (await (await request.get(`${apiUrl}/profissionais`, { headers })).json()).profissionais[0];
const sala = (await (await request.get(`${apiUrl}/salas-cadeiras`, { headers })).json()).salasCadeiras[0];
const patientRes = await request.post(`${apiUrl}/pacientes`, {
  headers,
  data: { nome_completo: `E2E-Probe2-${Date.now()}`, cpf: '', celular_whatsapp: '5511987654321', convenio: 'Particular' },
});
const patient = await patientRes.json();
const patientId = patient.id;

const date = formatDate(addDays(new Date(), 3));
const inicio = `${date}T14:00:00`;
const fim = `${date}T14:30:00`;

const attempts = [
  ['compromisso', `${apiUrl}/agenda/compromissos`, {
    professional_id: prof.id,
    sala_cadeira_id: sala.id,
    inicio,
    fim,
    titulo: 'E2E probe compromisso',
    descricao: 'Probe',
  }],
  ['consulta1', `${apiUrl}/agenda/consulta`, {
    patient_id: patientId,
    professional_id: prof.id,
    sala_cadeira_id: sala.id,
    inicio,
    fim,
    observacoes: 'Probe',
  }],
  ['consulta2', `${apiUrl}/agenda/consulta`, {
    paciente_id: patientId,
    profissional_id: prof.id,
    sala_cadeira_id: sala.id,
    inicio,
    fim,
    observacoes: 'Probe',
  }],
  ['consulta3', `${apiUrl}/agenda/consultas`, {
    patient_id: patientId,
    professional_id: prof.id,
    sala_cadeira_id: sala.id,
    inicio,
    fim,
  }],
];

for (const [name, url, data] of attempts) {
  const res = await request.post(url, { headers, data });
  const body = await res.json().catch(() => ({}));
  console.log(name, res.status(), JSON.stringify(body).slice(0, 400));
  const id = body.consulta?.id ?? body.compromisso?.id ?? body.id;
  if (id) {
    for (const del of [`${apiUrl}/agenda/consultas/${id}`, `${apiUrl}/agenda/consulta/${id}`, `${apiUrl}/agenda/compromissos/${id}`]) {
      const d = await request.delete(del, { headers });
      if (d.ok()) break;
    }
  }
}

await request.delete(`${apiUrl}/pacientes/${patientId}`, { headers });
await browser.close();
