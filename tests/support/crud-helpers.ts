import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { AUTH_FILE } from './auth-state';
import { installAllPaymentMocks, installAllPaymentMocksOnContext } from './billing-mocks';
import { e2eEnv } from './env';
import { dismissAppModals } from './onboarding';

export function e2eName(prefix: string): string {
  return `E2E-${prefix}-${Date.now()}`;
}

export async function readAccessToken(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('accessToken'));
}

export async function deletePatientByApi(request: APIRequestContext, token: string, patientId: string): Promise<void> {
  await request.delete(`${e2eEnv.apiUrl}/pacientes/${patientId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function extractPatientId(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (typeof record.id === 'number') {
    return String(record.id);
  }

  for (const nestedKey of ['paciente', 'data'] as const) {
    const nested = record[nestedKey];
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
      continue;
    }
    const nestedRecord = nested as Record<string, unknown>;
    if (typeof nestedRecord.id === 'number') {
      return String(nestedRecord.id);
    }
    const paciente = nestedRecord.paciente;
    if (paciente && typeof paciente === 'object' && !Array.isArray(paciente)) {
      const pacienteId = (paciente as Record<string, unknown>).id;
      if (typeof pacienteId === 'number') {
        return String(pacienteId);
      }
    }
  }

  return null;
}

export async function createPatientByApi(
  request: APIRequestContext,
  token: string,
  name: string
): Promise<string> {
  const response = await request.post(`${e2eEnv.apiUrl}/pacientes`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      nome_completo: name,
      cpf: '',
      data_nascimento: '',
      sexo: '',
      celular_whatsapp: '5511987654321',
      convenio: 'Particular',
    },
  });

  if (!response.ok()) {
    throw new Error(`createPatientByApi failed (${response.status()}): ${(await response.text()).slice(0, 300)}`);
  }

  const patientId = extractPatientId(await response.json());
  if (!patientId) {
    throw new Error('createPatientByApi: resposta sem id do paciente');
  }

  return patientId;
}

export async function deleteMaterialByApi(request: APIRequestContext, token: string, materialId: string): Promise<void> {
  await request.delete(`${e2eEnv.apiUrl}/estoque/materiais/${materialId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteLaboratorioByApi(
  request: APIRequestContext,
  token: string,
  laboratorioId: string
): Promise<void> {
  await request.delete(`${e2eEnv.apiUrl}/controle-protese/laboratorios/${laboratorioId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Gera CPF válido apenas para testes (algoritmo dígitos verificadores). */
export async function createAuthenticatedE2eContext(browser: Browser) {
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    baseURL: e2eEnv.baseUrl,
  });
  await installAllPaymentMocksOnContext(context);
  return context;
}

export async function createE2ePatientViaUi(page: Page, prefix = 'Paciente'): Promise<{ id: string; name: string }> {
  const name = e2eName(prefix);

  await installAllPaymentMocks(page);
  await page.goto('/pacientes/novo', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await dismissAppModals(page);
  await page.waitForTimeout(1_500);
  await dismissAppModals(page);
  await expect(page.getByRole('dialog', { name: /Acesso bloqueado por pendência/i })).toHaveCount(0);

  await page.locator('#np-nome').fill(name);
  await page.locator('#np-cel').fill('(11) 98765-4321');
  await page.locator('#np-sem-cpf').check();
  await page.getByRole('button', { name: /Salvar Paciente/i }).click();
  await page.waitForURL(/\/pacientes\/\d+\/edit/, { timeout: 30_000 });

  const id = page.url().match(/\/pacientes\/(\d+)\/edit/)?.[1];
  if (!id) {
    throw new Error('Paciente E2E criado sem id na URL');
  }

  return { id, name };
}

export function generateValidCpf(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));

  const calc = (base: number[]): number => {
    const sum = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  digits.push(calc(digits));
  digits.push(calc(digits));

  const raw = digits.join('');
  return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
}
