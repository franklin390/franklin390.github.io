// G8 — Accessibility (axe-core, EN/PT/ES, desktop and mobile) and SEO metadata.
import fs from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { Gate } from './lib/report.mjs';
import { ROOT, LANGS } from './lib/common.mjs';
import { loadBoth } from './lib/dict.mjs';
import { getEnv } from './lib/browser.mjs';

export const id = 'G8';

export async function run(ctx) {
  const g = new Gate('G8', 'Accessibility (axe) & SEO');
  const env = await getEnv(ctx);
  const dict = loadBoth();

  for (const lang of LANGS) for (const width of [1280, 375]) {
    const s = await env.open(lang, { width });
    const res = await new AxeBuilder({ page: s.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const hard = res.violations.filter((v) => ['critical', 'serious'].includes(v.impact));
    const soft = res.violations.filter((v) => !['critical', 'serious'].includes(v.impact));
    g.check(hard.length === 0, `[${lang.toUpperCase()} ${width}px] axe: no serious/critical violations (${res.passes.length} rules passed)`,
      hard.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}\n    e.g. ${v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' → ' + (n.any[0]?.message || '').slice(0, 90)).join('\n         ')}`).join('\n'));
    // heading levels never skip (an eyebrow label or a stat caption written as <h5> under an <h2>/<h3> would): a real check, not a warning
    const order = res.violations.find((v) => v.id === 'heading-order');
    g.check(!order, `[${lang.toUpperCase()} ${width}px] heading levels only increase by one (labels that are not headings are <p>)`, order ? order.nodes.slice(0, 4).map((n) => n.target.join(' ')).join('\n') : '');
    const rest = soft.filter((v) => v.id !== 'heading-order');
    if (rest.length) g.warn(`[${lang.toUpperCase()} ${width}px] axe: ${rest.length} moderate/minor issue(s)`, rest.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`).join('\n'));
    await s.close();
  }

  // SEO metadata
  for (const lang of LANGS) {
    const d = dict[lang];
    g.check(d['meta.title'].length <= 60, `[${lang.toUpperCase()}] title ≤ 60 chars (${d['meta.title'].length})`);
    g.check(d['meta.description'].length >= 70 && d['meta.description'].length <= 160, `[${lang.toUpperCase()}] meta description 70–160 chars (${d['meta.description'].length})`);
  }
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const og = html.match(/property="og:image" content="https:\/\/franklin390\.github\.io\/([^"]+)"/);
  g.check(!!og && fs.existsSync(path.join(ROOT, og[1])), 'og:image points to an existing file in the repo', og ? og[1] : 'no og:image');
  g.check(fs.existsSync(path.join(ROOT, 'robots.txt')), 'robots.txt exists');
  g.check(fs.existsSync(path.join(ROOT, 'favicon.png')), 'favicon exists');
  // one <h1> (the name) per page and language; the section titles are <h2>; no empty headings
  for (const lang of LANGS) {
    const s = await env.open(lang);
    const heads = await s.page.evaluate(() => ({
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
      h2: [...document.querySelectorAll('.section-intro h2')].map((h) => h.textContent.trim()),
      empty: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => !h.textContent.trim()).length,
    }));
    g.check(heads.h1.length === 1 && /Franklin Ferreira/.test(heads.h1[0]), `[${lang.toUpperCase()}] exactly one <h1> and it carries the name (${JSON.stringify(heads.h1)})`);
    g.check(heads.h2.length === 6 && heads.empty === 0, `[${lang.toUpperCase()}] the 6 section titles are <h2> and no heading is empty`, JSON.stringify(heads));
    await s.close();
  }

  // weight: what a phone downloads before the page is usable, and the single biggest images (Core Web Vitals / ranking)
  {
    const images = [];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(jpe?g|png|webp)$/i.test(e.name)) images.push([path.relative(ROOT, p).split(path.sep).join('/'), fs.statSync(p).size]); } };
    walk(path.join(ROOT, 'images'));
    const heavy = images.filter(([f, n]) => n > (f === 'images/og-card.png' ? 300 : 250) * 1024);
    g.check(heavy.length === 0, `no image is heavier than 250 KB (the social card 300 KB): ${images.length} checked`, heavy.map(([f, n]) => `${f} ${Math.round(n / 1024)} KB`).join(', '));
    const context = await env.browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.route(/googletagmanager|google-analytics/, (r) => r.abort());
    const page = await context.newPage();
    let bytes = 0;
    page.on('response', async (r) => { try { bytes += (await r.body()).length; } catch (e) { /* aborted */ } });
    await page.goto(env.base + '/?lang=en', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await context.close();
    const kb = Math.round(bytes / 1024);
    g.check(kb <= 1400, `first load on a phone downloads ${kb} KB (budget 1400 KB; it was 2240 KB before the images and icon CSS were slimmed)`);
  }
  return g;
}
