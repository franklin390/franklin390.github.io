// G16 — Design budgets: text size floors, touch targets, focus indicators, contrast margin, page-height budgets.
// Budgets come from the measured baseline (npm run measure:design) and only ever go down: a phase that shortens the page lowers them here.
import { Gate } from './lib/report.mjs';
import { getEnv } from './lib/browser.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { LANGS, ROOT } from './lib/common.mjs';

export const id = 'G16';

// total page height (px) per width and language; measured after phase 3 (the phone folds) and the positioning copy (longer About and Expertise text), + ~1.7% slack
const HEIGHT_BUDGET = {
  375: { en: 14400, pt: 14900, es: 14850 },
  1280: { en: 14900, pt: 15200, es: 15200 },
};
// share of visible characters set below 14px (uppercase labels and chips are kept between 11 and 13.5px on purpose)
const SMALL_SHARE_MAX = { 375: 0.20, 1280: 0.19 };
const MIN_TEXT_PX = 11;
// running text that must never drop below its floor, on any width
const READING_FLOORS = [
  ['.case-block', 14.5], ['.glance-result', 14], ['#about .about-content p', 14.5], ['#resume .role li', 14.5], ['#resume .role-tech', 14],
  ['.cert-card .cert-date', 14], ['.train-main', 14], ['#impact .stat-title', 14],
];
// controls that must be at least 44x44 (the 320-360px phones keep a 40px menu button so the name still fits)
const PRIMARY_44 = ['.lang-switch .lang-btn', '.menu-toggle', '.site-header .brand', '.intro-social li a', 'footer .footer-social li a', '.owl-buttons .owl-prev', '.owl-buttons .owl-next', '.link-chip', '.button', '.more-toggle'];
// links that sit inside a list or a sentence: the WCAG 2.2 inline exception applies, so only the 24px rule is skipped for them
const INLINE_EXEMPT = '.train-main a, footer .copyright a, .owl-page';

