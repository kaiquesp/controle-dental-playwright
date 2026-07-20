#!/usr/bin/env node
/**
 * Captura screenshots para a Central de Ajuda (produção ou local).
 *
 * Pré-requisitos:
 * 1. npm run test:setup:app:headed  (sessão em playwright/.auth/)
 * 2. No backend: npm run help:export-manifest
 *
 * Uso: npm run help:capture
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';

import { applyPrivacyMask, waitForShell } from './help-privacy-mask.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, 'tests', '.env'), override: true });

const baseUrl =
  process.env.E2E_BASE_URL?.trim() ||
  (process.env.E2E_TARGET === 'local' ? 'http://localhost:4200' : 'https://app.controledental.com.br');

const apiUrl =
  process.env.E2E_API_URL?.trim() ||
  (baseUrl.includes('localhost') ? 'http://localhost:3000/api' : 'https://api.controledental.com.br/api');

const authDir = path.join(projectRoot, 'playwright', '.auth');
const authCandidates = [
  path.join(authDir, 'user-app.json'),
  path.join(authDir, 'user.json'),
];
const authFile = authCandidates.find((f) => fs.existsSync(f));

const manifestPath = path.join(projectRoot, 'output', 'help-center', 'capture-manifest.json');
const outDir = path.join(projectRoot, 'output', 'help-screenshots');

function resolvePatientPath(route, patientId) {
  return route.replaceAll('__PATIENT__', patientId);
}

async function readTokenFromAuth() {
  if (!authFile) return null;
  const state = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  for (const origin of state.origins ?? []) {
    const token = origin.localStorage?.find((item) => item.name === 'accessToken')?.value;
    if (token) return token;
  }
  return null;
}

async function createDemoPatient(request, token) {
  const name = `Paciente Ajuda ${Date.now()}`;
  const response = await request.post(`${apiUrl}/pacientes`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      nome_completo: name,
      cpf: '',
      data_nascimento: '',
      sexo: '',
      celular_whatsapp: '5511999999999',
      convenio: 'Particular',
    },
  });
  if (!response.ok()) {
    throw new Error(`Falha ao criar paciente demo: ${response.status()}`);
  }
  const body = await response.json();
  const id = body?.id ?? body?.paciente?.id ?? body?.data?.id;
  if (!id) throw new Error('Paciente demo sem id');
  return String(id);
}

async function dismissModals(page) {
  const skipTour = page.getByText('Pular tour', { exact: true });
  if (await skipTour.isVisible().catch(() => false)) {
    await skipTour.click();
    await page.waitForTimeout(300);
  }

  for (const label of [/Fechar/i, /Entendi/i, /Continuar/i]) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 2000 }).catch(() => undefined);
    }
  }
}

async function openConfigSection(page, label) {
  const link = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
  if (await link.isVisible().catch(() => false)) {
    await link.click();
    await page.waitForTimeout(800);
    return;
  }
  const tab = page.getByText(new RegExp(label, 'i')).first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(800);
  }
}

async function captureJob(page, job, patientId) {
  const urlPath = resolvePatientPath(job.capture.path, patientId);
  await page.goto(urlPath, { waitUntil: 'domcontentloaded' });
  await waitForShell(page);
  await dismissModals(page);

  if (job.capture.configSection) {
    await openConfigSection(page, job.capture.configSection);
  }

  if (job.capture.readySelector) {
    await page.waitForSelector(job.capture.readySelector, { timeout: 15000 }).catch(() => undefined);
  }

  await applyPrivacyMask(page);
  await page.waitForTimeout(400);

  const targetDir = path.join(outDir, job.articleSlug);
  fs.mkdirSync(targetDir, { recursive: true });
  const filePath = path.join(targetDir, `${job.shot}.png`);

  await page.screenshot({ path: filePath, fullPage: false, timeout: 15000 });
  return filePath;
}

async function main() {
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest ausente: ${manifestPath}`);
    console.error('Execute no backend: npm run help:export-manifest');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const jobs = manifest.jobs ?? [];
  console.log(`[help-capture] ${jobs.length} capturas | app=${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  let patientId = '1';

  const publicJobs = jobs.filter((j) => j.capture.public);
  const authJobs = jobs.filter((j) => !j.capture.public);

  if (publicJobs.length) {
    const publicContext = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1280, height: 720 },
      locale: 'pt-BR',
    });
    const page = await publicContext.newPage();

    for (const job of publicJobs) {
      try {
        const saved = await captureJob(page, job, patientId);
        console.log(`[ok] public ${job.file}`);
      } catch (error) {
        console.warn(`[skip] public ${job.file}: ${error.message}`);
      }
    }
    await publicContext.close();
  }

  if (authJobs.length) {
    if (!authFile) {
      console.error('Sessão autenticada ausente. Rode: npm run test:setup:app:headed');
      process.exit(1);
    }

    const authContext = await browser.newContext({
      baseURL: baseUrl,
      storageState: authFile,
      viewport: { width: 1280, height: 720 },
      locale: 'pt-BR',
    });
    const page = await authContext.newPage();
    const token = await readTokenFromAuth();

    if (token && authJobs.some((j) => j.capture.path.includes('__PATIENT__'))) {
      try {
        patientId = await createDemoPatient(authContext.request, token);
        console.log(`[help-capture] Paciente demo: ${patientId}`);
      } catch (error) {
        console.warn(`[help-capture] Usando patientId=1 (${error.message})`);
      }
    }

    for (const job of authJobs) {
      try {
        await captureJob(page, job, patientId);
        console.log(`[ok] auth ${job.file}`);
      } catch (error) {
        console.warn(`[skip] auth ${job.file}: ${error.message}`);
      }
    }

    await authContext.close();
  }

  await browser.close();
  console.log(`[help-capture] Salvo em ${outDir}`);
}

main().catch((error) => {
  console.error('[help-capture] Erro:', error);
  process.exit(1);
});
