import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../../controle-dental/assets/marketing/instagram');
const htmlPath = path.join(dir, 'post.html');
const outPath = path.join(dir, 'controle-dental-instagram-final.png');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: outPath, type: 'png' });
await browser.close();
console.log(`Saved: ${outPath}`);
