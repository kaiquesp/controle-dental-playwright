import dotenv from 'dotenv';
import path from 'path';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(root, '..', '.env') });

const authFile = path.join(root, '..', 'playwright/.auth/user.json');
const baseURL = process.env.E2E_BASE_URL ?? 'https://app.controledental.com.br';

async function dump(page, route) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const skip = page.getByText('Pular tour', { exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();

  const data = await page.evaluate(() => {
    const sidebarLinks = [...document.querySelectorAll('app-sidebar a, app-sidebar [role="link"]')].map((el) => ({
      tag: el.tagName,
      class: el.className,
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      href: el.getAttribute('href'),
    }));
    const financeNav = [...document.querySelectorAll(
      'nav[aria-label="Seções do financeiro"] a, .financeiro__tabs a, [class*="financeiro"] nav a'
    )].map((el) => ({
      class: el.className,
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      href: el.getAttribute('href'),
    }));
    return { sidebarLinks, financeNav, url: location.href };
  });
  console.log('\n===', route, '===');
  console.log(JSON.stringify(data, null, 2));
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ baseURL, storageState: authFile });
const page = await ctx.newPage();
await dump(page, '/agenda');
await dump(page, '/financeiro');
await browser.close();
