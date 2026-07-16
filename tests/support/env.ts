import dotenv from 'dotenv';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');
const testsEnv = path.resolve(__dirname, '../.env');
const rootEnv = path.resolve(projectRoot, '.env');

dotenv.config({ path: rootEnv });
dotenv.config({ path: testsEnv, override: true });

export type E2eTarget = 'local' | 'app';

const E2E_PRESETS: Record<E2eTarget, { baseUrl: string; apiUrl: string; label: string }> = {
  local: {
    label: 'Local (Angular dev server)',
    baseUrl: 'http://localhost:4200',
    apiUrl: 'http://localhost:3000/api',
  },
  app: {
    label: 'Produção (app.controledental.com.br)',
    baseUrl: 'https://app.controledental.com.br',
    apiUrl: 'https://api.controledental.com.br/api',
  },
};

function resolveE2eTarget(): E2eTarget {
  const raw = process.env.E2E_TARGET?.trim().toLowerCase();
  if (raw === 'local' || raw === 'dev') {
    return 'local';
  }
  if (raw === 'app' || raw === 'prod' || raw === 'production') {
    return 'app';
  }

  const baseUrl = process.env.E2E_BASE_URL?.trim();
  if (baseUrl?.includes('localhost') || baseUrl?.includes('127.0.0.1')) {
    return 'local';
  }

  return 'app';
}

const target = resolveE2eTarget();
const preset = E2E_PRESETS[target];
const targetWasExplicit = Boolean(process.env.E2E_TARGET?.trim());

export const e2eEnv = {
  target,
  targetLabel: preset.label,
  baseUrl: targetWasExplicit
    ? preset.baseUrl
    : process.env.E2E_BASE_URL?.trim() || preset.baseUrl,
  apiUrl: targetWasExplicit
    ? preset.apiUrl
    : process.env.E2E_API_URL?.trim() || preset.apiUrl,
  userEmail: process.env.E2E_USER_EMAIL ?? '',
  userPassword: process.env.E2E_USER_PASSWORD ?? '',
};

export function requireCredentials(): void {
  if (!e2eEnv.userEmail || !e2eEnv.userPassword) {
    throw new Error(
      'Defina E2E_USER_EMAIL e E2E_USER_PASSWORD em `.env` na raiz do projeto (veja .env.example).'
    );
  }
}

export function logE2eTarget(): void {
  console.log(
    `[E2E] target=${e2eEnv.target} | app=${e2eEnv.baseUrl} | api=${e2eEnv.apiUrl}`
  );
}
