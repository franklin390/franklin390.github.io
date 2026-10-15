// G14 — Static language pages (/pt/ and /es/): Google can index PT and ES as real URLs.
//  - the generated files are current (rebuilt from index.html + dictionaries they come out identical) and so is sitemap.xml
//  - every page has its own canonical, a complete hreflang cluster, og:url/locale, title, description, JSON-LD url, one <h1>
//  - relative URLs were rewritten for the sub-folder and all resolve
//  - the text a visitor with NO JavaScript (or a crawler before rendering) sees is exactly what the language engine produces
//  - in a browser: nothing 404s, nothing logs an error, layout equals the ?lang= version, links and PDFs work,
//    the address decides the language (a saved choice does not override it), switching language in place still works
import fs from 'node:fs';
import path from 'node:path';
import { HtmlValidate } from 'html-validate';
import { Gate } from './lib/report.mjs';
import { ROOT, HTML_LANG, OG_LOCALE, existsExact, loadFacts } from './lib/common.mjs';
import { loadBoth } from './lib/dict.mjs';
import { getEnv, collectTextNodes } from './lib/browser.mjs';
import { HV_CONFIG } from './g1-static.mjs';
import { seo, urlOf, generateAll } from '../build-lang-pages.mjs';

export const id = 'G14';

const dec = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const read = (page) => fs.readFileSync(path.join(ROOT, page.file), 'utf8').replace(/\r\n/g, '\n');
const attr = (html, re) => { const m = html.match(re); return m ? dec(m[1]) : null; };

// text and attributes the language engine controls, in document order (clones made by the carousel are skipped)
const collectI18n = () => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const out = [];
  for (const el of document.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-attr],[data-date]')) {
    if (el.closest('.owl-item.cloned, .owl-buttons')) continue; // made by the carousel plugin at runtime, not part of the HTML
    const o = { id: [el.getAttribute('data-i18n'), el.getAttribute('data-i18n-html'), el.getAttribute('data-i18n-attr'), el.getAttribute('data-date')].join('|') };
    if (el.hasAttribute('data-i18n-html')) o.html = norm(el.innerHTML);
    else o.text = norm(el.textContent);
    if (el.hasAttribute('data-i18n-attr')) o.attrs = el.getAttribute('data-i18n-attr').split(';').map((p) => p.split(':')[0].trim()).map((a) => `${a}=${el.getAttribute(a)}`);
    out.push(o);
  }
  return out;
};

const settle = async (page) => {
  for (let y = 0; y < 40000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(50); if (await page.evaluate(() => window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2)) break; }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
};

