#!/usr/bin/env node
/**
 * Roda Playwright com E2E_TARGET=local|app.
 * Uso: node scripts/e2e-run.mjs <local|app> [-- playwright args...]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function resolvePlaywrightCli() {
  const candidates = [
    path.join(projectRoot, 'node_modules', '@playwright', 'test', 'cli.js'),
    path.join(projectRoot, 'node_modules', 'playwright', 'cli.js'),
  ];
  return candidates.find((cli) => fs.existsSync(cli)) ?? null;
}

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

const cli = resolvePlaywrightCli();
if (!cli) {
  console.error('Playwright não encontrado. Rode npm install na raiz do projeto.');
  process.exit(1);
}

const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
const pathSep = process.platform === 'win32' ? ';' : ':';
const binDir = path.join(projectRoot, 'node_modules', '.bin');
const currentPath = process.env[pathKey] ?? '';

const env = {
  ...process.env,
  E2E_TARGET: target,
  [pathKey]: currentPath.includes(binDir) ? currentPath : `${binDir}${pathSep}${currentPath}`,
};

const result = spawnSync(process.execPath, [cli, 'test', ...passthrough], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
