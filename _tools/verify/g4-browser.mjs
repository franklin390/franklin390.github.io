// G4 — Behaviour in a real Chrome: language switch (position, effect, persistence, deep links, keyboard, blocked storage,
// file://, no-JS), console/network cleanliness, preloader, carousel, modals, counters, scrollspy, menu.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { Gate } from './lib/report.mjs';
import { ROOT, loadFacts, LANGS, HTML_LANG, OG_LOCALE, CV_FILE } from './lib/common.mjs';
import { loadBoth } from './lib/dict.mjs';
import { range } from './lib/dates.mjs';
import { getEnv } from './lib/browser.mjs';

export const id = 'G4';

const CV = CV_FILE;

/** Compare the whole DOM against the dictionary for one language; returns a list of mismatches. */
async function domMismatches(page, lang, dict) {
  const snap = await page.evaluate(() => ({
    text: [...document.querySelectorAll('[data-i18n]')].map((e) => [e.getAttribute('data-i18n'), e.textContent]),
    attrs: [...document.querySelectorAll('[data-i18n-attr]')].flatMap((e) => e.getAttribute('data-i18n-attr').split(';').map((p) => { const i = p.indexOf(':'); return [p.slice(0, i).trim(), p.slice(i + 1).trim(), e.getAttribute(p.slice(0, i).trim())]; })),
    dates: [...document.querySelectorAll('[data-date]')].map((e) => [e.getAttribute('data-date'), e.getAttribute('data-date-end'), e.textContent]),
    hrefs: [...document.querySelectorAll('[data-href-en]')].map((e) => [e.getAttribute('data-href-' + document.documentElement.getAttribute('data-lang')), e.getAttribute('href')]),
  }));
  const bad = [];
  for (const [k, v] of snap.text) if (v !== dict[k]) bad.push(`text ${k}: "${v.slice(0, 50)}" != "${String(dict[k]).slice(0, 50)}"`);
  for (const [a, k, v] of snap.attrs) if (v !== dict[k]) bad.push(`attr ${a}=${k}: "${v}" != "${dict[k]}"`);
  for (const [s, e, v] of snap.dates) if (v !== range(s, e, lang)) bad.push(`date ${s}..${e}: "${v}" != "${range(s, e, lang)}"`);
  for (const [want, got] of snap.hrefs) if (want !== got) bad.push(`href: ${got} != ${want}`);
  return { bad, counts: { text: snap.text.length, attrs: snap.attrs.length, dates: snap.dates.length, hrefs: snap.hrefs.length } };
}

async function meta(page) {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    dataLang: document.documentElement.getAttribute('data-lang'),
    title: document.title,
    desc: document.querySelector('meta[name="description"]').content,
    ogLocale: document.querySelector('meta[property="og:locale"]').content,
    ogTitle: document.querySelector('meta[property="og:title"]').content,
    pressed: Object.fromEntries([...document.querySelectorAll('.lang-btn')].map((b) => [b.dataset.lang, b.getAttribute('aria-pressed')])),
    search: location.search,
    stored: (() => { try { return localStorage.getItem('lang'); } catch (e) { return 'ERR'; } })(),
    live: document.getElementById('i18n-live').textContent,
  }));
}

