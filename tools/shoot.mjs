// Screenshots the local build. Serves the project root over HTTP first.
// Usage: node shoot.mjs <outDir> <width> <height> <slug=path>... [--scroll]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const full = !args.includes('--viewport');
const [outDir, width, height, ...pages] = args.filter((a) => !a.startsWith('--'));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.otf': 'font/otf' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root)) return res.writeHead(403).end();
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: 1 });
for (const spec of pages) {
  const [slug, p] = spec.split('=');
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`failed ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(`http://localhost:${port}${p}`, { waitUntil: 'load' });
  await page.waitForTimeout(3200);
  if (full) {
    // Scroll through the page so scroll-linked elements become visible.
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 300) { await page.mouse.wheel(0, 300); await page.waitForTimeout(40); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.addStyleTag({ content: '[data-anim]{opacity:1 !important}' });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(outDir, `${slug}-${width}.png`), fullPage: full });
  console.log(slug, errors.length ? errors : 'ok');
  await page.close();
}
await browser.close();
server.close();
