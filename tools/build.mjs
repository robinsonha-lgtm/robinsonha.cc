// Builds the static site from the widget data saved in reference/api and the
// text markup saved in reference/snippets. Downloads images, posters, and videos
// into assets/ when they are missing, then writes one index.html per page.
// Usage: node build.mjs   (run from tools/)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ref = path.join(root, 'reference');
const VIDEO_HOST = 'https://v-p.rmcdn1.net/';
const DESIGN_WIDTH = 1024;

const pages = [
  { slug: 'home', dir: '', snippet: 'page1', title: 'Robinson Ha', height: 1059 },
  { slug: '2', dir: '2', snippet: 'page2', title: 'Robinson Ha — Work', height: 911 },
  { slug: '3', dir: '3', snippet: 'page3', title: 'Robinson Ha — New Media', height: 2604 },
  { slug: '4', dir: '4', snippet: 'page4', title: 'Robinson Ha — animations', height: 1734 },
  { slug: '5', dir: '5', snippet: 'page5', title: 'Robinson Ha — About', height: 1569 },
  { slug: '6', dir: '6', snippet: 'page6', title: 'Robinson Ha — Work', height: 911 },
];

const fontNames = { custom_119803: 'rh-serif', custom_119811: 'rh-sans', custom_119815: 'rh-text' };
const linkClasses = {
  'link-1': 'link-nav',
  'link-style-ad6d2391-1502-46b0-9322-d0fb55eb76cc': 'link-underline',
  'link-style-d6bcd7ff-6812-40b9-84cd-998823ab526f': 'link-blue',
};

// Text widgets that link as a whole to a page inside this site.
const linkOverrides = {
  '66c39800164a3bf8bab1cbf3': 'cca-impact-awards/#purpose-project--little-spark',
  '66c3973d0261b81b4ca160f3': 'cca-impact-awards/#purpose-project--little-spark',
  '66c3974f58a1603f1d108897': 'cca-impact-awards/#purpose-project--little-spark',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const num = (n) => String(Math.round(n * 100) / 100);

async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log('downloaded', path.relative(root, file));
}

function fetchVideo(playlistUrl, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', playlistUrl, '-c', 'copy', '-bsf:a', 'aac_adtstoasc', '-movflags', '+faststart', file]);
  console.log('converted', path.relative(root, file));
}

// Shrinks an image when it is far larger than its largest display size.
function shrink(file, designWidth) {
  const target = Math.ceil(designWidth * 4);
  const out = execFileSync('sips', ['-g', 'pixelWidth', file]).toString();
  const width = Number(/pixelWidth: (\d+)/.exec(out)?.[1]);
  if (width > target * 1.25) execFileSync('sips', ['--resampleWidth', String(target), file], { stdio: 'ignore' });
}

// Reads the text markup for every text widget out of a saved Readymag snippet
// and returns clean HTML keyed by widget id.
async function extractText(browserPage, snippetFile) {
  await browserPage.setContent(fs.readFileSync(snippetFile, 'utf8'));
  return browserPage.evaluate(() => {
    const keep = ['line-height', 'font-family', 'font-weight', 'font-size', 'font-style', 'color', 'letter-spacing', 'text-shadow', 'text-decoration', 'text-align', 'padding-right', 'padding-bottom'];
    const styleOf = (el) => keep.map((k) => [k, el.style.getPropertyValue(k)]).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(';');
    const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const walk = (node) => {
      if (node.nodeType === 3) return escText(node.textContent);
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();
      const inner = [...node.childNodes].map(walk).join('');
      if (tag === 'br') return '<br>';
      if (tag === 'a' && !node.getAttribute('href')) return inner;
      if (tag === 'a') {
        const cls = [...node.classList].find((c) => c.startsWith('link-')) || '';
        return `<a data-link="${cls}" data-href="${node.getAttribute('href').replace(/"/g, '&quot;')}" data-target="${node.getAttribute('target') || ''}">${inner}</a>`;
      }
      const style = styleOf(node);
      if (tag === 'p') {
        const align = [...node.classList].find((c) => c.startsWith('align-'));
        const s = [style, align ? `text-align:${align.slice(6)}` : ''].filter(Boolean).join(';');
        return `<p style="${s}">${inner}</p>`;
      }
      if (tag === 'span') return style ? `<span style="${style}">${inner}</span>` : inner;
      return inner;
    };
    const out = {};
    for (const w of document.querySelectorAll('.rmwidget[data-id]')) {
      const viewer = w.querySelector('.text-viewer');
      if (!viewer) continue;
      out[w.dataset.id] = { html: [...viewer.childNodes].map(walk).join(''), text: viewer.innerText.trim() };
    }
    return out;
  });
}

