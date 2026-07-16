#!/usr/bin/env node
/**
 * Roda Playwright com E2E_TARGET=local|app.
 * Uso: node scripts/e2e-run.mjs <local|app> [-- playwright args...]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const target = process.argv[2];
let passthrough = process.argv.slice(3);
if (passthrough[0] === '--') {
  passthrough = passthrough.slice(1);
}

if (target !== 'local' && target !== 'app') {
  console.error('Uso: node scripts/e2e-run.mjs <local|app> [-- playwright args...]');
  console.error('  local → http://localhost:4200 + http://localhost:3000/api');
  console.error('  app   → https://app.controledental.com.br');
  process.exit(1);
}

const env = {
  ...process.env,
  E2E_TARGET: target,
};

const result = spawnSync('npx', ['playwright', 'test', ...passthrough], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
