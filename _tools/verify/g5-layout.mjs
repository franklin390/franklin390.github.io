// G5 — Layout: PT/ES vs EN section-height expansion, clipped text, page weight.
import { Gate } from './lib/report.mjs';
import { getEnv } from './lib/browser.mjs';
import { LANGS } from './lib/common.mjs';

export const id = 'G5';
const SECTIONS = ['intro', 'about', 'impact', 'resume', 'portfolio', 'cta', 'services', 'contact'];

export async function run(ctx) {
  const g = new Gate('G5', 'Layout (EN vs PT/ES expansion, clipping, weight)');
  const env = await getEnv(ctx);

  for (const width of [375, 768, 1280, 1920]) {
    const heights = {};
    for (const lang of LANGS) {
      const s = await env.open(lang, { width });
      heights[lang] = await s.page.evaluate((ids) => Object.fromEntries(ids.map((i) => [i, Math.round(document.getElementById(i).getBoundingClientRect().height)])), SECTIONS);
      const clipped = await s.page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('.case-card, .cert-card, .stat, .service, .timeline-block, .tags li, .button, .lang-btn, h1, h2, h3, h4')) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none') continue;
          if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 2) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}: ${(el.textContent || '').trim().slice(0, 30)}`);
          if ((cs.overflow === 'hidden' || cs.overflowY === 'hidden') && el.scrollHeight > el.clientHeight + 2) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} (vertical)`);
        }
        return out;
      });
      g.check(clipped.length === 0, `[${lang.toUpperCase()} ${width}px] no clipped text in cards/buttons/headings`, clipped.slice(0, 6).join('\n'));
      // certification cards: identical size (all 8, also the ones off-screen) and nothing clipped inside
      await s.page.waitForTimeout(400);
      const cards = await s.page.evaluate(() => [...document.querySelectorAll('#owl-slider-cert .cert-card')].map((c) => ({ h: Math.round(c.getBoundingClientRect().height), w: Math.round(c.getBoundingClientRect().width), over: c.scrollHeight > c.clientHeight + 1 })));
      const hs = cards.map((c) => c.h), ws = cards.map((c) => c.w);
      g.check(cards.length === 8 && Math.max(...hs) - Math.min(...hs) <= 1 && Math.max(...ws) - Math.min(...ws) <= 1 && cards.every((c) => !c.over),
        `[${lang.toUpperCase()} ${width}px] all 8 certification cards have the same size and no overflow (${Math.min(...hs)}–${Math.max(...hs)}px high)`, JSON.stringify(cards));
      await s.close();
    }
    for (const other of LANGS.filter((l) => l !== 'en')) {
      const U = other.toUpperCase();
      const deltas = SECTIONS.map((i) => [i, heights[other][i] / heights.en[i]]);
      const bad = deltas.filter(([, r]) => r > 1.3 || r < 0.85);
      if (bad.length) g.warn(`[${width}px] sections whose height differs > 30% between ${U} and EN`, bad.map(([i, r]) => `${i}: ${r.toFixed(2)} (EN ${heights.en[i]}px, ${U} ${heights[other][i]}px)`).join('\n'));
      else g.pass(`[${width}px] ${U}/EN section heights within ±30% (max ${Math.max(...deltas.map((d) => d[1])).toFixed(2)}x)`);
    }
  }

  // page weight on first load (EN, desktop)
  {
    const context = await env.browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route(/googletagmanager|google-analytics/, (r) => r.abort());
    const page = await context.newPage();
    let bytes = 0; let count = 0;
    page.on('response', async (r) => { try { bytes += (await r.body()).length; count++; } catch (e) { /* aborted */ } });
    await page.goto(env.base + '/?lang=en', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const mb = bytes / 1024 / 1024;
    g.check(mb < 6, `first-load weight ${mb.toFixed(2)} MB in ${count} requests (< 6 MB)`);
    await context.close();
  }
  return g;
}
