// Pixel snapshots of every section, per width and language, and a pixel-exact comparison of two snapshots.
// Usage: node pixel-snap.mjs <tag>                 -> writes out/pixel/<tag>/<lang>-<width>-<section>.png
//        node pixel-snap.mjs --diff <tagA> <tagB> [tolerance]  -> compares them with pixelmatch (threshold 0). Up to <tolerance> differing pixels per image (default 0) are reported but accepted:
//        the same page photographed twice can differ by a pixel or two in an animated carousel
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { startServer } from './serve.mjs';
import { OUT } from './verify/lib/common.mjs';

const SECTIONS = ['intro', 'about', 'impact', 'resume', 'portfolio', 'cta', 'services', 'contact'];
const WIDTHS = [1280, 768, 375];
const LANGS = ['en', 'pt', 'es'];

if (process.argv[2] === '--diff') {
  const [a, b] = [path.join(OUT, 'pixel', process.argv[3]), path.join(OUT, 'pixel', process.argv[4])];
  const tol = Number(process.argv[5] || 0);
  let bad = 0, total = 0, noise = 0;
  for (const f of fs.readdirSync(a).filter((x) => x.endsWith('.png'))) {
    total++;
    if (!fs.existsSync(path.join(b, f))) { console.log('missing', f); bad++; continue; }
    const A = PNG.sync.read(fs.readFileSync(path.join(a, f))), B = PNG.sync.read(fs.readFileSync(path.join(b, f)));
    if (A.width !== B.width || A.height !== B.height) { console.log(`${f}: size ${A.width}x${A.height} -> ${B.width}x${B.height}`); bad++; continue; }
    const n = pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0 });
    if (n > tol) { console.log(`${f}: ${n} pixel(s) differ`); bad++; }
    else if (n) { console.log(`${f}: ${n} pixel(s) differ (within the tolerance of ${tol})`); noise++; }
  }
  console.log(bad ? `${bad} of ${total} image(s) differ` : `identical: ${total} images compared${noise ? `, ${noise} with a pixel or two of noise` : ', 0 pixels differ'}`);
  process.exit(bad ? 1 : 0);
}

const tag = process.argv[2];
if (!tag) { console.error('usage: node pixel-snap.mjs <tag> | --diff <tagA> <tagB>'); process.exit(2); }
const dir = path.join(OUT, 'pixel', tag);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome' });
for (const width of WIDTHS) for (const lang of LANGS) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 800 : 900 }, reducedMotion: 'reduce' });
  await ctx.route(/googletagmanager|google-analytics/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.port}/?lang=${lang}`, { waitUntil: 'load' });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#preloader')).display === 'none', null, { timeout: 20000 });
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; } .site-header, #go-top { visibility: hidden !important; }' });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(900);
  for (const id of SECTIONS) {
    await page.locator('#' + id).screenshot({ path: path.join(dir, `${lang}-${width}-${id}.png`) });
  }
  await page.locator('footer').screenshot({ path: path.join(dir, `${lang}-${width}-footer.png`) });
  await ctx.close();
}
await browser.close(); await server.close?.();
console.log(`pixel snapshot "${tag}": ${fs.readdirSync(dir).length} images in ${dir}`);
process.exit(0);
