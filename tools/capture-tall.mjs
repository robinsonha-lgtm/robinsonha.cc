// Saves the Readymag widget data API response and a tall screenshot of each page,
// so the whole scrolling page is visible in one image.
// Usage: node capture-tall.mjs <baseUrl> <outDir> <width> <slug=path:height>...
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [baseUrl, outDir, width, ...pages] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
for (const spec of pages) {
  const [slug, rest] = spec.split('=');
  const [p, height] = rest.split(':');
  const context = await browser.newContext({ viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('response', async (r) => {
    if (r.url().includes('/api/viewer/project/') && r.url().endsWith('/widgets')) {
      try { fs.writeFileSync(path.join(outDir, '..', 'api', 'widgets.json'), await r.text()); } catch {}
    }
  });
  await page.goto(new URL(p, baseUrl).href, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(outDir, `${slug}-${width}.png`) });
  console.log(slug, 'done');
  await context.close();
}
await browser.close();
