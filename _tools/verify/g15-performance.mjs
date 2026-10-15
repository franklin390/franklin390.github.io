// G15 — Performance: what a phone on Slow 4G has to download and wait for, and the habits that keep it that way.
//  - static: no script blocks the first paint, no @import chain, the fonts are small woff2 subsets that cover the site's characters and icons,
//    third-party code (GTM) waits for the page to load, the preloader has a safety net
//  - dynamic: the decorative background is only fetched near the section, a stuck download cannot keep the cover on for ever,
//    carousels are as tall as their slide (measured after the fonts are in, not before)
//  - lab numbers (perf.mjs: 390px phone, Slow 4G, CPU 4x, HTTP/2 + gzip like GitHub Pages): bytes by type with budgets,
//    and generous time budgets (they only catch regressions; real timings vary from run to run)
import fs from 'node:fs';
import path from 'node:path';
import { Gate } from './lib/report.mjs';
import { ROOT, LANGS } from './lib/common.mjs';
import { getEnv } from './lib/browser.mjs';
import { measure } from '../perf.mjs';
import { manifestIsCurrent, MANIFEST } from '../build-fonts.mjs';

export const id = 'G15';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CSS = ['css/base.css', 'css/main.css', 'css/vendor.css', 'css/staff.css', 'css/fonts.css', 'css/micons/micons.css', 'css/font-awesome-6/css/subset.css'];

