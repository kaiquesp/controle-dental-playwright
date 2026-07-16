import fs from 'fs';
import path from 'path';
import type { Page, TestInfo } from '@playwright/test';

const SCREENSHOTS_DIR = path.resolve(__dirname, '../../screenshots');

export async function captureFailureScreenshot(
  page: Page,
  testInfo: TestInfo,
  label = 'failure'
): Promise<string> {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeTitle = testInfo.title.replace(/[^\w-]+/g, '_').slice(0, 80);
  const fileName = `${timestamp}-${safeTitle}-${label}.png`;
  const filePath = path.join(SCREENSHOTS_DIR, fileName);

  await page.screenshot({ path: filePath, fullPage: true, timeout: 10_000 }).catch(async () => {
    await page.screenshot({ path: filePath, fullPage: false, timeout: 5_000 });
  });
  await testInfo.attach(`screenshot-${label}`, {
    path: filePath,
    contentType: 'image/png',
  });

  return filePath;
}