// Converts Readymag link targets and pixel sizes in extracted text markup.
function finishText(html, page, prefix) {
  return html
    .replace(/<a data-link="([^"]*)" data-href="([^"]*)" data-target="([^"]*)">/g, (_, cls, href, target) => {
      let url = href.replace(/&amp;/g, '&');
      let current = false;
      const internal = /^\/4835410\/([^/]+)\/$/.exec(url);
      if (internal) {
        const dir = internal[1] === 'main' ? '' : internal[1];
        current = dir === page.dir;
        url = prefix + (dir ? `${dir}/` : '');
      }
      const attrs = [`href="${esc(url)}"`, `class="${linkClasses[cls] || 'link-nav'}${current ? ' current' : ''}"`];
      if (target === '_blank') attrs.push('target="_blank"', 'rel="noopener noreferrer"');
      if (current) attrs.push('aria-current="page"');
      return `<a ${attrs.join(' ')}>`;
    })
    .replace(/style="([^"]*)"/g, (_, style) => {
      const s = style
        .replace(/custom_\d+/g, (f) => fontNames[f] || f)
        .replace(/(-?\d+(?:\.\d+)?)px/g, (m, n) => (Number(n) === 0 ? '0' : `calc(${n} * var(--u))`));
      return `style="${s}"`;
    });
}

function animationAttrs(w) {
  const a = (w.animation || [])[0];
  if (!a) return '';
  const step = a.steps[0];
  if (a.type === 'scroll') return ' data-anim="scroll"';
  return ` data-anim="load" style="--dur:${step.duration}s"`;
}

function box(w, extra = '') {
  return `--x:${num(w.x)};--y:${num(w.y)};--w:${num(w.w)};--h:${num(w.h)};z-index:${w.z}${extra}`;
}

// Merges the animation style attribute with the geometry style attribute.
function open(tag, cls, w, extraStyle = '', extraAttrs = '') {
  const a = (w.animation || [])[0];
  let style = box(w, extraStyle);
  let anim = '';
  if (a) {
    anim = ` data-anim="${a.type === 'scroll' ? 'scroll' : 'load'}"`;
    if (a.type !== 'scroll') style += `;--dur:${a.steps[0].duration}s`;
  }
  return `<${tag} class="${cls}" style="${style}"${anim}${extraAttrs}>`;
}

const playIcon = '<svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="25" fill="none" stroke="#fff" stroke-width="3"/><path d="M22 17l19 11-19 11z" fill="#fff"/></svg>';

