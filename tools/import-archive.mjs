// Copies a browser-saved page ("Page.html" plus its "Page_files" folder) into the
// site as a static archive. Removes every script and hidden tracking frame, and
// copies only the stylesheets and images the page uses.
// Usage: node import-archive.mjs <saved.html> <site folder name> <original url>
import fs from 'node:fs';
import path from 'node:path';

const [source, folder, originalUrl] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, folder);
const filesDir = path.join(path.dirname(source), `${path.basename(source, '.html')}_files`);
const prefix = `./${path.basename(filesDir)}/`;

let html = fs.readFileSync(source, 'utf8');
html = html
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
  .replace(/<iframe\b[^>]*display:\s*none[^>]*>[\s\S]*?<\/iframe>/gi, '');

fs.mkdirSync(path.join(outDir, 'files'), { recursive: true });
const keep = new Set(['.css', '.jpg', '.jpeg', '.png', '.svg', '.gif', '.webp']);
html = html.split(prefix).map((part, i) => {
  if (i === 0) return part;
  const name = /^[^"')\s>]+/.exec(part)[0];
  if (keep.has(path.extname(name).toLowerCase())) {
    fs.copyFileSync(path.join(filesDir, decodeURIComponent(name)), path.join(outDir, 'files', decodeURIComponent(name)));
  }
  return `files/${part}`;
}).join('');

html = html.replace(/<head>/i, `<head>\n<meta name="robots" content="noindex">\n<link rel="canonical" href="${originalUrl}">`);
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('wrote', path.join(folder, 'index.html'), fs.readdirSync(path.join(outDir, 'files')).length, 'files');