export async function run(ctx) {
  const g = new Gate('G15', 'Performance (budgets, blocking resources, fonts, lazy loading)');
  const env = await getEnv(ctx);
  const html = read('index.html');
  const head = html.slice(html.indexOf('<head'), html.indexOf('</head>'));

  // ---------------------------------------------------------------- static
  g.check(!/<script[^>]*\ssrc=/.test(head), 'no <script src> in the <head>: no script blocks the first paint (all of them are at the end of the body)');
  const imports = CSS.filter((f) => /@import/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, '')));
  g.check(imports.length === 0, 'no stylesheet uses @import (it makes the browser find the next file one step too late; the page head links each one)', imports.join(', '));
  const linked = CSS.filter((f) => !html.includes(`href="${f}"`));
  g.check(linked.length === 0, 'every stylesheet is linked directly from the page head', linked.join(', '));

  // fonts: each face the CSS uses starts with the small woff2 subset and has font-display
  {
    const used = new Set();
    for (const f of ['css/main.css', 'css/base.css', 'css/staff.css', 'css/vendor.css']) for (const m of read(f).matchAll(/["']((?:lora|poppins)-[a-z-]+)["']/g)) used.add(m[1]);
    const fontsCss = read('css/fonts.css');
    const bad = [];
    for (const fam of used) {
      const block = (fontsCss.match(new RegExp("@font-face\\s*\\{[^}]*font-family:\\s*'" + fam + "'[^}]*\\}")) || [''])[0];
      const subset = (block.match(/fonts\/subset\/[a-z-]+\.woff2/) || [''])[0];
      if (!block || !subset || !fs.existsSync(path.join(ROOT, subset)) || !/font-display:\s*swap/.test(block)) bad.push(fam);
    }
    g.check(used.size >= 6 && bad.length === 0, `all ${used.size} text fonts in use load a small woff2 subset first and use font-display: swap`, bad.join(', '));
    g.check(manifestIsCurrent(), 'the font subsets are current: they contain every character of the site and every icon the page uses (a new character or icon needs: node build-fonts.mjs)', `${MANIFEST} is out of date`);
    const fa = read('css/font-awesome-6/css/subset.css');
    g.check(/fa-solid-subset\.woff2/.test(fa) && /fa-brands-subset\.woff2/.test(fa) && fs.existsSync(path.join(ROOT, 'css/font-awesome-6/webfonts/fa-solid-subset.woff2')), 'Font Awesome loads icon-only woff2 subsets (a few KB instead of 226 KB)');
    g.check(/icomoon-subset\.woff2/.test(read('css/micons/micons.css')) && fs.existsSync(path.join(ROOT, 'css/micons/fonts/icomoon-subset.woff2')), 'the service icon font is an icon-only woff2 subset');
  }
  const preloads = [...html.matchAll(/<link rel="preload" href="([^"]+)"/g)].map((m) => m[1]);
  g.check(preloads.every((p) => fs.existsSync(path.join(ROOT, p))), `every preload points to an existing file (${preloads.length})`, preloads.join(', '));
  g.check(/window\.addEventListener\('load', start\)/.test(html) && /document\.readyState === 'complete'/.test(html), 'Google Tag Manager is started after the page has loaded (third-party code does not compete with the first screen)');
  g.check(/setTimeout\(hidePreloader, 4000\)/.test(read('js/main.js')), 'the preloader has a 4 s safety net');
  g.check(!/modernizr|pace\.min|jquery-migrate/.test(html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '')), 'Modernizr, Pace and jQuery Migrate are gone from the page');
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const lazy = images.filter((i) => /loading="lazy"/.test(i));
  g.check(lazy.length >= 25 && lazy.every((i) => /\sdecoding="async"/.test(i) && /\swidth="\d+"/.test(i) && /\.webp"/.test(i)), `the ${lazy.length} project images are WebP, lazy, decoded off the main thread and have their size declared`, lazy.filter((i) => !/\.webp"/.test(i)).slice(0, 2).join('\n'));

  // ---------------------------------------------------------------- dynamic
  {
    const s = await env.open('en', { width: 390 });
    const before = s.logs.requests.filter((u) => /images\/bg\.jpg/.test(u)).length;
    await s.page.evaluate(() => document.querySelector('#services').scrollIntoView());
    await s.page.waitForTimeout(1200);
    const after = await s.page.evaluate(() => ({ bg: getComputedStyle(document.querySelector('#services')).backgroundImage, ready: document.querySelector('#services').classList.contains('bg-ready') }));
    const got = s.logs.requests.filter((u) => /images\/bg\.jpg/.test(u)).length;
    g.check(before === 0 && got >= 1 && /bg\.jpg/.test(after.bg) && after.ready, 'the decorative picture of "Where I can help" is not part of the first load and arrives when the section comes near (196 KB saved on the way in)', JSON.stringify({ before, got, after }));
    await s.close();
  }
  {
    // every icon the page shows is really drawn. The subset fonts only hold the icons in use, so one left out would show as an empty box:
    // draw each glyph (class-based and ::before/::after) with its own font and compare it with the same character in a font that does not exist
    const s = await env.open('en', { width: 1280 });
    await s.page.waitForTimeout(800);
    const res = await s.page.evaluate(async () => {
      const used = new Map();
      for (const el of document.querySelectorAll('*')) {
        for (const pseudo of ['::before', '::after']) {
          const cs = getComputedStyle(el, pseudo);
          const c = cs.content;
          if (!c || c === 'none' || c === 'normal' || !/^["']/.test(c) || !/Awesome|icomoon/i.test(cs.fontFamily)) continue;
          const ch = c.slice(1, -1);
          if (!ch.trim()) continue; // decorative empty boxes (content: "")
          used.set(cs.fontWeight + '|' + cs.fontFamily + '|' + ch, { weight: cs.fontWeight, family: cs.fontFamily, ch, where: (el.className && el.className.baseVal === undefined ? el.className : el.tagName) + pseudo });
        }
      }
      const cvs = document.createElement('canvas');
      cvs.width = cvs.height = 48;
      const ctx = cvs.getContext('2d', { willReadFrequently: true });
      const hash = (font, ch) => {
        ctx.clearRect(0, 0, 48, 48);
        ctx.font = font;
        ctx.fillStyle = '#000';
        ctx.fillText(ch, 6, 34);
        const d = ctx.getImageData(0, 0, 48, 48).data;
        let h = 0;
        for (let i = 3; i < d.length; i += 4) h = (h * 31 + d[i]) | 0;
        return h;
      };
      const bad = [];
      for (const u of used.values()) {
        await document.fonts.load(`${u.weight} 28px ${u.family}`, u.ch);
        const drawn = hash(`${u.weight} 28px ${u.family}`, u.ch);
        const missing = hash(`${u.weight} 28px "no-such-font-zz"`, u.ch);
        if (drawn === missing || drawn === 0) bad.push(`${u.family} ${u.weight} U+${u.ch.codePointAt(0).toString(16)} on ${u.where}`);
      }
      return { count: used.size, bad };
    });
    g.check(res.count >= 25 && res.bad.length === 0, `all ${res.count} icon glyphs of the page are really drawn (no empty boxes where an icon should be)`, res.bad.join('\n'));
    await s.close();
  }
  {
    // a download that never finishes (here: the hero picture, held for 12 s) must not keep the cover over the page
    const context = await env.browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await context.route(/googletagmanager|google-analytics/, (r) => r.abort());
    await context.route(/intro-bg\.webp/, async (route) => { await new Promise((r) => setTimeout(r, 12000)); try { await route.continue(); } catch (e) { /* context closed */ } });
    const page = await context.newPage();
    const t0 = Date.now();
    page.goto(`${env.base}/?lang=en`, { waitUntil: 'commit' }).catch(() => {});
    let gone = -1;
    while (Date.now() - t0 < 9000) {
      const hidden = await page.evaluate(() => { const p = document.querySelector('#preloader'); return !!p && getComputedStyle(p).display === 'none'; }).catch(() => false);
      if (hidden) { gone = Date.now() - t0; break; }
      await page.waitForTimeout(150);
    }
    await context.close();
    g.check(gone > 0 && gone <= 6500, `with a download stuck for 12 s the cover still leaves after ${gone > 0 ? (gone / 1000).toFixed(1) : '>9'} s (safety net at 4 s)`);
  }
  for (const lang of LANGS) for (const width of [1280, 375]) {
    const s = await env.open(lang, { width });
    await s.page.waitForTimeout(1500);
    const rows = await s.page.evaluate(() => [...document.querySelectorAll('.owl-carousel')].map((el) => {
      const owl = window.jQuery(el).data('owlCarousel');
      if (!owl || !owl.options.autoHeight) return null;
      const outer = el.querySelector('.owl-wrapper-outer').getBoundingClientRect().height;
      const slide = el.querySelectorAll('.owl-item')[owl.currentItem];
      return { id: el.id, outer: Math.round(outer), content: Math.round(slide.firstElementChild.scrollHeight) };
    }).filter(Boolean));
    const clipped = rows.filter((r) => r.outer < r.content - 2);
    g.check(rows.length >= 1 && clipped.length === 0, `[${lang.toUpperCase()} ${width}px] auto-height carousels are as tall as their slide (nothing cut off; measured again once the fonts are in)`, JSON.stringify(clipped));
    await s.close();
  }

  // the same, with the web fonts arriving 1.5 s late (a slow phone): the carousels are first measured with the fallback font and
  // must be measured again when the real one is in. Without that, the experience carousel ends up 30 to 60 px too short and cuts its text.
  for (const lang of LANGS) {
    const context = await env.browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await context.route(/googletagmanager|google-analytics/, (r) => r.abort());
    await context.route(/fonts\/subset\/.*woff2/, async (route) => { await new Promise((r) => setTimeout(r, 1500)); try { await route.continue(); } catch (e) { /* context closed */ } });
    const page = await context.newPage();
    await page.goto(`${env.base}/?lang=${lang}`, { waitUntil: 'load' });
    await page.waitForTimeout(4500);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.owl-carousel')].map((el) => {
      const owl = window.jQuery(el).data('owlCarousel');
      if (!owl || !owl.options.autoHeight) return null;
      return { id: el.id, outer: Math.round(el.querySelector('.owl-wrapper-outer').getBoundingClientRect().height), content: Math.round(el.querySelectorAll('.owl-item')[owl.currentItem].firstElementChild.scrollHeight) };
    }).filter(Boolean));
    const clipped = rows.filter((r) => r.outer < r.content - 2);
    g.check(rows.length >= 1 && clipped.length === 0, `[${lang.toUpperCase()}] fonts arriving 1.5 s late: the auto-height carousels are measured again and still show their whole slide`, JSON.stringify(clipped));
    await context.close();
  }

  // ---------------------------------------------------------------- lab numbers
  const BUDGET = { total: 360, font: 130, image: 80, js: 120, css: 40, requests: 34 };
  const TIME = { preloaderHidden: 4500, lcp: 3200, tbt: 1000, load: 4000 };
  for (const [target, runs] of [['', 3], ['pt/', 1]]) {
    const r = await measure(target, runs);
    const label = `[${r.target}]`;
    const over = Object.entries({ total: r.transferKB, font: r.by.font, image: r.by.image, js: r.by.js, css: r.by.css, requests: r.requests }).filter(([k, v]) => v > BUDGET[k]).map(([k, v]) => `${k} ${v} > ${BUDGET[k]}`);
    g.check(over.length === 0, `${label} first load on Slow 4G: ${r.transferKB} KB in ${r.requests} requests (fonts ${r.by.font}, images ${r.by.image}, js ${r.by.js}, css ${r.by.css}, html ${r.by.html}) is within budget`, over.join(', '));
    g.info(`${label} lab run (median of ${r.runs}): FCP ${r.fcp} ms, LCP ${r.lcp} ms (${r.lcpEl}), TBT ${r.tbt} ms, CLS ${r.cls}, load ${r.load} ms, cover gone at ${r.preloaderHidden} ms`);
    if (runs >= 3) {
      const slow = Object.entries(TIME).filter(([k]) => r[k] > TIME[k]).map(([k]) => `${k} ${r[k]} ms > ${TIME[k]} ms`);
      g.check(slow.length === 0 && r.cls <= 0.05, `${label} timings on a throttled phone stay within generous limits (cover gone ${r.preloaderHidden} ms, LCP ${r.lcp} ms, TBT ${r.tbt} ms, CLS ${r.cls})`, slow.join(', '));
    }
  }
  return g;
}
