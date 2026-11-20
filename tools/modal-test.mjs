// Opens the Work page from a local server, clicks a pop-up link, and screenshots it.
// Usage: node modal-test.mjs <out.png> <width> <height>
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const [out, width, height] = process.argv.slice(2);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.otf': 'font/otf' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!p.startsWith(root) || !fs.existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/2/`, { waitUntil: 'load' });
await page.waitForTimeout(2800);
await page.click('a[data-modal] >> nth=1');
await page.waitForTimeout(2500);
const frame = page.frames().find((f) => f.url().includes('cca-impact-awards'));
console.log('dialog open:', await page.evaluate(() => document.querySelector('dialog.browser')?.open), 'frame:', frame?.url().replace(/^.*localhost:\d+/, ''), 'frame scrollY:', frame ? await frame.evaluate(() => Math.round(scrollY)) : null);
await page.screenshot({ path: out });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
console.log('after Escape open:', await page.evaluate(() => document.querySelector('dialog.browser').open), 'url:', page.url().replace(/^.*localhost:\d+/, ''), 'errors:', errors);
await browser.close();
server.close();
