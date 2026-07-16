import dotenv from 'dotenv';
import path from 'path';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(root, '..', '.env') });

const authFile = path.join(root, '..', 'playwright/.auth/user.json');
const baseURL = process.env.E2E_BASE_URL ?? 'https://app.controledental.com.br';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  baseURL,
  storageState: authFile,
  locale: 'pt-BR',
  viewport: { width: 1280, height: 720 },
});
const page = await ctx.newPage();

await page.goto('/agenda', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const skip = page.getByText('Pular tour', { exact: true });
if (await skip.isVisible().catch(() => false)) await skip.click();

for (const label of ['Agenda', 'Pacientes', 'Relatorios']) {
  const old = page.locator('app-sidebar a.side-nav__menu-item').filter({ hasText: label });
  const role = page.locator('app-sidebar').getByRole('link', { name: label, exact: true });
  const partial = page.locator('app-sidebar').getByRole('link', { name: label });
  console.log(label, {
    sideNavCount: await old.count(),
    roleExact: await role.count(),
    rolePartial: await partial.count(),
    appSidebar: await page.locator('app-sidebar').count(),
  });
}

await browser.close();
