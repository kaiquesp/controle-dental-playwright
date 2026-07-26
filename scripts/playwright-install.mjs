#!/usr/bin/env node
import { PLAYWRIGHT_BROWSERS_PATH, runPlaywright } from './playwright-cli.mjs';

console.log(`Baixando Chromium para ${PLAYWRIGHT_BROWSERS_PATH}...`);
const result = runPlaywright(['install', 'chromium'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
