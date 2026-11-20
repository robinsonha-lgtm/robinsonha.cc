// Captures reference material from a site: a full-page screenshot, the rendered
// DOM, the geometry of every Readymag widget, and the URLs the page requested.
// Usage: node capture.mjs <baseUrl> <outDir> <path>...
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [baseUrl, outDir, ...paths] = process.argv.slice(2);
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
];
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: !!vp.isMobile,
    hasTouch: !!vp.isMobile,
    userAgent: vp.isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  for (const p of paths) {
    const slug = p === '/' ? 'home' : p.replace(/\//g, '');
    const page = await context.newPage();
    const requests = [];
    page.on('request', (r) => requests.push(`${r.resourceType()} ${r.url()}`));
    await page.goto(new URL(p, baseUrl).href, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => {
      const doc = document.scrollingElement;
      const scrollers = [...document.querySelectorAll('*')]
        .filter((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY))
        .map((e) => ({ tag: e.tagName, cls: e.className, sh: e.scrollHeight, ch: e.clientHeight }));
      const widgets = [...document.querySelectorAll('.rmwidget')].map((w) => {
        const r = w.getBoundingClientRect();
        const cs = getComputedStyle(w);
        const t = w.querySelector('p, h1, h2, h3');
        const ts = t ? getComputedStyle(t.querySelector('span') || t) : null;
        return {
          id: w.dataset.id,
          cls: w.className,
          x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height),
          position: cs.position, zoom: cs.zoom, opacity: cs.opacity, transform: cs.transform,
          fixed: !!w.closest('.fixed-position-container, .fixed-position-container-top'),
          text: (w.innerText || '').slice(0, 200),
          font: ts ? `${ts.fontFamily} ${ts.fontWeight} ${ts.fontSize}/${ts.lineHeight} ls=${ts.letterSpacing} ${ts.color}` : null,
          img: [...w.querySelectorAll('img')].map((i) => i.currentSrc || i.src),
          video: [...w.querySelectorAll('video, iframe')].map((v) => v.currentSrc || v.src),
          bg: cs.backgroundColor,
        };
      });
      return { docHeight: doc.scrollHeight, innerWidth, innerHeight, scrollers, widgets };
    });
    fs.writeFileSync(path.join(outDir, `${slug}-${vp.name}.json`), JSON.stringify(info, null, 1));
    fs.writeFileSync(path.join(outDir, `${slug}-${vp.name}.html`), await page.content());
    fs.writeFileSync(path.join(outDir, `${slug}-${vp.name}-requests.txt`), [...new Set(requests)].join('\n'));
    await page.screenshot({ path: path.join(outDir, `${slug}-${vp.name}.png`), fullPage: true });
    console.log(slug, vp.name, 'docHeight', info.docHeight, 'widgets', info.widgets.length, 'scrollers', JSON.stringify(info.scrollers));
    await page.close();
  }
  await context.close();
}
await browser.close();
