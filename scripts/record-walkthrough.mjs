import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../walkthrough');
mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'https://nilan92.github.io/mazdabuddy';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const wait = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: false });

console.log('→ Landing page');
await page.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
await wait(2000);
await shot('01-landing');

console.log('→ Login');
await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' });
await wait(1500);
await shot('02-login');

await page.fill('#login-input', 'nilan');
await wait(500);
await page.fill('#password-input', 'nilan');
await wait(500);
await shot('03-login-filled');
await page.click('button[type="submit"]');
// After login, app navigates to /#/ (Dashboard is the root route)
await page.waitForURL((url) => !url.hash.includes('/login'), { timeout: 15000 });
await wait(3000);
await shot('04-dashboard');

console.log('→ Jobs board');
await page.goto(`${BASE}/#/jobs`, { waitUntil: 'networkidle' });
await wait(2500);
await shot('06-jobs-kanban');

// Try opening a job card
const firstCard = page.locator('[class*="card"], [class*="job"]').first();
if (await firstCard.count()) {
  await firstCard.click();
  await wait(2000);
  await shot('07-job-card-open');
  await page.keyboard.press('Escape');
  await wait(1000);
}

console.log('→ Customers');
await page.goto(`${BASE}/#/customers`, { waitUntil: 'networkidle' });
await wait(2000);
await shot('08-customers');

console.log('→ Inventory');
await page.goto(`${BASE}/#/inventory`, { waitUntil: 'networkidle' });
await wait(2000);
await shot('09-inventory');

console.log('→ Invoices');
await page.goto(`${BASE}/#/invoices`, { waitUntil: 'networkidle' });
await wait(2000);
await shot('10-invoices');

console.log('→ Finances');
await page.goto(`${BASE}/#/finances`, { waitUntil: 'networkidle' });
await wait(2000);
await shot('11-finances');

console.log('→ Settings');
await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' });
await wait(2000);
await shot('12-settings');

console.log('→ Smart Scan');
await page.goto(`${BASE}/#/scan`, { waitUntil: 'networkidle' });
await wait(2000);
await shot('13-smart-scan');

await wait(1000);
await ctx.close();
await browser.close();
console.log('Done. Files in:', OUT_DIR);