export async function run(ctx) {
  const g = new Gate('G14', 'Static language pages (/pt/, /es/), hreflang, sitemap');
  const env = await getEnv(ctx);
  const dict = loadBoth();
  const hv = new HtmlValidate(HV_CONFIG);
  const facts = loadFacts();
  const clusterExpected = [...seo.pages.map((p) => `${p.hreflang} ${urlOf(p)}`), `x-default ${seo.origin + seo.xDefault}`].sort();
  const staticPages = seo.pages.filter((p) => p.lang !== 'en');

  // ---------------------------------------------------------------- 1) the generated files are current
  const generated = await generateAll(env.browser, env.base);
  for (const [file, content] of Object.entries(generated)) {
    const p = path.join(ROOT, file);
    const have = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
    g.check(have === content, `${file} is exactly what the generator builds from index.html and the dictionaries`, have === null ? 'file missing' : 'out of date: run  node build-lang-pages.mjs  (npm run build:pages)');
  }

  // ---------------------------------------------------------------- 2) per-page head and structure (English root included)
  for (const page of seo.pages) {
    const L = page.lang;
    const tag = `[${L.toUpperCase()} ${page.path}]`;
    if (!fs.existsSync(path.join(ROOT, page.file))) { g.fail(`${tag} file ${page.file} is missing`); continue; }
    const html = read(page);
    const htmlTag = (html.match(/<html\b[^>]*>/) || [''])[0];
    const langOk = L === 'en' ? /\slang="en"/.test(htmlTag) && !/data-page-lang/.test(htmlTag) : htmlTag.includes(`lang="${HTML_LANG[L]}"`) && htmlTag.includes(`data-lang="${L}"`) && htmlTag.includes(`data-page-lang="${L}"`);
    g.check(langOk, `${tag} <html> carries the page language (lang, data-lang${L === 'en' ? '' : ', data-page-lang'})`, htmlTag);
    g.check(attr(html, /<link rel="canonical" href="([^"]*)"/) === urlOf(page), `${tag} canonical points to the page itself (${urlOf(page)})`, String(attr(html, /<link rel="canonical" href="([^"]*)"/)));
    const cluster = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]*)"/g)].map((m) => `${m[1]} ${m[2]}`).sort();
    g.check(JSON.stringify(cluster) === JSON.stringify(clusterExpected), `${tag} hreflang cluster is complete and identical on every page (en, pt-BR, es + x-default, itself included)`, cluster.join(' | '));
    g.check(attr(html, /property="og:url" content="([^"]*)"/) === urlOf(page), `${tag} og:url equals the canonical`);
    g.check(attr(html, /property="og:locale" content="([^"]*)"/) === OG_LOCALE[L], `${tag} og:locale is ${OG_LOCALE[L]}`);
    g.check(attr(html, /<title[^>]*>([^<]*)<\/title>/) === dict[L]['meta.title'], `${tag} <title> is the ${L.toUpperCase()} title already in the HTML (no JavaScript needed)`);
    g.check(attr(html, /<meta name="description" content="([^"]*)"/) === dict[L]['meta.description'], `${tag} meta description is the ${L.toUpperCase()} text already in the HTML`);
    g.check(/<meta name="robots" content="[^"]*\bindex\b[^"]*"/.test(html) && !/noindex/i.test(html), `${tag} robots meta allows indexing`);
    const h1 = (html.match(/<h1\b/g) || []).length;
    g.check(h1 === 1, `${tag} exactly one <h1> (${h1})`);
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    let ldOk = false;
    try { const j = JSON.parse(ld[1]); ldOk = j['@type'] === 'Person' && j.url === urlOf(page); } catch (e) { /* reported below */ }
    g.check(ldOk, `${tag} JSON-LD Person with url ${urlOf(page)}`);
    g.check((html.match(/<script src=/g) || []).length === 8, `${tag} same 8 script tags as the source page`);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    g.check(new Set(ids).size === ids.length, `${tag} element ids are unique`);
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    g.check(imgs.length > 0 && imgs.every((i) => /\swidth="\d+"/.test(i) && /\sheight="\d+"/.test(i)), `${tag} every <img> has width and height (no layout shift while images load)`, imgs.filter((i) => !/\swidth=/.test(i)).slice(0, 2).join('\n'));

    if (L !== 'en') {
      // relative URLs must have been rewritten for the sub-folder, and must resolve (case-sensitive, as on GitHub Pages)
      const refs = [...html.matchAll(/\s(?:src|href|data-href-en|data-href-pt|data-href-es)="([^"]*)"/g)].map((m) => dec(m[1]));
      const rel = refs.filter((v) => v && !/^([a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(v));
      const notUp = rel.filter((v) => !v.startsWith('../'));
      g.check(notUp.length === 0, `${tag} every relative URL starts with ../ (the page lives one folder down)`, [...new Set(notUp)].slice(0, 5).join(', '));
      const dir = path.posix.dirname(page.file);
      const missing = [...new Set(rel)].filter((v) => !existsExact(ROOT, path.posix.normalize(path.posix.join(dir, decodeURIComponent(v.split(/[?#]/)[0])))));
      g.check(missing.length === 0, `${tag} all ${new Set(rel).size} relative URLs resolve to existing files`, missing.slice(0, 6).join(', '));
      const rep = await hv.validateString(html, page.file);
      const errs = rep.results.flatMap((r) => r.messages).filter((m) => m.severity === 2);
      g.check(errs.length === 0, `${tag} html-validate: no errors`, errs.slice(0, 8).map((m) => `L${m.line} [${m.ruleId}] ${m.message}`).join('\n'));
      // the same forbidden/private strings as G1 must not slip in through the generated copy
      const visible = html.replace(/<script[\s\S]*?<\/script>/g, '');
      const hits = facts.forbidden.patterns.filter((f) => f.scope === 'site' || f.scope === 'all').filter((f) => new RegExp(f.re, 'i').test(visible)).map((f) => f.re);
      g.check(hits.length === 0, `${tag} none of the forbidden / private patterns of G1 appears (phone, birth date, full legal name, old titles)`, hits.join(', '));
    }
  }

  // ---------------------------------------------------------------- 3) sitemap and robots
  {
    const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    g.check(JSON.stringify(locs) === JSON.stringify(seo.pages.map(urlOf)), 'sitemap.xml lists the three language URLs (and nothing with ?lang=)', locs.join(', '));
    const blocks = sm.split('<url>').slice(1);
    g.check(blocks.length === seo.pages.length && blocks.every((b) => JSON.stringify([...b.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`).sort()) === JSON.stringify(clusterExpected)), 'every sitemap entry lists all language alternates (hreflang) and x-default');
    g.check(seo.pages.every((p) => fs.existsSync(path.join(ROOT, p.file))), 'every sitemap URL is a real file in the repository');
    const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
    g.check(/^Sitemap:\s*https:\/\/franklin390\.github\.io\/sitemap\.xml\s*$/m.test(robots) && !/^Disallow:\s*\/\s*$/m.test(robots), 'robots.txt allows crawling and points to the sitemap');
  }

  // ---------------------------------------------------------------- 4) JavaScript off: the text is already there, equal to what the engine writes
  const runtime = {};
  for (const page of staticPages) {
    const L = page.lang;
    const tag = `[${L.toUpperCase()}]`;
    const live = await env.open(L, { width: 1280 });
    runtime[L] = { i18n: await live.page.evaluate(collectI18n), nodes: await live.page.evaluate(collectTextNodes), height: {} };
    await live.close();

    const off = await env.browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    const op = await off.newPage();
    await op.goto(`${env.base}/${page.path.slice(1)}`, { waitUntil: 'load' });
    const stat = await op.evaluate(collectI18n);
    const nodes = await op.evaluate(collectTextNodes);
    await off.close();
    const a = stat, b = runtime[L].i18n;
    const diffs = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) diffs.push(`#${i} static ${JSON.stringify(a[i])?.slice(0, 110)}  vs  engine ${JSON.stringify(b[i])?.slice(0, 110)}`);
    g.check(a.length > 150 && diffs.length === 0, `${tag} with JavaScript off, all ${a.length} translatable elements already show the ${L.toUpperCase()} text the engine would write`, diffs.slice(0, 3).join('\n'));
    const liveUncovered = new Set(runtime[L].nodes.filter((n) => !n.covered).map((n) => n.text));
    const leaks = nodes.filter((n) => !n.covered && !liveUncovered.has(n.text));
    g.check(leaks.length === 0, `${tag} with JavaScript off, no text is left outside the translation system`, leaks.slice(0, 4).map((n) => n.text.slice(0, 60)).join(' | '));
  }

  // ---------------------------------------------------------------- 5) in a browser
  for (const page of staticPages) {
    const L = page.lang;
    const tag = `[${L.toUpperCase()} ${page.path}]`;
    const s = await env.open(null, { width: 1280, path: page.path.slice(1) });
    const p = s.page;
    await p.waitForTimeout(800);
    await settle(p);
    const info = await p.evaluate(() => ({
      lang: document.documentElement.lang, dataLang: document.documentElement.getAttribute('data-lang'), path: location.pathname, search: location.search,
      pressed: [...document.querySelectorAll('.lang-btn')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.lang),
      headerPos: getComputedStyle(document.querySelector('.site-header')).position, height: document.documentElement.scrollHeight,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.offsetParent !== null).map((i) => i.getAttribute('src')),
      carousels: document.querySelectorAll('.owl-wrapper-outer').length,
    }));
    g.check(info.lang === HTML_LANG[L] && info.dataLang === L && info.pressed.join() === L, `${tag} opens in ${L.toUpperCase()} by itself (no ?lang=): html lang, data-lang and the pressed language button agree`, JSON.stringify(info));
    g.check(s.logs.failed.length === 0, `${tag} no request fails (all CSS, scripts, images and fonts load from the sub-folder)`, s.logs.failed.slice(0, 5).join('\n'));
    g.check(s.logs.console.length === 0 && s.logs.errors.length === 0, `${tag} no console error/warning and no script error`, [...s.logs.console, ...s.logs.errors].slice(0, 4).join('\n'));
    g.check(info.broken.length === 0, `${tag} every visible image loads`, info.broken.join(', '));
    g.check(info.headerPos === 'fixed' && info.carousels >= 5, `${tag} stylesheet and plugins work (fixed header, ${info.carousels} carousels initialised)`);

    // layout is the same as the ?lang= version of the English page
    const ref = await env.open(L, { width: 1280 });
    await settle(ref.page);
    const refH = await ref.page.evaluate(() => document.documentElement.scrollHeight);
    await ref.close();
    g.check(Math.abs(refH - info.height) <= 2, `${tag} page height equals the /?lang=${L} version (${info.height}px vs ${refH}px)`);

    // navigation and links stay on the page
    await p.locator('#main-nav-wrap a[href="#about"]').click();
    await p.waitForTimeout(900);
    const nav = await p.evaluate(() => ({ path: location.pathname, hash: location.hash }));
    g.check(nav.path === page.path && nav.hash === '#about', `${tag} an in-page link keeps the address on ${page.path} (${nav.path}${nav.hash})`);
    const files = await p.evaluate(async () => {
      const bad = [];
      const hrefs = [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => h.startsWith(location.origin) && !h.includes('#')))];
      for (const h of hrefs) { try { const r = await fetch(h, { method: 'HEAD' }); if (!r.ok) bad.push(r.status + ' ' + h); } catch (e) { bad.push('ERR ' + h); } }
      const cv = document.querySelector('#intro a[href$=".pdf"]');
      const r = await fetch(cv.href, { method: 'HEAD' });
      return { count: hrefs.length, bad, cv: cv.href, cvType: r.headers.get('content-type') };
    });
    g.check(files.bad.length === 0 && /Staff_Data_Engineer_CV_/.test(files.cv) && files.cv.endsWith(`_CV_${L.toUpperCase()}.pdf`) && /pdf/.test(files.cvType), `${tag} the ${files.count} same-site links (certificates, CV) answer 200 and the CV button downloads the ${L.toUpperCase()} CV`, files.bad.slice(0, 4).join(', ') + ' ' + files.cv);

    // the page announces itself to analytics as chosen by the address
    const ctxEv = await p.evaluate(() => window.dataLayer.find((x) => x && x.event === 'site_context'));
    g.check(ctxEv && ctxEv.site_language === L && ctxEv.language_source === 'url', `${tag} site_context reports site_language ${L} and language_source url`, JSON.stringify(ctxEv));

    // switching language in place still works and keeps the address tidy
    await p.locator('.lang-btn[data-lang="en"]').click();
    await p.waitForTimeout(900);
    const en = await p.evaluate(() => ({ path: location.pathname, search: location.search, lang: document.documentElement.lang, about: document.querySelector('[data-i18n="hero.btn.about"]').textContent, cv: document.querySelector('#intro a[href$=".pdf"]').href }));
    g.check(en.lang === 'en' && en.about === dict.en['hero.btn.about'] && en.path === page.path && en.search === '?lang=en' && en.cv.endsWith('_CV_EN.pdf'), `${tag} the EN button switches in place (text, CV link) and the address becomes ${page.path}?lang=en`, JSON.stringify(en));
    await p.locator(`.lang-btn[data-lang="${L}"]`).click();
    await p.waitForTimeout(900);
    const back = await p.evaluate(() => ({ search: location.search, about: document.querySelector('[data-i18n="hero.btn.about"]').textContent }));
    g.check(back.search === '' && back.about === dict[L]['hero.btn.about'], `${tag} switching back to ${L.toUpperCase()} restores the clean address ${page.path}`, JSON.stringify(back));
    await s.close();

    // phone width: same page height as the ?lang= version
    const m = await env.open(null, { width: 375, path: page.path.slice(1) });
    await settle(m.page);
    const mh = await m.page.evaluate(() => document.documentElement.scrollHeight);
    const hs = await m.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    await m.close();
    const mref = await env.open(L, { width: 375 });
    await settle(mref.page);
    const mrefH = await mref.page.evaluate(() => document.documentElement.scrollHeight);
    await mref.close();
    g.check(Math.abs(mh - mrefH) <= 2 && hs, `${tag} at 375px the page is as tall as the ?lang= version (${mh}px vs ${mrefH}px) and has no horizontal scroll`);

    // the address decides the language: a saved English choice does not turn /pt/ into English
    const saved = await env.open(null, { width: 1280, path: page.path.slice(1), storageState: { cookies: [], origins: [{ origin: env.base, localStorage: [{ name: 'lang', value: 'en' }] }] } });
    const kept = await saved.page.evaluate(() => ({ lang: document.documentElement.lang, about: document.querySelector('[data-i18n="hero.btn.about"]').textContent }));
    await saved.close();
    g.check(kept.lang === HTML_LANG[L] && kept.about === dict[L]['hero.btn.about'], `${tag} with English saved in the browser, ${page.path} still shows ${L.toUpperCase()} (the address wins)`, JSON.stringify(kept));
  }
  return g;
}
