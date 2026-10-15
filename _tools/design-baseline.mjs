// Design baseline: section heights, text sizes, carousels, tap targets, per width (EN). Output: out/design-baseline.json + console summary.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './serve.mjs';
import { OUT } from './verify/lib/common.mjs';

const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome' });
const result = {};
for (const w of [1280, 768, 375]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 800 : 900 }, reducedMotion: 'reduce' });
  await ctx.route(/googletagmanager|google-analytics/, (r) => r.abort());
  // STRIP_P1=1 measures the site without the phase 1 block of css/staff.css (section 17): the 'before' under the same method
  if (process.env.STRIP_P1) await ctx.route('**/css/staff.css', async (route) => { const resp = await route.fetch(); const body = (await resp.text()).split('/* 17. design pass')[0]; await route.fulfill({ response: resp, body }); });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.port}/?lang=en`, { waitUntil: 'load' });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#preloader')).display === 'none', null, { timeout: 15000 });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(600);
  result[w] = await page.evaluate(() => {
    const out = { total: document.documentElement.scrollHeight, sections: {}, small: {}, carousels: 0, carouselIds: [], tap: { total: 0, under44: 0, samples: [] }, sizes: {} };
    for (const id of ['intro', 'about', 'impact', 'resume', 'portfolio', 'cta', 'services', 'contact']) {
      const el = document.getElementById(id); if (el) out.sections[id] = Math.round(el.getBoundingClientRect().height);
    }
    const f = document.querySelector('footer'); if (f) out.sections.footer = Math.round(f.getBoundingClientRect().height);
    out.carousels = document.querySelectorAll('.owl-carousel').length;
    out.carouselIds = [...document.querySelectorAll('.owl-carousel')].map((c) => c.id || c.className.split(' ')[0]);
    // text nodes: font-size distribution of visible text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Map();
    let n;
    while ((n = walker.nextNode())) {
      const t = n.textContent.trim(); if (t.length < 2) continue;
      const el = n.parentElement; if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      if (el.closest('script,style,noscript,#preloader,.sr-only,.owl-item:not(.active)')) continue;
      const px = Math.round(parseFloat(cs.fontSize) * 10) / 10;
      out.sizes[px] = (out.sizes[px] || 0) + t.length; // weight by characters
      if (px < 14) {
        const key = (el.closest('[class]')?.className || el.tagName).toString().split(' ').slice(0, 2).join('.') + ' @' + px;
        seen.set(key, (seen.get(key) || 0) + t.length);
      }
    }
    out.small = Object.fromEntries([...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40));
    // tap targets (visible links/buttons)
    for (const el of document.querySelectorAll('a[href], button, [role="button"], summary')) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') continue;
      if (el.closest('.owl-item:not(.active)')) continue;
      out.tap.total++;
      if (r.height < 44 || r.width < 44) { out.tap.under44++; if (out.tap.samples.length < 8) out.tap.samples.push((el.className || el.tagName).toString().slice(0, 40) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
    }
    return out;
  });
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, 'design-baseline.json'), JSON.stringify(result, null, 1));
for (const [w, r] of Object.entries(result)) {
  console.log(`\n=== ${w}px  total=${r.total}  carousels=${r.carousels}`);
  console.log('sections', JSON.stringify(r.sections));
  console.log('font sizes (chars):', JSON.stringify(Object.fromEntries(Object.entries(r.sizes).sort((a, b) => a[0] - b[0]))));
  const totalChars = Object.values(r.sizes).reduce((a, b) => a + b, 0);
  const small = Object.entries(r.sizes).filter(([k]) => k < 14).reduce((a, [, v]) => a + v, 0);
  console.log(`text under 14px: ${Math.round((small / totalChars) * 100)}% of characters`);
  console.log('top small-text groups', JSON.stringify(r.small));
  console.log('tap targets', r.tap.under44 + '/' + r.tap.total + ' under 44px', JSON.stringify(r.tap.samples));
}
await browser.close(); await server.close?.(); process.exit(0);
