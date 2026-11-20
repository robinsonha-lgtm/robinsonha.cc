// Clicks the first pop-up link on a live page and reports whether the dialog opened.
// Usage: node live-check.mjs <url>
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: false });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
await page.goto(process.argv[2], { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.click('a[data-modal] >> nth=1');
await page.waitForTimeout(2500);
console.log('url after click:', page.url());
console.log('dialog open:', await page.evaluate(() => document.querySelector('dialog.browser')?.open ?? null));
console.log('errors:', errors);
await browser.close();
