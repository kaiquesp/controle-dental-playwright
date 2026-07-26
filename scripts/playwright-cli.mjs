import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

export const PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(ROOT, '.cache', 'ms-playwright');

export function resolvePlaywrightCli() {
  const candidates = [
    path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'),
    path.join(ROOT, 'node_modules', 'playwright', 'cli.js'),
  ];
  return candidates.find((cli) => fs.existsSync(cli)) ?? null;
}

export function buildPathEnv(extra = {}) {
  const binDir = path.join(ROOT, 'node_modules', '.bin');
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
  const pathSep = process.platform === 'win32' ? ';' : ':';
  const currentPath = process.env[pathKey] ?? '';
  return {
    ...process.env,
    ...extra,
    PLAYWRIGHT_BROWSERS_PATH,
    [pathKey]: currentPath.includes(binDir) ? currentPath : `${binDir}${pathSep}${currentPath}`,
  };
}

export function browsersInstalled() {
  try {
    const entries = fs.readdirSync(PLAYWRIGHT_BROWSERS_PATH);
    return entries.some((name) => name.startsWith('chromium'));
  } catch {
    return false;
  }
}

export function spawnPlaywright(args, options = {}) {
  const cli = resolvePlaywrightCli();
  if (!cli) {
    throw new Error('Playwright não encontrado. Rode npm install na raiz do projeto.');
  }
  return spawn(process.execPath, [cli, ...args], {
    cwd: ROOT,
    env: buildPathEnv(options.env),
    shell: false,
    ...options,
  });
}

export function runPlaywright(args, options = {}) {
  const cli = resolvePlaywrightCli();
  if (!cli) {
    console.error('Playwright não encontrado. Rode npm install na raiz do projeto.');
    return { status: 1 };
  }
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: ROOT,
    env: buildPathEnv(options.env),
    stdio: options.stdio ?? 'inherit',
    shell: false,
  });
}
