import { type Browser, type Page, type APIRequestContext } from '@playwright/test';
import {
  createAuthenticatedE2eContext,
  createPatientByApi,
  createE2ePatientViaUi,
  deletePatientByApi,
  e2eName,
  readAccessToken,
} from './crud-helpers';
import path from 'path';

export type E2ePatient = { id: string; name: string };

export async function createE2ePatientByApi(browser: Browser, prefix = 'Paciente'): Promise<E2ePatient> {
  const context = await createAuthenticatedE2eContext(browser);
  const page = await context.newPage();
  await page.goto('/');
  const token = await readAccessToken(page);
  if (!token) {
    await context.close();
    throw new Error('Token ausente para criar paciente E2E');
  }
  const name = e2eName(prefix);
  const id = await createPatientByApi(context.request, token, name);
  await context.close();
  return { id, name };
}

export async function deleteE2ePatient(browser: Browser, patientId: string): Promise<void> {
  const context = await createAuthenticatedE2eContext(browser);
  const page = await context.newPage();
  await page.goto('/');
  const token = await readAccessToken(page);
  if (token) {
    await deletePatientByApi(context.request, token, patientId);
  }
  await context.close();
}

export async function deleteE2ePatientWithPage(
  page: Page,
  request: APIRequestContext,
  patientId: string
): Promise<void> {
  const token = await readAccessToken(page);
  if (token) {
    await deletePatientByApi(request, token, patientId);
  }
}

export async function createE2ePatientOnPage(page: Page, prefix = 'Paciente'): Promise<E2ePatient> {
  return createE2ePatientViaUi(page, prefix);
}

export function e2eUploadFilePath(filename = 'e2e-sample.pdf'): string {
  return path.resolve(__dirname, '../assets', filename);
}
