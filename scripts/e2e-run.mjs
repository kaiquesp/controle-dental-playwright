#!/usr/bin/env node
/**
 * Roda Playwright com E2E_TARGET=local|app.
 * Uso: node scripts/e2e-run.mjs <local|app> [-- playwright args...]
 */
import { resolvePlaywrightCli, runPlaywright } from './playwright-cli.mjs';

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

if (!resolvePlaywrightCli()) {
  console.error('Playwright não encontrado. Rode npm install na raiz do projeto.');
  process.exit(1);
}

const result = runPlaywright(['test', ...passthrough], {
  env: { E2E_TARGET: target },
});

process.exit(result.status ?? 1);