export async function run(ctx) {
  const g = new Gate('G16', 'Design budgets (legibility, touch targets, focus, contrast, page height)');
  const env = await getEnv(ctx);

  // design tokens: the brand colors live in :root only; every var(--x) the stylesheets use is defined
  {
    const css = ['css/main.css', 'css/staff.css'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    const rootBlock = (css.match(/:root\s*\{[^}]*\}/) || [''])[0];
    const outside = css.replace(rootBlock, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const literals = outside.match(/#(?:cc005f|ff0077|990047|b0004f|ff3d9a|ffc2dc)\b|rgba\((?:204, 0, 95|255, 0, 119),/gi) || [];
    const defined = new Set([...rootBlock.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...outside.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    const undefinedVars = [...used].filter((v) => !defined.has(v));
    g.check(defined.size >= 14 && literals.length === 0, `the brand colors are defined once as CSS variables (${defined.size} tokens in :root) and no stylesheet repeats them as a literal`, [...new Set(literals)].join(', '));
    g.check(undefinedVars.length === 0, `every CSS variable the stylesheets use is defined (${used.size} used)`, undefinedVars.join(', '));
  }

  for (const width of [375, 1280]) {
    for (const lang of LANGS) {
      const L = `${lang.toUpperCase()} ${width}px`;
      const s = await env.open(lang, { width });
      const p = s.page;
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });
      await p.waitForTimeout(400);

      const m = await p.evaluate(({ reading, primary, exempt }) => {
        const out = { height: document.documentElement.scrollHeight, chars: 0, small: 0, minPx: 99, minEl: '', reading: [], tiny: [], primary: [], undersized: [] };
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          const t = n.textContent.trim(); if (t.length < 2) continue;
          const el = n.parentElement; if (!el || el.closest('script,style,noscript,#preloader,.sr-only,[hidden]')) continue;
          const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
          if (el.closest('.owl-item:not(.active)')) continue;
          const px = parseFloat(cs.fontSize);
          if (!(px > 0) || /Font Awesome|icomoon|micons/i.test(cs.fontFamily)) continue;
          out.chars += t.length; if (px < 14) out.small += t.length;
          if (px < out.minPx) { out.minPx = px; out.minEl = (el.className || el.tagName) + ': ' + t.slice(0, 30); }
          if (px < 11) out.tiny.push(((el.className || el.tagName) + '').slice(0, 30) + ' @' + px.toFixed(1));
        }
        for (const [sel, floor] of reading) {
          for (const el of document.querySelectorAll(sel)) {
            const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
            if (cs.display === 'none' || r.width === 0 || el.closest('.owl-item:not(.active)')) continue;
            const px = parseFloat(cs.fontSize);
            if (px + 0.05 < floor) out.reading.push(`${sel} ${px.toFixed(1)}px < ${floor}`);
          }
        }
        const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('.owl-item:not(.active)'); };
        for (const sel of primary) {
          for (const el of document.querySelectorAll(sel)) {
            if (!vis(el)) continue;
            const r = el.getBoundingClientRect();
            out.primary.push({ sel, w: Math.round(r.width), h: Math.round(r.height) });
          }
        }
        for (const el of document.querySelectorAll('a[href], button, [role="button"], summary')) {
          if (!vis(el) || el.matches(exempt)) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 24 || r.height < 24) out.undersized.push(((el.className || el.tagName) + '').slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        }
        return out;
      }, { reading: READING_FLOORS, primary: PRIMARY_44, exempt: INLINE_EXEMPT });

      g.check(m.height <= HEIGHT_BUDGET[width][lang], `[${L}] page height ${m.height}px within the budget of ${HEIGHT_BUDGET[width][lang]}px`);
      const share = m.small / m.chars;
      g.check(share <= SMALL_SHARE_MAX[width], `[${L}] ${(share * 100).toFixed(1)}% of the text is set below 14px (budget ${(SMALL_SHARE_MAX[width] * 100).toFixed(0)}%)`);
      g.check(m.minPx >= MIN_TEXT_PX - 0.05, `[${L}] the smallest visible text is ${m.minPx.toFixed(1)}px (floor ${MIN_TEXT_PX}px)`, m.minEl);
      g.check(m.reading.length === 0, `[${L}] running text keeps its size floors`, [...new Set(m.reading)].slice(0, 6).join('\n'));
      const small44 = m.primary.filter((e) => {
        const need = (e.sel === '.menu-toggle' && width <= 360) ? 40 : 44;
        if (e.sel === '.button' || e.sel === '.link-chip') return e.h < need;
        if (e.sel === '.lang-switch .lang-btn') return e.h < need || e.w < (width <= 360 ? 38 : 44);
        return e.w < need || e.h < need;
      });
      g.check(small44.length === 0 && m.primary.length > 0, `[${L}] primary controls are at least 44px (${m.primary.length} checked)`, small44.slice(0, 6).map((e) => `${e.sel} ${e.w}x${e.h}`).join('\n'));
      g.check(m.undersized.length === 0, `[${L}] no interactive element smaller than 24x24px (WCAG 2.2 AA)`, m.undersized.slice(0, 6).join('\n'));
      await s.close();
    }
  }

  // one icon family in the case and certificate cards (the theme's line icons), and skill chips with a single look
  {
    const s = await env.open('en', { width: 1280 });
    const r = await s.page.evaluate(() => ({
      icons: [...document.querySelectorAll('.case-ico i, .cert-ico i')].map((i) => String(i.className)),
      borders: [...new Set([...document.querySelectorAll('.tags li')].map((li) => getComputedStyle(li).borderTopColor))],
    }));
    g.check(r.icons.length >= 20 && r.icons.every((c) => /^icon-[a-z-]+$/.test(c)), `[EN 1280px] the ${r.icons.length} icons of the case and certificate cards all belong to the theme's line family`, r.icons.filter((c) => !/^icon-[a-z-]+$/.test(c)).join(', '));
    g.check(r.borders.length === 1, '[EN 1280px] every skill chip has the same border (no highlighted chips)', r.borders.join(' | '));
    await s.close();
  }

  // header navigation links on wide screens are 44px tall too
  {
    const s = await env.open('en', { width: 1280 });
    const links = await s.page.evaluate(() => [...document.querySelectorAll('.main-navigation li a')].map((a) => Math.round(a.getBoundingClientRect().height)));
    g.check(links.length >= 7 && links.every((h) => h >= 44), `[EN 1280px] header navigation links are at least 44px tall (${links.join(' ')})`);
    await s.close();
  }

  // keyboard focus must be visible on every stop (outline of 2px or more, or a box-shadow ring)
  {
    const s = await env.open('en', { width: 1280 });
    const p = s.page;
    await p.evaluate(() => window.scrollTo(0, 0));
    const bad = [];
    let stops = 0;
    for (let i = 0; i < 140; i++) {
      await p.keyboard.press('Tab');
      const f = await p.evaluate(() => {
        const el = document.activeElement; if (!el || el === document.body) return null;
        const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return { skip: true };
        const ow = parseFloat(cs.outlineWidth) || 0;
        const ring = (cs.outlineStyle !== 'none' && ow >= 2) || (cs.boxShadow && cs.boxShadow !== 'none');
        return { ring: !!ring, name: (el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 2).join('.')).slice(0, 40) + ' ' + (el.getAttribute('href') || el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24) };
      });
      if (!f) break;
      if (f.skip) continue;
      stops++;
      if (!f.ring) bad.push(f.name);
    }
    g.check(stops >= 30, `[EN 1280px] the keyboard reaches ${stops} focus stops`);
    g.check(bad.length === 0, `[EN 1280px] every one of the ${stops} focus stops shows a clear focus ring`, [...new Set(bad)].slice(0, 8).join('\n'));
    await s.close();
  }

  // contrast with margin: 4.5:1 for normal text, 3:1 for large text, measured against the nearest solid background (gradients and photos are left to axe)
  for (const width of [375, 1280]) {
    const s = await env.open('en', { width });
    const p = s.page;
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });
    await p.waitForTimeout(300);
    const res = await p.evaluate(() => {
      const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a] = m[1].split(',').map((x) => parseFloat(x)); return { r, g, b, a: a === undefined ? 1 : a }; };
      const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
      const bgOf = (el) => {
        let e = el, layers = [];
        while (e && e !== document.documentElement) {
          const cs = getComputedStyle(e);
          if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
          const c = parse(cs.backgroundColor);
          if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break; }
          e = e.parentElement;
        }
        let base = { r: 255, g: 255, b: 255, a: 1 };
        for (const c of layers.reverse()) base = blend(c, base);
        return base;
      };
      const bad = [], low = []; let checked = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set(); let n;
      while ((n = walker.nextNode())) {
        const t = n.textContent.trim(); if (t.length < 2) continue;
        const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
        if (el.closest('script,style,noscript,#preloader,.sr-only,.owl-item:not(.active)')) continue;
        const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0 || parseFloat(cs.opacity) < 0.99) continue;
        if (/Font Awesome|icomoon|micons/i.test(cs.fontFamily)) continue;
        const bg = bgOf(el); if (!bg) continue;
        const fgc = parse(cs.color); if (!fgc || fgc.a === 0 || parseFloat(cs.fontSize) < 1) continue; // transparent text is a drawn icon (the menu bars), not text
        const fg = blend(fgc, bg);
        const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
        const large = px >= 24 || (px >= 18.66 && bold);
        const need = large ? 3 : 4.5;
        checked++;
        const tag = ((el.className || el.tagName) + '').toString().split(' ').slice(0, 2).join('.').slice(0, 34) + ' "' + t.slice(0, 18) + '" ' + ratio.toFixed(2);
        if (ratio < need) bad.push(tag);
        else if (ratio < need + 0.3) low.push(tag);
      }
      return { checked, bad, low };
    });
    g.check(res.bad.length === 0 && res.checked > 100, `[EN ${width}px] text contrast meets 4.5:1 (3:1 for large text) on ${res.checked} elements with a solid background`, res.bad.slice(0, 8).join('\n'));
    if (res.low.length) g.warn(`[EN ${width}px] ${res.low.length} text elements pass contrast by less than 0.3 (close to the limit)`, res.low.slice(0, 14).join('\n'));
    await s.close();
  }
  return g;
}