export async function run(ctx) {
  const g = new Gate('G4', 'Browser behaviour (language switch & page)');
  const env = await getEnv(ctx);
  const dict = loadBoth();
  const facts = loadFacts();

  // 1) default load: English, clean console, no unexpected network
  {
    const s = await env.open(null, { query: '' });
    const m = await meta(s.page);
    g.check(m.lang === 'en' && m.dataLang === 'en', 'default language is English (html lang="en")', JSON.stringify(m));
    g.check(m.pressed.en === 'true' && m.pressed.pt === 'false' && m.pressed.es === 'false', 'EN button pressed by default (PT and ES not pressed)');
    g.check(m.title === dict.en['meta.title'] && m.desc === dict.en['meta.description'], 'title and meta description are the EN ones');
    const d = await domMismatches(s.page, 'en', dict.en);
    g.check(d.bad.length === 0, `EN DOM matches en.js (${d.counts.text} texts, ${d.counts.attrs} attrs, ${d.counts.dates} dates, ${d.counts.hrefs} hrefs)`, d.bad.slice(0, 8).join('\n'));
    g.check(s.logs.console.length === 0 && s.logs.errors.length === 0, 'no console errors/warnings or page errors on load', [...s.logs.console, ...s.logs.errors].join('\n'));
    g.check(s.logs.failed.length === 0, 'no HTTP >= 400 responses on load', s.logs.failed.join('\n'));
    g.check(s.logs.external.size === 0, 'no unexpected third-party hosts contacted (only GTM/GA allowed)', [...s.logs.external].join(', '));
    await s.close();
  }

  // 2) header bar: brand · nav · language switch · menu button, at several widths
  for (const w of [320, 375, 768, 959, 960, 1024, 1180, 1280, 1920]) {
    const s = await env.open('en', { width: w });
    const r = await s.page.evaluate(() => {
      const rect = (el) => { if (!el) return null; const cs = getComputedStyle(el); if (cs.display === 'none') return null; const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
      const bar = document.querySelector('.site-header');
      return {
        vw: document.documentElement.clientWidth, pos: getComputedStyle(bar).position, bar: rect(bar),
        brand: rect(document.querySelector('.brand')), nav: rect(document.querySelector('.main-navigation')), sw: rect(document.querySelector('.lang-switch')), toggle: rect(document.querySelector('.menu-toggle')),
        btns: [...document.querySelectorAll('.lang-btn')].map((b) => rect(b)), sx: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        mark: !!document.querySelector('.brand-mark'), name: (() => { const n = document.querySelector('.brand-name'); return n ? { vis: getComputedStyle(n).display !== 'none', trunc: n.scrollWidth > n.clientWidth + 1, color: getComputedStyle(n).color, text: n.textContent } : null; })()
      };
    });
    const mid = (x) => (x.t + x.b) / 2;
    g.check(r.pos === 'fixed' && r.bar.t === 0 && r.bar.l === 0 && Math.abs(r.bar.w - r.vw) <= 1 && r.bar.h <= 72, `[${w}px] header is a full-width bar fixed to the top (${Math.round(r.bar.h)}px tall)`, JSON.stringify(r.bar));
    g.check(r.vw - r.sw.r <= 40 && r.sw.l >= 0 && Math.abs(mid(r.sw) - mid(r.bar)) <= 3, `[${w}px] language switch is the right-most control, at the top-right corner, vertically centred in the bar (right gap ${(r.vw - r.sw.r).toFixed(0)}px)`, JSON.stringify(r.sw));
    const lead = r.toggle || r.brand;
    g.check(lead.l <= 40 && (!r.toggle || r.toggle.r <= r.brand.l + 0.5), `[${w}px] ${r.toggle ? 'the menu button sits at the left edge, before the name' : 'the name sits at the left edge'} (left gap ${lead.l.toFixed(0)}px)`, JSON.stringify({ toggle: r.toggle, brand: r.brand }));
    g.check(!r.mark && r.name && r.name.vis && !r.name.trunc && r.name.text === 'Franklin Ferreira' && r.name.color === 'rgb(255, 255, 255)', `[${w}px] the bar shows the full name in white, with no "FF" monogram and nothing truncated`, JSON.stringify({ mark: r.mark, name: r.name }));
    const parts = [['brand', r.brand], ['nav', r.nav], ['switch', r.sw], ['menu button', r.toggle]].filter(([, x]) => x);
    const clashes = [];
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const A = parts[i][1], B = parts[j][1];
      if (!(A.r <= B.l + 0.5 || B.r <= A.l + 0.5)) clashes.push(parts[i][0] + '×' + parts[j][0]);
    }
    g.check(clashes.length === 0, `[${w}px] brand, navigation, switch and menu button do not overlap`, clashes.join(', '));
    g.check(r.btns.every((b) => b.h >= 36 && b.w >= (w <= 330 ? 32 : 40)) && (!r.toggle || (r.toggle.w >= 36 && r.toggle.h >= 36)), `[${w}px] switch buttons (3) and menu button have a usable touch target (>=${w <= 330 ? 32 : 40}x36; WCAG 2.2 minimum is 24)`, JSON.stringify(r.btns.map((b) => [Math.round(b.w), Math.round(b.h)])));
    g.check(!r.sx, `[${w}px] the bar causes no horizontal scrolling`);
    const inline = w >= 960;
    g.check(inline ? !!r.nav && !r.toggle : !r.nav && !!r.toggle, `[${w}px] ${inline ? 'links are inline in the bar and the menu button is hidden' : 'links collapse behind the menu button'}`, JSON.stringify({ nav: !!r.nav, toggle: !!r.toggle }));
    await s.close();
  }

  // 2b) the theme paints visited links black (a:visited): force :visited through DevTools and compare with the normal colour of every link
  {
    const s = await env.open('en', { width: 1280 });
    await s.page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
    const cdp = await s.page.context().newCDPSession(s.page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'a:not(.menu-toggle)' });
    const colorOf = async (nodeId) => (await cdp.send('CSS.getComputedStyleForNode', { nodeId })).computedStyle.find((p) => p.name === 'color').value;
    const changed = [];
    for (const nodeId of nodeIds) {
      const before = await colorOf(nodeId);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['visited'] });
      const after = await colorOf(nodeId);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      if (before !== after) {
        const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
        changed.push((attributes[attributes.indexOf('class') + 1] || 'a') + ' ' + (attributes[attributes.indexOf('href') + 1] || '') + ': ' + before + ' -> ' + after);
      }
    }
    g.check(nodeIds.length > 50 && changed.length === 0, `[1280px] all ${nodeIds.length} links keep their colour once visited (the theme's a:visited would turn them black)`, changed.join('\n'));
    await s.close();
  }

  // 2c) About: on tablet widths and below the photo is centred above the text instead of squeezing the paragraphs beside it
  for (const w of [375, 500, 650, 768, 769, 900, 1280]) {
    const s = await env.open('en', { width: w });
    const r = await s.page.evaluate(() => {
      const b = (q) => { const x = document.querySelector(q).getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top, b: x.bottom, w: x.width }; };
      return { vw: document.documentElement.clientWidth, img: b('.intro-info img'), p: b('.intro-info .lead'), pad: parseFloat(getComputedStyle(document.querySelector('.intro-info .lead')).paddingLeft) };
    });
    const stacked = w <= 768;
    const centred = Math.abs((r.img.l + r.img.r) / 2 - r.vw / 2) <= 2;
    const ok = stacked ? centred && r.img.b <= r.p.t + 1 : !centred && r.img.r <= r.p.l + r.pad + 1 && r.img.t >= r.p.t - 2 && r.img.t <= r.p.t + 40;
    g.check(ok, `[${w}px] About photo ${stacked ? 'is centred above the text' : 'sits beside the text'}`, JSON.stringify(r));
    if (stacked) g.check(r.pad === 0 && r.p.w >= Math.min(r.vw - 120, 540), `[${w}px] About paragraphs have no left indent and use the whole text column when the photo is stacked (${Math.round(r.p.w)}px wide of ${r.vw}px)`, JSON.stringify({ pad: r.pad, w: r.p.w }));
    await s.close();
  }

  // 2d) skill tags: hover interaction on hover-capable devices (lift + tint), and no motion with prefers-reduced-motion
  for (const rm of ['no-preference', 'reduce']) {
    const s = await env.open('en', { width: 1280, reducedMotion: rm });
    const p = s.page;
    const look = (sel) => p.evaluate((q) => { const c = getComputedStyle(document.querySelector(q)); return { t: c.transform, bg: c.backgroundImage + ' | ' + c.backgroundColor, color: c.color, bc: c.borderTopColor, sh: c.boxShadow }; }, sel);
    const res = {};
    for (const [name, sel] of [['regular', '.tags li']]) {
      await p.locator(sel).first().scrollIntoViewIfNeeded();
      await p.mouse.move(2, 400);
      await p.waitForTimeout(450);
      const before = await look(sel);
      await p.locator(sel).first().hover();
      await p.waitForTimeout(550);
      const during = await look(sel);
      await p.mouse.move(2, 400);
      await p.waitForTimeout(550);
      const after = await look(sel);
      res[name] = { before, during, after };
    }
    const R = res.regular;
    const lifted = (x) => x.during.t !== 'none';
    g.check(R.during.bc !== R.before.bc && R.during.sh !== 'none' && R.before.sh === 'none' && R.during.color !== R.before.color && (rm === 'reduce' ? !lifted(R) : lifted(R)),
      `[${rm}] skill tags: a regular tag lights up on hover (pink border/text, tint, shadow${rm === 'reduce' ? ', no motion' : ', lifts'})`, JSON.stringify(R.during));
    g.check(R.after.bc === R.before.bc && R.after.t === R.before.t && R.after.sh === R.before.sh,
      `[${rm}] skill tags: everything returns to the resting look when the pointer leaves`, JSON.stringify({ R: R.after }));
    await s.close();
  }

  // 2e) impact stats: hover feedback, and a click/Enter/tap that leads to the evidence (case card or role)
  // order on the page: cost and reliability first, scale next, the size of the team last
  const STAT_LINKS = [['#case-finops', 'impact.cta.case'], ['#case-cicd', 'impact.cta.case'], ['#case-migration', 'impact.cta.case'], ['#case-unity', 'impact.cta.case'], ['#case-clicksign', 'impact.cta.case'], ['#role-fb-staff', 'impact.cta.exp']];
  const arrival = (p, sel) => p.evaluate((q) => { const t = document.querySelector(q); const b = t.getBoundingClientRect(); return { top: Math.round(b.top), bar: Math.round(document.querySelector('.site-header').getBoundingClientRect().bottom), inView: b.height > 0 && b.left >= -1 && b.right <= document.documentElement.clientWidth + 1, spot: t.classList.contains('is-spotlight'), hash: location.hash, focus: document.activeElement === t }; }, sel);
  for (const rm of ['no-preference', 'reduce']) {
    const s = await env.open('en', { width: 1280, reducedMotion: rm });
    const p = s.page;
    if (rm === 'no-preference') {
      const links = await p.evaluate(() => [...document.querySelectorAll('#impact .stat-link')].map((a) => [a.getAttribute('href'), !!document.querySelector(a.getAttribute('href')), a.querySelector('.stat-cta').textContent.trim()]));
      g.check(links.length === 6 && links.every(([, ok]) => ok), '[impact] all 6 stats are links whose target exists (' + links.map((l) => l[0]).join(' ') + ')', JSON.stringify(links));
      g.check(links.every(([h, , cta], i) => h === STAT_LINKS[i][0] && cta === dict.en[STAT_LINKS[i][1]]), '[impact] every stat tells where it leads ("' + dict.en['impact.cta.case'] + '" / "' + dict.en['impact.cta.exp'] + '")', JSON.stringify(links.map((l) => l[2])));
    }
    // hover feedback on the third stat
    const look = () => p.evaluate(() => { const a = document.querySelectorAll('#impact .stat-link')[2]; const c = getComputedStyle(a); return { t: c.transform, bg: c.backgroundColor, sh: c.boxShadow, icon: getComputedStyle(a.querySelector('.icon-part i')).color, cta: getComputedStyle(a.querySelector('.stat-cta')).opacity }; });
    await p.locator('#impact .stats-list').scrollIntoViewIfNeeded();
    await p.mouse.move(2, 700);
    await p.waitForTimeout(500);
    const before = await look();
    await p.locator('#impact .stat-link').nth(2).hover();
    await p.waitForTimeout(650);
    const during = await look();
    await p.mouse.move(2, 700);
    await p.waitForTimeout(650);
    const after = await look();
    g.check(before.icon === 'rgb(255, 194, 220)' && before.cta === '0' && during.icon === 'rgb(255, 255, 255)' && during.cta === '1' && during.bg !== before.bg && during.sh !== 'none' && (rm === 'reduce' ? during.t === 'none' : during.t !== 'none'),
      '[' + rm + '] impact stats: a stat lights up on hover (icon from light pink to white, tinted panel, shadow, "see the case" hint' + (rm === 'reduce' ? ', no motion' : ', lifts') + ')', JSON.stringify({ before, during }));
    g.check(after.icon === before.icon && after.cta === before.cta && after.bg === before.bg && after.t === before.t, '[' + rm + '] impact stats: back to the resting look when the pointer leaves', JSON.stringify(after));

    // click on a stat while a filter hides its case: the case comes back, lands clear of the fixed bar, is highlighted, URL updated, focus moved
    await p.evaluate(() => document.querySelector('.case-filter[data-filter="governance"]').click());
    await p.waitForTimeout(200);
    const hidden = await p.evaluate(() => document.querySelector('#case-finops').classList.contains('is-filtered-out'));
    await p.evaluate(() => document.querySelector('#impact .stat-link[href="#case-finops"]').scrollIntoView({ block: 'center' }));
    await p.locator('#impact .stat-link[href="#case-finops"]').click();
    await p.waitForTimeout(1700);
    const a1 = await arrival(p, '#case-finops');
    const pressed = await p.evaluate(() => [...document.querySelectorAll('.case-filter')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.filter).join());
    g.check(hidden && pressed === 'all' && a1.inView, '[' + rm + '] clicking ">50%" brings back the hidden FinOps case (filter reset to All)', JSON.stringify({ hidden, pressed, a1 }));
    g.check(a1.top >= a1.bar + 8 && a1.top <= 260 && a1.spot && a1.hash === '#case-finops' && a1.focus, '[' + rm + '] the case lands clear of the fixed bar, is highlighted, the URL is updated and focus moves to it', JSON.stringify(a1));

    // keyboard: Enter on each of the remaining stats (the role one starts with another slide of the carousel open)
    await p.evaluate(() => window.jQuery('#owl-slider-work').trigger('owl.jumpTo', 3));
    await p.waitForTimeout(500);
    const kb = [];
    for (const [href] of STAT_LINKS.filter(([h]) => h !== '#case-finops')) {
      await p.evaluate((h) => { const a = document.querySelector('#impact .stat-link[href="' + h + '"]'); a.scrollIntoView({ block: 'center' }); a.focus(); }, href);
      await p.waitForTimeout(250);
      await p.keyboard.press('Enter');
      await p.waitForTimeout(1800);
      const r = await arrival(p, href);
      kb.push(r.inView && r.top >= r.bar + 8 && r.top <= 320 && r.spot && r.hash === href ? 'ok' : href + ' ' + JSON.stringify(r));
    }
    const slide = await p.evaluate(() => window.jQuery('#owl-slider-work').data('owlCarousel').currentItem);
    g.check(kb.every((x) => x === 'ok') && slide === 0, '[' + rm + '] Enter on a stat reaches its destination (5 stats); the Staff role opens its carousel slide', kb.join(' | ') + ' slide=' + slide);
    await s.close();
  }
  {
    // touch devices have no hover: the hint is always visible, and a tap navigates
    const s = await env.open('en', { width: 390, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    const p = s.page;
    const t = await p.evaluate(() => ({ hover: matchMedia('(hover: hover)').matches, cta: [...document.querySelectorAll('#impact .stat-cta')].map((e) => getComputedStyle(e).opacity) }));
    g.check(!t.hover && t.cta.length === 6 && t.cta.every((o) => parseFloat(o) > 0.9), '[touch] no hover capability: the "see the case" hint is always visible on all 6 stats', JSON.stringify(t));
    await p.evaluate(() => document.querySelector('#impact .stat-link[href="#case-clicksign"]').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(300);
    await p.locator('#impact .stat-link[href="#case-clicksign"]').tap();
    await p.waitForTimeout(1800);
    const a = await arrival(p, '#case-clicksign');
    g.check(a.inView && a.top >= a.bar + 8 && a.spot && a.hash === '#case-clicksign', '[touch] tapping a stat goes to its case, clear of the fixed bar', JSON.stringify(a));
    await s.close();
  }

  // 3) click PT / ES → everything flips; click EN → flips back
  for (const L2 of ['pt', 'es']) {
    const U = L2.toUpperCase();
    const others = LANGS.filter((x) => x !== L2);
    const s = await env.open('en');
    await s.page.click(`.lang-btn[data-lang="${L2}"]`);
    await s.page.waitForTimeout(200);
    let m = await meta(s.page);
    g.check(m.lang === HTML_LANG[L2] && m.dataLang === L2 && m.pressed[L2] === 'true' && others.every((x) => m.pressed[x] === 'false'), `${U} click: html lang="${HTML_LANG[L2]}", aria-pressed updated`, JSON.stringify(m.pressed));
    g.check(m.desc === dict[L2]['meta.description'] && m.ogLocale === OG_LOCALE[L2] && m.ogTitle === dict[L2]['meta.title'], `${U} click: meta description and og:locale=${OG_LOCALE[L2]} updated`);
    g.check(m.search === `?lang=${L2}` && m.stored === L2, `${U} click: URL gets ?lang=${L2} and choice is saved`, JSON.stringify({ s: m.search, st: m.stored }));
    g.check(m.live === dict[L2]['lang.announce'], `${U} click: screen-reader live region announces the change`, m.live);
    let d = await domMismatches(s.page, L2, dict[L2]);
    g.check(d.bad.length === 0, `${U} click: whole DOM equals ${L2}.js (${d.counts.text} texts, ${d.counts.attrs} attrs, ${d.counts.dates} dates)`, d.bad.slice(0, 8).join('\n'));
    const cvL = await s.page.evaluate((l) => [...document.querySelectorAll('[data-href-' + l + '$=".pdf"]')].map((a) => a.getAttribute('href')), L2); // the e-mail links of the Contact paths also switch language, but they are not CVs
    g.check(cvL.length >= 2 && cvL.every((h) => h === CV[L2]), `${U} click: every CV download link points to the ${U} PDF`, cvL.join(' '));

    await s.page.click('.lang-btn[data-lang="en"]');
    await s.page.waitForTimeout(200);
    m = await meta(s.page);
    d = await domMismatches(s.page, 'en', dict.en);
    g.check(m.lang === 'en' && m.stored === 'en' && d.bad.length === 0, `EN click (after ${U}): everything flips back to English`, d.bad.slice(0, 5).join('\n'));
    const cvEn = await s.page.evaluate(() => [...document.querySelectorAll('[data-href-en$=".pdf"]')].map((a) => a.getAttribute('href')));
    g.check(cvEn.every((h) => h === CV.en), `EN click (after ${U}): CV download links point to the EN PDF`);
    g.check(s.logs.console.length === 0 && s.logs.errors.length === 0, `no console/page errors while switching between EN and ${U}`, [...s.logs.console, ...s.logs.errors].join('\n'));

    // persistence: new navigation WITHOUT query in the same context
    await s.page.click(`.lang-btn[data-lang="${L2}"]`);
    await s.page.goto(env.base + '/', { waitUntil: 'load' });
    await s.page.waitForTimeout(300);
    m = await meta(s.page);
    g.check(m.lang === HTML_LANG[L2] && m.pressed[L2] === 'true', `saved choice persists across visits (${U}, no ?lang= in URL)`);
    // explicit query beats saved choice
    await s.page.goto(env.base + '/?lang=en', { waitUntil: 'load' });
    m = await meta(s.page);
    g.check(m.lang === 'en', `?lang=en overrides the saved ${U} choice`);
    await s.close();
  }

  // 4) deep links + invalid values
  for (const [q, want] of [['?lang=pt', 'pt-BR'], ['?lang=es', 'es'], ['?lang=en', 'en'], ['?lang=zz', 'en'], ['?lang=PT', 'en'], ['?lang=ES', 'en'], ['?lang=', 'en'], ['?lang=pt#about', 'pt-BR'], ['?lang=es#about', 'es']]) {
    const s = await env.open(null, { query: q });
    const m = await meta(s.page);
    g.check(m.lang === want, `URL ${q} → html lang="${want}"`, m.lang);
    await s.close();
  }

  // 5) hostile storage: localStorage throws → still works, no errors
  {
    const context = await env.browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await context.route(/googletagmanager|google-analytics/, (r) => r.abort());
    await context.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException('denied', 'SecurityError'); };
      Storage.prototype.setItem = () => { throw new DOMException('denied', 'SecurityError'); };
    });
    const page = await context.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(env.base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.click('.lang-btn[data-lang="pt"]');
    await page.waitForTimeout(200);
    const lang = await page.evaluate(() => document.documentElement.lang);
    g.check(errs.length === 0 && lang === 'pt-BR', 'blocked/throwing localStorage: page loads and switch still works', errs.join('\n') + ' lang=' + lang);
    await context.close();
  }

  // 6) keyboard operation
  {
    const s = await env.open('en');
    await s.page.focus('.lang-btn[data-lang="pt"]');
    await s.page.keyboard.press('Enter');
    await s.page.waitForTimeout(150);
    let m = await meta(s.page);
    g.check(m.lang === 'pt-BR', 'keyboard: Enter on the PT button switches language');
    await s.page.focus('.lang-btn[data-lang="es"]');
    await s.page.keyboard.press('Enter');
    await s.page.waitForTimeout(150);
    m = await meta(s.page);
    g.check(m.lang === 'es', 'keyboard: Enter on the ES button switches language');
    await s.page.focus('.lang-btn[data-lang="en"]');
    await s.page.keyboard.press('Space');
    await s.page.waitForTimeout(150);
    m = await meta(s.page);
    g.check(m.lang === 'en', 'keyboard: Space on the EN button switches back');
    await s.close();
    // tab order on a fresh page: skip link first, then the language switch
    const f = await env.open('en');
    const order = [];
    for (let i = 0; i < 12; i++) { await f.page.keyboard.press('Tab'); order.push(await f.page.evaluate(() => { const a = document.activeElement; return a ? (a.className || a.tagName) + (a.dataset && a.dataset.lang ? ':' + a.dataset.lang : '') : ''; })); }
    g.check(/skip-link/.test(order[0]) && /brand/.test(order[1]) && order.slice(2, 9).every((x) => /smoothscroll/.test(x)) && order[9] === 'lang-btn:en' && order[10] === 'lang-btn:pt' && order[11] === 'lang-btn:es', 'keyboard (desktop): tab order is skip link → brand → 7 section links → EN → PT → ES', order.join(' → '));
    await f.close();
    {
      const m = await env.open('en', { width: 375 });
      const ord = [];
      for (let i = 0; i < 6; i++) { await m.page.keyboard.press('Tab'); ord.push(await m.page.evaluate(() => { const a = document.activeElement; return a ? (a.className || a.tagName) + (a.dataset && a.dataset.lang ? ':' + a.dataset.lang : '') : ''; })); }
      g.check(/skip-link/.test(ord[0]) && /menu-toggle/.test(ord[1]) && /brand/.test(ord[2]) && ord[3] === 'lang-btn:en' && ord[4] === 'lang-btn:pt' && ord[5] === 'lang-btn:es', 'keyboard (mobile): tab order is skip link → menu button → name → EN → PT → ES (hidden links are not tab stops)', ord.join(' → '));
      await m.close();
    }
    {
    }
  }

  // 7) file:// (no server): dictionaries are plain scripts, so everything must still work
  {
    const context = await env.browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await context.route(/googletagmanager|google-analytics/, (r) => r.abort());
    const page = await context.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await page.click('.lang-btn[data-lang="pt"]');
    await page.waitForTimeout(200);
    const t = await page.evaluate(() => ({ lang: document.documentElement.lang, h: document.querySelector('[data-i18n="hero.greeting"]').textContent }));
    g.check(errs.length === 0 && t.lang === 'pt-BR' && t.h === dict.pt['hero.greeting'], 'opened from file:// the switch works too', `${errs.join(';')} ${JSON.stringify(t)}`);
    await context.close();
  }

  // 8) JavaScript disabled → English content still in the HTML (SEO / no-JS)
  {
    const context = await env.browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(env.base + '/', { waitUntil: 'load' });
    const body = await page.evaluate(() => document.body.innerText);
    g.check(body.includes('Staff Data Engineer') && body.includes(dict.en['about.p1'].slice(0, 60)) && body.includes('Flutter Brazil') && body.includes(dict.en['impact.title']), 'no-JS: English content is present in the static HTML');
    await context.close();
  }

  // 9) per-language page health + overflow + carousel + modal + menu + counters + scrollspy
  for (const lang of LANGS) {
    const L = lang.toUpperCase();
    const s = await env.open(lang, { reducedMotion: 'no-preference' });
    const p = s.page;
    // collapsible course list: closed by default, holds all 33 courses in the DOM, opens on click, label in the right language
    const det0 = await p.evaluate(() => { const d = document.querySelector('.train-details'); return { open: d.open, items: d.querySelectorAll('.train-list li').length, label: d.querySelector('summary').textContent }; });
    det0.visible = await p.locator('.train-list li').first().isVisible();
    g.check(!det0.open && !det0.visible && det0.items === 33 && det0.label === dict[lang]['train.courses.toggle'], `[${L}] course list is collapsed by default, holds 33 courses, summary says "${det0.label}"`, JSON.stringify(det0));
    await p.click('.train-details > summary');
    await p.waitForTimeout(200);
    const det1 = await p.evaluate(() => ({ open: document.querySelector('.train-details').open }));
    det1.visible = await p.locator('.train-list li').first().isVisible();
    g.check(det1.open && det1.visible, `[${L}] clicking the summary reveals the course list`, JSON.stringify(det1));
    await p.click('.train-details > summary');
    // career at a glance: one visible line per role, each one leads to its slide in the experience carousel
    const roleIds = ['role-fb-staff', 'role-fb-techlead', 'role-fb-de', 'role-ck-lead', 'role-ck-arch', 'role-ck-ds', 'role-lc'];
    const glance = await p.evaluate(() => [...document.querySelectorAll('.glance-link')].map((a) => ({ href: a.getAttribute('href'), ok: !!document.querySelector(a.getAttribute('href')), dates: a.querySelector('.glance-dates').textContent, slideDates: (document.querySelector(a.getAttribute('href') + ' .timeline-header p') || {}).textContent, result: a.querySelector('.glance-result').getAttribute('data-i18n'), text: a.querySelector('.glance-result').textContent })));
    const glanceBad = glance.filter((r, i) => !(r.href === '#' + roleIds[i] && r.ok && r.dates === r.slideDates && r.text === dict[lang][r.result]));
    g.check(glance.length === 7 && glanceBad.length === 0, `[${L}] career at a glance: 7 rows in the order of the carousel, the same dates as each slide, text in ${L}`, JSON.stringify(glanceBad.slice(0, 2)));
    await p.evaluate(() => document.querySelector('.glance-link[href="#role-ck-arch"]').scrollIntoView({ block: 'center' }));
    await p.locator('.glance-link[href="#role-ck-arch"]').click();
    await p.waitForTimeout(1700);
    const gl1 = await arrival(p, '#role-ck-arch');
    const gslide = await p.evaluate(() => window.jQuery('#owl-slider-work').data('owlCarousel').currentItem);
    g.check(gslide === 4 && gl1.inView && gl1.top >= gl1.bar + 8 && gl1.top <= 320 && gl1.spot && gl1.hash === '#role-ck-arch', `[${L}] a glance row opens its slide (Data Architect = slide 5), lands clear of the fixed bar and is highlighted`, JSON.stringify({ gslide, gl1 }));
    await p.evaluate(() => { const a = document.querySelector('.glance-link[href="#role-fb-de"]'); a.scrollIntoView({ block: 'center' }); a.focus(); });
    await p.keyboard.press('Enter');
    await p.waitForTimeout(1700);
    const gslide2 = await p.evaluate(() => window.jQuery('#owl-slider-work').data('owlCarousel').currentItem);
    g.check(gslide2 === 2, `[${L}] Enter on a glance row opens its slide too (Data Engineer = slide 3)`, 'slide=' + gslide2);
    await p.evaluate(() => window.jQuery('#owl-slider-work').trigger('owl.jumpTo', 0));
    // contact: two paths (hiring / projects), each with its own e-mail link whose subject is in the page language
    const SUBJECTS = { en: ['Opportunity', 'Project'], pt: ['Oportunidade', 'Projeto'], es: ['Oportunidad', 'Proyecto'] };
    const paths = await p.evaluate(() => [...document.querySelectorAll('#contact .contact-path')].map((a) => ({ title: a.querySelector('h3').textContent, desc: a.querySelector('p').textContent, btn: a.querySelector('a.button').textContent, href: decodeURIComponent(a.querySelector('a.button').getAttribute('href')), kind: a.querySelector('a.button').getAttribute('data-contact') })));
    const wantPaths = [['contact.hire.title', 'contact.hire.desc', 'contact.hire.btn', 'hiring'], ['contact.project.title', 'contact.project.desc', 'contact.project.btn', 'projects']];
    const pathsOk = paths.length === 2 && paths.every((x, i) => x.title === dict[lang][wantPaths[i][0]] && x.desc === dict[lang][wantPaths[i][1]] && x.btn === dict[lang][wantPaths[i][2]] && x.kind === wantPaths[i][3] && x.href === `mailto:franklinfs390@gmail.com?subject=${SUBJECTS[lang][i]}`);
    g.check(pathsOk, `[${L}] contact has two paths (hiring, projects), each with its own e-mail link and a ${L} subject line`, JSON.stringify(paths));
    // early projects: closed by default (all 13 stay in the HTML), and the carousel is measured when it opens
    const ep0 = await p.evaluate(() => { const d = document.querySelector('.early-projects'); return { open: d.open, slides: d.querySelectorAll('.folio-wrapper').length, label: d.querySelector('summary').textContent }; });
    ep0.visible = await p.locator('#owl-slider-port').isVisible();
    g.check(!ep0.open && !ep0.visible && ep0.slides === 13 && ep0.label === dict[lang]['projects.toggle'], `[${L}] early projects: collapsed by default, 13 projects in the page, button says "${ep0.label}"`, JSON.stringify(ep0));
    // Chrome still measures a closed <details>; engines that give it no layout (display none) measure 0. Reproduce that case: hide the
    // carousel while the section is closed and re-measure it there, exactly as happens when the page loads in such an engine.
    await p.addStyleTag({ content: '.early-projects:not([open]) > #owl-slider-port { display: none !important; }' });
    await p.evaluate(() => window.jQuery('#owl-slider-port').data('owlCarousel').reload());
    // (a) main.js re-measures the carousel when the section opens: checked once (EN) on a page of its own, below
    // (b) the real click path, from a closed and collapsed state
    await p.click('.early-projects > summary');
    await p.waitForTimeout(900);
    const ep1 = await p.evaluate(() => { const c = document.querySelector('#owl-slider-port'); const w = c.querySelector('.owl-wrapper-outer').getBoundingClientRect().width; return { open: document.querySelector('.early-projects').open, outerW: Math.round(w), itemW: Math.round(c.querySelector('.owl-item').getBoundingClientRect().width) }; });
    g.check(ep1.open && ep1.outerW > 200 && ep1.itemW > 150 && ep1.itemW <= ep1.outerW, `[${L}] opening it shows the carousel with real measures (slider ${ep1.outerW}px, slide ${ep1.itemW}px), not a collapsed one`, JSON.stringify(ep1));
    if (lang === 'en') {
      // (a) main.js itself re-measures the carousel when the section opens. Owl 1.3 also has a visibility watcher (a 500 ms timer) that would
      // repair a collapsed carousel later, so it is switched off here: only the handler in main.js can make the measure right within 300 ms.
      const ctxA = await env.browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await ctxA.route(/googletagmanager|google-analytics/, (r) => r.abort());
      await ctxA.addInitScript(() => { const si = window.setInterval; window.setInterval = function (fn, ms) { return ms === 500 ? 0 : si.apply(this, arguments); }; });
      const pa = await ctxA.newPage();
      await pa.goto(`${env.base}/?lang=en`, { waitUntil: 'load' });
      await pa.waitForTimeout(1500);
      await pa.addStyleTag({ content: '.early-projects:not([open]) > #owl-slider-port { display: none !important; }' });
      await pa.evaluate(() => window.jQuery('#owl-slider-port').data('owlCarousel').reload()); // measured while hidden, as in an engine that gives a closed <details> no layout
      await pa.waitForTimeout(200);
      await pa.click('.early-projects > summary');
      await pa.waitForTimeout(300);
      const epa = await pa.evaluate(() => ({ itemW: Math.round(document.querySelector('#owl-slider-port .owl-item').getBoundingClientRect().width) }));
      await ctxA.close();
      g.check(epa.itemW > 150, `[EN] opening the early projects makes main.js measure their carousel right away (slide ${epa.itemW}px; Owl's own 0.5 s watcher is off in this check)`, JSON.stringify(epa));
    }
    // every carousel: initialised with the expected slides, pagination moves it
    const CAROUSELS = [['#owl-slider-work', 7], ['#owl-slider-cert', 8], ['#owl-slider-extra', 3], ['#owl-slider', 8], ['#owl-slider-port', 13]];
    for (const [sel, n] of CAROUSELS) {
      const info = await p.evaluate((q) => { const o = window.jQuery(q).data('owlCarousel'); return o ? { items: o.itemsAmount, pages: window.jQuery(q).find('.owl-page').length } : null; }, sel);
      g.check(info && info.items === n && info.pages >= 1, `[${L}] carousel ${sel} initialised with ${n} slides (${info ? info.pages : 0} pages)`, JSON.stringify(info));
      // arrows: present, button semantics, accessible name in the active language, work with mouse and keyboard
      const ar = await p.evaluate((q) => {
        const $c = window.jQuery(q);
        const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.right <= document.documentElement.clientWidth + 1; };
        const prev = $c.find('.owl-prev')[0], next = $c.find('.owl-next')[0];
        return prev && next ? { prevName: prev.textContent.trim(), nextName: next.textContent.trim(), role: prev.getAttribute('role') + '/' + next.getAttribute('role'), tab: prev.tabIndex + '/' + next.tabIndex, inView: vis(prev) && vis(next) } : null;
      }, sel);
      g.check(ar && ar.prevName === dict[lang]['carousel.prev'] && ar.nextName === dict[lang]['carousel.next'] && ar.role === 'button/button' && ar.tab === '0/0' && ar.inView,
        `[${L}] carousel ${sel}: prev/next arrows are visible buttons named "${dict[lang]['carousel.prev']}" / "${dict[lang]['carousel.next']}"`, JSON.stringify(ar));
      if (ar) {
        await p.locator(sel + ' .owl-next').scrollIntoViewIfNeeded();
        await p.locator(sel + ' .owl-next').click({ force: true });
        await p.waitForTimeout(600);
        const afterNext = await p.evaluate((q) => window.jQuery(q).data('owlCarousel').currentItem, sel);
        await p.locator(sel + ' .owl-prev').click({ force: true });
        await p.waitForTimeout(600);
        const afterPrev = await p.evaluate((q) => window.jQuery(q).data('owlCarousel').currentItem, sel);
        await p.focus(sel + ' .owl-next');
        await p.keyboard.press('Enter');
        await p.waitForTimeout(600);
        const afterKey = await p.evaluate((q) => window.jQuery(q).data('owlCarousel').currentItem, sel);
        g.check(afterNext === 1 && afterPrev === 0 && afterKey === 1, `[${L}] carousel ${sel}: next arrow → slide 2, prev arrow → slide 1, Enter on focused next arrow advances`, `next=${afterNext} prev=${afterPrev} key=${afterKey}`);
        await p.evaluate((q) => window.jQuery(q).trigger('owl.jumpTo', 0), sel);
        await p.waitForTimeout(300);
      }
      if (info && info.pages > 1) {
        await p.locator(sel + ' .owl-page').nth(1).scrollIntoViewIfNeeded();
        await p.locator(sel + ' .owl-page').nth(1).click({ force: true });
        await p.waitForTimeout(600);
        const cur = await p.evaluate((q) => window.jQuery(q).data('owlCarousel').currentItem, sel);
        g.check(cur > 0, `[${L}] carousel ${sel}: pagination dot moves the slider`, 'currentItem=' + cur);
        await p.evaluate((q) => window.jQuery(q).trigger('owl.jumpTo', 0), sel);
        await p.waitForTimeout(300);
      }
    }
    // modal
    await p.evaluate(() => window.jQuery('#owl-slider-port').trigger('owl.jumpTo', 0));
    await p.waitForTimeout(500);
    await p.locator('#portfolio .item-wrap a.overlay').first().click({ force: true });
    await p.waitForSelector('.mfp-content', { state: 'visible', timeout: 5000 }).catch(() => {});
    const modal = await p.evaluate(() => { const c = document.querySelector('.mfp-content'); return c ? c.textContent.replace(/\s+/g, ' ').trim() : ''; });
    g.check(modal.includes(dict[lang]['projects.p13.desc'].slice(0, 50)) && modal.includes(dict[lang]['projects.view']), `[${L}] project modal opens with ${L} description and buttons`, modal.slice(0, 160));
    await p.locator('.popup-modal-dismiss').first().click({ force: true });
    await p.waitForTimeout(500);
    // navigation (desktop: inline links in the bar)
    const toggleShown = await p.isVisible('.menu-toggle');
    g.check(!toggleShown && await p.isVisible('.main-navigation'), `[${L}] desktop: all links are visible in the bar and there is no hamburger`);
    const navText = await p.evaluate(() => [...document.querySelectorAll('.main-navigation a')].map((a) => a.textContent));
    g.check(navText.join('|') === ['nav.home', 'nav.about', 'nav.impact', 'nav.experience', 'nav.work', 'nav.expertise', 'nav.contact'].map((k) => dict[lang][k]).join('|'), `[${L}] nav labels are in ${L}`, navText.join('|'));
    const navLabel = await p.getAttribute('#main-nav-wrap', 'aria-label');
    g.check(navLabel === dict[lang]['a11y.nav'], `[${L}] the <nav> landmark is named "${dict[lang]['a11y.nav']}"`, String(navLabel));
    await p.click('.main-navigation a[href="#resume"]');
    await p.waitForTimeout(1500);
    const spy = await p.evaluate(() => { const c = document.querySelector('#main-nav-wrap li.current a'); return c ? c.getAttribute('href') : null; });
    g.check(spy === '#resume', `[${L}] scroll-spy highlights the visited section`, String(spy));
    const under = await p.evaluate(() => ({ bar: document.querySelector('.site-header').getBoundingClientRect().bottom, top: document.querySelector('#resume .eyebrow').getBoundingClientRect().top }));
    g.check(under.top >= under.bar, `[${L}] after jumping to a section its heading is not hidden under the fixed bar (heading ${Math.round(under.top)}px, bar ends ${Math.round(under.bar)}px)`);
    const stuck = await p.evaluate(() => document.querySelector('.site-header').getBoundingClientRect().top);
    g.check(stuck === 0, `[${L}] the bar stays pinned to the top while scrolling`, 'top=' + stuck);
    // counters (animation enabled in this context)
    await p.evaluate(() => document.getElementById('impact').scrollIntoView());
    await p.waitForTimeout(3600);
    const stats = await p.evaluate(() => [...document.querySelectorAll('.stat-count')].map((e) => [e.textContent, (e.getAttribute('data-prefix') || '') + e.getAttribute('data-count') + (e.getAttribute('data-suffix') || '')]));
    g.check(stats.length === 6 && stats.every(([got, want]) => got === want), `[${L}] impact counters finish exactly on their final values`, JSON.stringify(stats));
    const expectedTokens = ['>50%', '~3x', '~50', '10+', '100+', '15+'];
    g.check(stats.map((x) => x[0]).join(' ') === expectedTokens.join(' '), `[${L}] counters equal the ledger metrics`, stats.map((x) => x[0]).join(' '));
    // switching language while a section is scrolled must not throw and keeps owl alive
    await p.click(`.lang-btn[data-lang="${lang === 'en' ? 'pt' : 'en'}"]`);
    await p.waitForTimeout(500);
    const owl2 = await p.evaluate((list) => list.map(([q]) => { const o = window.jQuery(q).data('owlCarousel'); return o ? o.itemsAmount : -1; }), CAROUSELS);
    g.check(owl2.join() === CAROUSELS.map((c) => c[1]).join() && s.logs.errors.length === 0 && s.logs.console.length === 0, `[${L}] all carousels survive a language switch; no errors logged`, [...s.logs.errors, ...s.logs.console].join('\n'));
    await s.close();
  }

  // 9b) selected work: filters, header bar (brand, dropdown on small screens), contact + footer alignment
  for (const lang of LANGS) {
    const L = lang.toUpperCase();
    const s = await env.open(lang);
    const p = s.page;
    // filters
    const total = await p.locator('.case-card').count();
    g.check(total === 12, `[${L}] twelve case-study cards are rendered`, 'cards=' + total);
    const expectedBy = { all: 12, platform: 3, reliability: 4, governance: 3, analytics: 2 };
    let ok = true; const seen = [];
    for (const [f, n] of Object.entries(expectedBy)) {
      await p.evaluate(() => document.querySelector('.case-filters').scrollIntoView({ block: 'center' }));
      await p.click(`.case-filter[data-filter="${f}"]`);
      await p.waitForTimeout(150);
      const st = await p.evaluate(() => ({ vis: [...document.querySelectorAll('.case-card')].filter((c) => getComputedStyle(c).display !== 'none').length, pressed: [...document.querySelectorAll('.case-filter')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.filter), status: document.getElementById('case-status').textContent, lead: (() => { const e = document.querySelector('.case-group'); return !!e && getComputedStyle(e).display !== 'none'; })() }));
      const wantStatus = dict[lang]['work.filter.showing'].replace('{n}', n).replace('{total}', 12);
      seen.push(f + ':' + st.vis);
      // the lead-in before the decision cards shows only while at least one of them is visible (platform, reliability and governance each have one; analytics has none)
      if (st.vis !== n || st.pressed.join() !== f || st.status !== wantStatus || st.lead !== (f !== 'analytics')) { ok = false; seen.push(JSON.stringify(st)); }
    }
    g.check(ok, `[${L}] filters show the right cards, set aria-pressed and announce the count (${seen.join(' ')})`, seen.join(' '));
    // the filter bar must not jump after filtering (page shrinks)
    await p.evaluate(() => { const y = document.querySelector('.case-filters').getBoundingClientRect().top; window.scrollBy(0, y - 140); });
    await p.waitForTimeout(150);
    const top0 = await p.evaluate(() => Math.round(document.querySelector('.case-filters').getBoundingClientRect().top));
    await p.click('.case-filter[data-filter="governance"]');
    await p.waitForTimeout(200);
    const top1 = await p.evaluate(() => Math.round(document.querySelector('.case-filters').getBoundingClientRect().top));
    g.check(Math.abs(top1 - top0) <= 2, `[${L}] the filter bar stays in place on screen after filtering (${top0} → ${top1})`);
    await p.click('.case-filter[data-filter="all"]');
    // every card has an icon, a title and equal-height grid rows (no card shorter than its row)
    const cardInfo = await p.evaluate(() => [...document.querySelectorAll('.case-card')].map((c) => ({ ico: !!c.querySelector('.case-ico i'), h3: c.querySelector('h3').textContent.length > 3, num: getComputedStyle(c, '::after').content })));
    g.check(cardInfo.every((c) => c.ico && c.h3 && /^"(0[1-9]|1[0-2])"$/.test(c.num)), `[${L}] each card has icon, title and its decorative number`, JSON.stringify(cardInfo.slice(0, 2)));
    // the decision records are full-width cards with four labelled blocks, placed after the story cards (a lone card would sit in a 3-column grid with empty slots)
    const dec = await p.evaluate(() => {
      const grid = document.querySelector('.case-grid'), gr = grid.getBoundingClientRect();
      const cards = [...document.querySelectorAll('.case-card')];
      const wide = cards.filter((c) => c.classList.contains('case-wide'));
      return {
        ids: wide.map((c) => c.id),
        tail: wide.length > 0 && cards.slice(-wide.length).every((c) => c.classList.contains('case-wide')),
        cards: wide.map((c) => {
          const r = c.getBoundingClientRect();
          const labels = [...c.querySelectorAll('.case-label')].map((x) => x.textContent.trim());
          return { id: c.id, full: Math.abs(r.width - gr.width) <= 2, blocks: c.querySelectorAll('.case-cols > .case-block').length, labels, stack: [...c.querySelectorAll('.case-stack li')].map((x) => x.textContent).join() };
        }),
      };
    });
    const stacks = { 'case-why-databricks': 'Databricks,Unity Catalog,FinOps', 'case-finops-decision': 'Databricks,FinOps', 'case-uc-decision': 'Databricks,Unity Catalog' };
    g.check(dec.ids.join() === 'case-why-databricks,case-finops-decision,case-uc-decision' && dec.tail && dec.cards.every((c) => c.full && c.blocks === 4 && c.labels.every((x) => x.length > 8) && new Set(c.labels).size === 4 && c.stack === stacks[c.id]), `[${L}] the three decision cards (why Databricks, FinOps trade-offs, Unity Catalog by domain) span the whole grid, have 4 distinct labelled blocks and come last`, JSON.stringify(dec));
    await s.close();
  }
  for (const w of [1280, 1024, 768, 375, 320]) {
    const s = await env.open('pt', { width: w });
    const p = s.page;
    // the bar must never cover page content below it: the hero starts under it, and a click in the middle of the strip reaches the bar itself
    const hd = await p.evaluate(() => {
      const bar = document.querySelector('.site-header').getBoundingClientRect();
      const midY = bar.bottom / 2;
      const hit = document.elementFromPoint(document.documentElement.clientWidth / 2, midY);
      const below = document.elementFromPoint(document.documentElement.clientWidth / 2, bar.bottom + 4);
      return { barBottom: bar.bottom, inBar: !!(hit && hit.closest('.site-header')), belowInBar: !!(below && below.closest('.site-header')), name: document.querySelector('.brand-name').textContent, nameVisible: getComputedStyle(document.querySelector('.brand-name')).display !== 'none' };
    });
    g.check(hd.inBar && !hd.belowInBar && hd.name === 'Franklin Ferreira', `[${w}px] the bar is solid, ends where it should and carries the name (translate="no")`, JSON.stringify(hd));
    if (w < 960) {
      // small screens: the hamburger opens a dropdown, choosing an item closes it again
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.click('.menu-toggle');
      await p.waitForTimeout(600);
      const op = await p.evaluate(() => ({ exp: document.querySelector('.menu-toggle').getAttribute('aria-expanded'), vis: getComputedStyle(document.querySelector('.main-navigation')).display !== 'none', bg: getComputedStyle(document.querySelector('.main-navigation')).backgroundColor, r: document.querySelector('.main-navigation').getBoundingClientRect().toJSON() }));
      g.check(op.exp === 'true' && op.vis && op.bg === 'rgb(18, 18, 18)' && Math.abs(op.r.width - w) <= 1, `[${w}px] hamburger opens an opaque full-width dropdown (aria-expanded=true)`, JSON.stringify(op));
      await p.keyboard.press('Escape');
      await p.waitForTimeout(600);
      const esc = await p.evaluate(() => ({ exp: document.querySelector('.menu-toggle').getAttribute('aria-expanded'), vis: getComputedStyle(document.querySelector('.main-navigation')).display !== 'none', focus: document.activeElement === document.querySelector('.menu-toggle') }));
      g.check(esc.exp === 'false' && !esc.vis && esc.focus, `[${w}px] Escape closes the dropdown and returns focus to the menu button`, JSON.stringify(esc));
      await p.click('.menu-toggle');
      await p.waitForTimeout(600);
      await p.click('.main-navigation a[href="#contact"]');
      await p.waitForTimeout(1500);
      const cl = await p.evaluate(() => ({ exp: document.querySelector('.menu-toggle').getAttribute('aria-expanded'), vis: getComputedStyle(document.querySelector('.main-navigation')).display !== 'none' }));
      g.check(cl.exp === 'false' && !cl.vis, `[${w}px] choosing an item closes the dropdown and scrolls to the section`, JSON.stringify(cl));
    }
    // contact + footer centred on the page
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(200);
    const al = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const cx = (els) => { const rs = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width); if (!rs.length) return null; const l = Math.min(...rs.map((r) => r.left)), r = Math.max(...rs.map((r) => r.right)); return Math.round((l + r) / 2); };
      const btns = [...document.querySelectorAll('.contact-actions .button')];
      const rows = new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top)));
      return { vw, btnCx: cx(btns), btnRows: rows.size, socialCx: cx([...document.querySelectorAll('footer .footer-social li')]), copyCx: cx([...document.querySelectorAll('footer .copyright > span')]), placeCx: cx([document.querySelector('.contact-place')]) };
    });
    const mid = al.vw / 2;
    const rowsOk = al.btnRows === 1 ? Math.abs(al.btnCx - mid) <= 8 : true; // wrapped rows are centred individually by text-align
    g.check(rowsOk && Math.abs(al.socialCx - mid) <= 8 && Math.abs(al.copyCx - mid) <= 8, `[${w}px] contact buttons, footer icons and copyright are centred on the page (centres ${al.btnCx}/${al.socialCx}/${al.copyCx} vs ${mid})`, JSON.stringify(al));
    await s.close();
  }

  // 10) no horizontal overflow, every language × width
  for (const lang of LANGS) for (const w of [320, 375, 768, 1024, 1280, 1920]) {
    const s = await env.open(lang, { width: w });
    const o = await s.page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('.owl-wrapper-outer, #preloader, .mfp-hide, .skip-link, .sr-only, .owl-controls')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.right > vw + 1) offenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} right=${Math.round(r.right)}`);
      }
      return { vw, sw: document.documentElement.scrollWidth, offenders: offenders.slice(0, 6) };
    });
    g.check(o.sw <= o.vw && o.offenders.length === 0, `[${lang.toUpperCase()} ${w}px] no horizontal overflow`, `scrollWidth ${o.sw} vs ${o.vw}; ${o.offenders.join('; ')}`);
    await s.close();
  }
  // 11) phone layout: the folds (About, skills, Work, Experience), their buttons, jump links and deep links; nothing is hidden without JavaScript or on a wide screen
  const FOLDS = ['about-more', 'skills-more', 'work-more', 'exp-detail'];
  const foldState = (p) => p.evaluate((ids) => {
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    const btn = (id) => document.querySelector(`[data-fold-toggle="${id}"]`);
    return {
      about: [...document.querySelectorAll('.intro-info p.lead')].filter(vis).length,
      skills: [...document.querySelectorAll('.skill-group')].filter(vis).length,
      cards: [...document.querySelectorAll('.case-card')].filter(vis).length,
      lead: vis(document.querySelector('.case-group')),
      exp: vis(document.querySelector('#owl-slider-work')),
      btns: ids.map((i) => vis(btn(i)) + ':' + btn(i).getAttribute('aria-expanded')).join(' '),
      label: ids.map((i) => btn(i).innerText.trim()),
    };
  }, FOLDS);
  for (const lang of LANGS) {
    const L = lang.toUpperCase();
    const s = await env.open(lang, { width: 375 });
    const p = s.page;
    const a = await foldState(p);
    g.check(a.about === 2 && a.skills === 3 && a.cards === 4 && !a.lead && !a.exp && a.btns === 'true:false true:false true:false true:false', `[${L} 375px] on a phone the page starts folded: 2 About paragraphs, 3 skill groups, 4 case cards, no role carousel, four collapsed buttons`, JSON.stringify(a));
    const press = async (id) => { await p.locator(`[data-fold-toggle="${id}"]`).click(); await p.waitForTimeout(350); };
    for (const id of FOLDS) await press(id);
    const b = await foldState(p);
    g.check(b.about === 5 && b.skills === 8 && b.cards === 12 && b.lead && b.exp && b.btns === 'true:true true:true true:true true:true' && b.label.every((x, i) => x !== a.label[i]), `[${L} 375px] the four buttons open everything, flip aria-expanded and change their label`, JSON.stringify(b));
    const carousel = await p.evaluate(() => { const o = window.jQuery('#owl-slider-work').data('owlCarousel'); const r = document.querySelector('#owl-slider-work').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), cur: o.currentItem }; });
    g.check(carousel.w > 300 && carousel.h > 300 && carousel.cur === 0, `[${L} 375px] the role carousel is full width and on the first role when it opens`, JSON.stringify(carousel));
    for (const id of FOLDS) await press(id);
    const c = await foldState(p);
    g.check(c.about === 2 && c.skills === 3 && c.cards === 4 && !c.exp && c.btns === 'true:false true:false true:false true:false', `[${L} 375px] a second press folds each block again`, JSON.stringify(c));
    await s.close();
  }
  {
    // jump links and deep links land on something visible
    const s = await env.open('en', { width: 375 });
    const p = s.page;
    await p.locator('#impact .stat-link[href="#case-cicd"]').evaluate((el) => el.click()); // card 5 is folded away on a phone
    await p.waitForTimeout(1500);
    const v1 = await p.evaluate(() => { const c = document.querySelector('#case-cicd'); const r = c.getBoundingClientRect(); return { shown: getComputedStyle(c).display !== 'none' && r.height > 0, inView: r.top < innerHeight && r.bottom > 0 }; });
    g.check(v1.shown && v1.inView, '[EN 375px] an Impact number that points to a folded case card unfolds the grid and shows that card', JSON.stringify(v1));
    await p.locator('.glance-link[href="#role-ck-arch"]').evaluate((el) => el.click()); // the role carousel is folded away on a phone
    await p.waitForTimeout(1800);
    const v2 = await p.evaluate(() => { const o = window.jQuery('#owl-slider-work').data('owlCarousel'); const r = document.querySelector('#owl-slider-work').getBoundingClientRect(); return { slide: o.currentItem, h: Math.round(r.height), btn: document.querySelector('[data-fold-toggle="exp-detail"]').getAttribute('aria-expanded') }; });
    g.check(v2.slide === 4 && v2.h > 300 && v2.btn === 'true', '[EN 375px] a row of the career table opens the role carousel on that role (Data Architect)', JSON.stringify(v2));
    await s.close();
    const f = await env.open('en', { width: 375 });
    await f.page.locator('.case-filter[data-filter="governance"]').click();
    await f.page.waitForTimeout(400);
    const v3 = await foldState(f.page);
    g.check(v3.cards === 3 && v3.btns.split(' ')[2] === 'true:true', '[EN 375px] choosing a theme in Work shows every card of that theme (3 governance cards) and opens the grid', JSON.stringify(v3));
    await f.close();
    const d = await env.open('en', { width: 375, hash: '#case-cicd', wait: true });
    await d.page.waitForTimeout(800);
    const v4 = await d.page.evaluate(() => { const c = document.querySelector('#case-cicd'); const r = c.getBoundingClientRect(); return { shown: getComputedStyle(c).display !== 'none' && r.height > 0, top: Math.round(r.top) }; });
    g.check(v4.shown, '[EN 375px] a link that points straight at a folded card (/#case-cicd) opens it', JSON.stringify(v4));
    await d.close();
  }
  {
    // wide screens and no-JavaScript visitors never see a fold or a button
    const w = await env.open('en', { width: 1280 });
    const wide = await foldState(w.page);
    g.check(wide.about === 5 && wide.skills === 8 && wide.cards === 12 && wide.lead && wide.exp && wide.btns === 'false:false false:false false:false false:false', '[EN 1280px] on a wide screen everything is shown and the four buttons are hidden', JSON.stringify(wide));
    await w.close();
    const context = await env.browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
    const page = await context.newPage();
    await page.goto(env.base + '/', { waitUntil: 'load' });
    const nojs = await foldState(page);
    g.check(nojs.about === 5 && nojs.skills === 8 && nojs.cards === 12 && nojs.lead && nojs.btns === 'false:false false:false false:false false:false', '[EN 375px] without JavaScript a phone shows everything and no fold button', JSON.stringify(nojs));
    await context.close();
  }

  // 12) hero: one main button, the three proof numbers, the icons in the flow, and nothing overlapping on any screen height
  for (const [width, height] of [[1280, 720], [1440, 900], [768, 1024], [375, 740], [375, 667], [320, 568]]) {
    const s = await env.open('en', { width, height });
    const h = await s.page.evaluate(() => {
      const r = (q) => document.querySelector(q).getBoundingClientRect();
      const hd = r('.site-header'), eb = r('#intro .eyebrow'), about = r('#intro a.smoothscroll'), cv = r('#intro .hero-cta'), proof = r('.intro-proof'), soc = r('.intro-social'), hero = r('#intro');
      const cs = (q) => getComputedStyle(document.querySelector(q));
      return {
        clearOfHeader: eb.top >= hd.bottom + 8, order: about.bottom <= proof.top && cv.bottom <= proof.top && proof.bottom <= soc.top + 1, insideHero: soc.bottom <= hero.bottom + 1,
        cv: cs('#intro .hero-cta').backgroundColor, ghost: cs('#intro a.smoothscroll').backgroundColor, hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    g.check(h.clearOfHeader && h.order && h.insideHero && !h.hscroll, `[EN ${width}x${height}] hero: the text starts below the bar, buttons, proof strip and icons stack without overlapping, and the icons stay inside the hero`, JSON.stringify(h));
    if (width === 1280) g.check(h.cv === 'rgb(204, 0, 95)' && h.ghost === 'rgba(0, 0, 0, 0)', '[EN] hero: "Download CV" is the one solid button and "About me" stays outlined', JSON.stringify({ cv: h.cv, ghost: h.ghost }));
    await s.close();
  }
  for (const lang of LANGS) {
    const s = await env.open(lang, { width: 1280 });
    const nums = await s.page.evaluate(() => [...document.querySelectorAll('.intro-proof li')].map((li) => [li.querySelector('.intro-proof-num').textContent.trim(), li.querySelector('.intro-proof-cap').textContent.trim()]));
    const want = [['>50%', dict[lang]['case.metric.cost']], ['~50', dict[lang]['case.metric.sources']], ['15+', dict[lang]['hero.proof.team']]];
    const impact = await s.page.evaluate(() => ['#impact .stat-count'].flatMap((q) => [...document.querySelectorAll(q)].map((e) => e.textContent.trim())));
    g.check(JSON.stringify(nums) === JSON.stringify(want) && want.every(([n]) => impact.includes(n)), `[${lang.toUpperCase()} 1280px] hero proof strip: the same three numbers as the Impact section (>50%, ~50, 15+), each with its translated caption`, JSON.stringify({ nums, impact }));
    await s.close();
  }

  return g;
}
