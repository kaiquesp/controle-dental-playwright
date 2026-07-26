#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const shouldInstall =
  process.env.PLAYWRIGHT_INSTALL_ON_POSTINSTALL === '1' ||
  process.env.CI === 'true' ||
  Boolean(process.env.PORT);

if (!shouldInstall) {
  console.log(
    '[postinstall] Pulando download do Chromium (local). Use npm run playwright:install ou PLAYWRIGHT_INSTALL_ON_POSTINSTALL=1.'
  );
  process.exit(0);
}

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'playwright-install.mjs');
const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
if (result.status !== 0) {
  console.warn(
    '[postinstall] Download do Chromium falhou ou foi interrompido; será tentado ao iniciar o servidor.'
  );
}
process.exit(0);
