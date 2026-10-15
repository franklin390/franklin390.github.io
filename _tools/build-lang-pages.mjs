// Builds the static language pages pt/index.html and es/index.html (and sitemap.xml) so Google can index PT and ES as real URLs.
//
// How: the REAL language engine (js/i18n.js + the dictionaries) is run in Chrome on index.html, the translated DOM is saved
// as HTML, and the few things that depend on the address are fixed (relative URLs now start with ../, canonical, og:url,
// JSON-LD url, <html data-page-lang>). No other script runs, so the file is exactly the page as the engine would show it.
// In the browser the same engine runs again on load and finds the text already in place.
//
// Usage: node build-lang-pages.mjs            write pt/index.html, es/index.html, sitemap.xml
//        node build-lang-pages.mjs --check    exit code 1 if any of them is out of date
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { startServer } from './serve.mjs';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.resolve(TOOLS, '..');
export const seo = JSON.parse(fs.readFileSync(path.join(TOOLS, 'facts/seo.json'), 'utf8'));
export const urlOf = (page) => seo.origin + page.path;

/** Renders one language version (a page of seo.json other than English) as static HTML. */
export async function renderPage(browser, base, page) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // only the document and the language engine run: no stylesheet, image, plugin, GTM or analytics is needed to build the text
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    const ok = u.hostname === '127.0.0.1' && ((route.request().resourceType() === 'document' && u.pathname === '/') || u.pathname === '/js/i18n.js' || /^\/js\/i18n\/(en|pt|es)\.js$/.test(u.pathname));
    return ok ? route.continue() : route.abort();
  });
  const tab = await context.newPage();
  await tab.goto(`${base}/?lang=${page.lang}`, { waitUntil: 'domcontentloaded' });
  await tab.evaluate(({ lang, url }) => {
    const root = document.documentElement;
    root.setAttribute('data-page-lang', lang);
    // the page now lives one folder down: every relative URL starts with ../ (the language engine re-applies data-href-* on load)
    const relative = (v) => !!v && !/^([a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(v);
    for (const el of document.querySelectorAll('[src],[href],[data-href-en],[data-href-pt],[data-href-es]')) {
      for (const a of ['src', 'href', 'data-href-en', 'data-href-pt', 'data-href-es']) {
        const v = el.getAttribute(a);
        if (relative(v)) el.setAttribute(a, '../' + v);
      }
    }
    document.querySelector('link[rel="canonical"]').setAttribute('href', url);
    document.querySelector('meta[property="og:url"]').setAttribute('content', url);
    const ld = document.querySelector('script[type="application/ld+json"]');
    ld.textContent = ld.textContent.replace(/("url": ")[^"]*(")/, `$1${url}$2`);
  }, { lang: page.lang, url: urlOf(page) });
  const html = await tab.content();
  await context.close();
  return html.replace(/\r\n/g, '\n').replace(/^<!DOCTYPE html>\s*/i, '<!DOCTYPE html>\n').replace(/\n*$/, '\n');
}

export function sitemap() {
  const alternates = [...seo.pages.map((p) => ({ hreflang: p.hreflang, href: urlOf(p) })), { hreflang: 'x-default', href: seo.origin + seo.xDefault }];
  const links = alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`).join('\n');
  const urls = seo.pages.map((p) => `  <url>\n    <loc>${urlOf(p)}</loc>\n${links}\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

/** { relative file -> content } for every generated file */
export async function generateAll(browser, base) {
  const out = {};
  for (const page of seo.pages.filter((p) => p.lang !== 'en')) out[page.file] = await renderPage(browser, base, page);
  out['sitemap.xml'] = sitemap();
  return out;
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome' });
  const files = await generateAll(browser, `http://127.0.0.1:${server.port}`);
  await browser.close();
  server.close();
  let stale = 0;
  for (const [file, content] of Object.entries(files)) {
    const dest = path.join(ROOT, file);
    const have = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8').replace(/\r\n/g, '\n') : null;
    if (process.argv.includes('--check')) { if (have !== content) { stale++; console.log(`out of date: ${file}`); } continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    console.log(`${file} written (${(content.length / 1024).toFixed(0)} KB)${have === content ? ' - unchanged' : ''}`);
  }
  if (process.argv.includes('--check')) { console.log(stale ? 'run: node build-lang-pages.mjs' : 'language pages and sitemap are current'); process.exit(stale ? 1 : 0); }
}