async function renderWidget(w, page, prefix, texts) {
  if (w.type === 'text') {
    const t = texts[w._id];
    if (!t || !t.text) return '';
    let html = finishText(t.html, page, prefix);
    if (linkOverrides[w._id]) {
      html = html
        .replace(/<\/?a\b[^>]*>/g, '')
        .replace(/<p([^>]*)>([\s\S]*?)<\/p>/g, `<p$1><a class="link-nav" href="${prefix}${linkOverrides[w._id]}">$2</a></p>`);
    }
    return `${open('div', 'w text', w)}${html}</div>`;
  }
  if (w.type === 'shape') {
    if (w.tp === 'line') return `${open('div', `w line line-${w.stroke}`, w, `;--weight:${w.weight};color:#${w.color}`, ' role="presentation"')}</div>`;
    return `${open('div', 'w rect', w, `;background:#${w.bg_color}`, ' role="presentation"')}</div>`;
  }
  if (w.type === 'picture') {
    const name = path.basename(new URL(w.picture.url).pathname);
    const file = path.join(root, 'assets', 'images', name);
    if (!fs.existsSync(file)) {
      await download(w.picture.url, file);
      shrink(file, w.w);
    }
    const posX = w.originalW > w.cropW ? (w.cropX / (w.originalW - w.cropW)) * 100 : 50;
    const posY = w.originalH > w.cropH ? (w.cropY / (w.originalH - w.cropH)) * 100 : 50;
    return `${open('div', 'w picture', w)}<img src="${prefix}assets/images/${name}" alt="" loading="lazy" style="object-position:${num(posX)}% ${num(posY)}%"></div>`;
  }
  if (w.type === 'video') {
    if (w.provider_name === 'YouTube') {
      const id = /youtu\.be\/([\w-]+)/.exec(w.url)[1];
      return `${open('div', 'w video', w)}<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    const key = w.url.split('/')[2];
    const base = path.basename(w.file_meta.fileName, path.extname(w.file_meta.fileName)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const name = `${base}-${key.slice(-6)}`;
    fetchVideo(VIDEO_HOST + w.url, path.join(root, 'assets', 'videos', `${name}.mp4`));
    await download(VIDEO_HOST + w.thumbnail_url, path.join(root, 'assets', 'videos', `${name}.jpg`));
    const attrs = ['playsinline', 'preload="metadata"', `poster="${prefix}assets/videos/${name}.jpg"`];
    if (w.autoplay) attrs.push('autoplay');
    if (w.mute) attrs.push('muted');
    if (w.loop) attrs.push('loop');
    return `${open('div', 'w video', w)}<video ${attrs.join(' ')} src="${prefix}assets/videos/${name}.mp4"></video><button type="button" class="play" aria-label="Play video">${playIcon}</button></div>`;
  }
  return '';
}

const browser = await chromium.launch();
const browserPage = await browser.newPage({ viewport: { width: DESIGN_WIDTH, height: 900 } });

await download('https://c-p.rmcdn.net/6669341c860bfd006233851f/Favicon-806d2b58-1801-403b-a696-2b96126be926_144.png', path.join(root, 'assets', 'favicon.png'));
await download('https://c-p.rmcdn.net/6669341c860bfd006233851f/4835410/Screenshot-7be1c7c5-30cf-4714-9c7e-7e679f4ced61_readyscr_1024.jpg', path.join(root, 'assets', 'share.jpg'));

const globalWidgets = JSON.parse(fs.readFileSync(path.join(ref, 'api', 'widgets-home.json'), 'utf8')).filter((w) => w.is_global);
for (const page of pages) {
  const prefix = page.dir ? '../' : './';
  const widgets = JSON.parse(fs.readFileSync(path.join(ref, 'api', `widgets-${page.slug}.json`), 'utf8'));
  // Header widgets are shared by every page but only the home page data lists them.
  if (page.slug !== 'home') widgets.push(...globalWidgets);
  const texts = await extractText(browserPage, path.join(ref, 'snippets', `${page.snippet}.html`));
  const bg = widgets.find((w) => w.type === 'background');
  const header = [];
  const body = [];
  for (const w of widgets.filter((x) => x.type !== 'background').sort((a, b) => a.y - b.y || a.x - b.x)) {
    const html = await renderWidget(w, page, prefix, texts);
    if (!html) continue;
    if (w.fixed_position) {
      const t = texts[w._id];
      const side = w.fixed_position === 'ne' ? `right:calc(${num(w.x)} * var(--u))` : `left:calc(${num(w.x)} * var(--u))`;
      header.push({ x: w.fixed_position === 'ne' ? DESIGN_WIDTH - w.x - w.w : w.x, html: `<div class="fixed text" style="${side};top:calc(${num(w.y)} * var(--u));z-index:${w.z}">${finishText(t.html, page, prefix)}</div>` });
    } else body.push(html);
  }
  header.sort((a, b) => a.x - b.x);
  const url = `https://robinsonha.cc/${page.dir ? `${page.dir}/` : ''}`;
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="Robinson's Portfolio">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Robinson Ha">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="Robinson's Portfolio">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://robinsonha.cc/assets/share.jpg">
<link rel="canonical" href="${url}">
<link rel="icon" href="${prefix}assets/favicon.png">
<link rel="stylesheet" href="${prefix}assets/site.css">
<script src="${prefix}assets/site.js" defer></script>
</head>
<body style="background:#${bg?.color || '080f0f'}">
<header>
<nav aria-label="Main">
${header.map((h) => h.html).join('\n')}
</nav>
</header>
<main class="page" style="--page-h:${page.height}">
${body.join('\n')}
</main>
</body>
</html>
`;
  const outDir = path.join(root, page.dir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), doc);
  console.log('wrote', path.join(page.dir, 'index.html'), 'widgets', body.length);
}
await browser.close();
