// End-to-end check with the REAL published GTM container (needs internet). Run it after publishing the container.
// It opens the site from the local server, lets GTM load for real, and records every hit the Google tag tries to send to GA4.
// The hits are answered with 204 locally, so NOTHING reaches Google Analytics and no data is polluted.
//
// Three visits, each in a fresh browser profile. The page believes it lives at the hostname given (the local server is mapped to it):
//   A. the real site          -> every action must be counted exactly once
//   B. a copy on another domain, page untouched          -> nothing is sent (the page never loads GTM)
//   C. a copy on another domain, host guard deleted      -> nothing is sent (the published container refuses the foreign host)
// Usage: node live-gtm-check.mjs          (exit code 1 if a hit is duplicated, unexpected or comes from a foreign host)
import { chromium } from '@playwright/test';
import { startServer } from './serve.mjs';
import { loadCatalog } from './build-gtm.mjs';
import { mapHost } from './verify/lib/hostmap.mjs';

const COLLECT = /\/g\/collect|\/j\/collect|\/collect\?/;
const PROD = loadCatalog().allowedHosts[0];
const COPY = 'copy-of-my-site.example';
const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome' });

/** One visit: returns every GA4 event the page tried to send, the GTM scripts it requested and the steps taken. */
async function visit(host, { stripGuard = false, actions }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const hits = []; // one entry per GA4 event that the page tried to send
  await context.route(COLLECT, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const q = Object.fromEntries(url.searchParams);
    const body = req.postData() || '';
    const events = [];
    if (q.en) events.push({ ...q });
    for (const line of body.split('\n').filter(Boolean)) { const e = Object.fromEntries(new URLSearchParams(line)); if (e.en) events.push({ tid: q.tid, dl: q.dl, ...e }); }
    for (const e of events) { const dl = e.dl || q.dl || ''; hits.push({ t: Date.now(), tid: e.tid || q.tid, en: e.en, host: (dl.match(/^https?:\/\/([^/]+)/) || [])[1] || '', dl: dl.replace(/^https?:\/\/[^/]+/, '') }); }
    await route.fulfill({ status: 204, body: '' });
  });
  const mapped = await mapHost(context, host, `http://127.0.0.1:${server.port}`, { stripGuard });
  const page = await context.newPage();
  const gtmRequests = [];
  page.on('request', (r) => { if (/googletagmanager\.com\/(gtm|gtag)/.test(r.url())) gtmRequests.push(r.url().replace(/\?.*/, '') + ' ' + ((r.url().match(/id=([A-Z0-9-]+)/) || [])[1] || '')); });

  const steps = [];
  const step = async (name, fn, wait = 1800) => { const n = hits.length; await fn(); await page.waitForTimeout(wait); steps.push({ name, list: hits.slice(n) }); };
  await page.goto(`https://${host}/?lang=en`, { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  steps.push({ name: 'page load (5 s)', list: hits.slice() });
  // the page keeps working but external links, PDFs and mailto do not navigate away during the test
  await page.evaluate(() => document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href]'); if (a && /^(mailto:|https?:)|\.pdf($|[?#])/i.test(a.getAttribute('href'))) e.preventDefault(); }));
  await actions(page, step);
  await context.close();
  return { hits, steps, gtmRequests: [...new Set(gtmRequests)], stripped: mapped.stripped };
}

const scrollToBottom = (page) => async () => { for (const f of [0.4, 0.8, 1]) { await page.evaluate((x) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * x), f); await page.waitForTimeout(500); } };

const fullVisit = async (page, step) => {
  await step('click a section link (#about)', () => page.locator('#main-nav-wrap a[href="#about"]').click());
  await step('click the logo (#top)', () => page.locator('a.brand').click());
  await step('switch language to PT', () => page.locator('.lang-btn[data-lang="pt"]').click());
  await step('click an impact number (goes to a case)', () => page.locator('#impact .stat-link[href="#case-finops"]').evaluate((el) => el.click()), 2600);
  await step('click the CV button', () => page.locator('#intro a[href$=".pdf"]').first().evaluate((el) => el.click()));
  await step('click the CV button again (makes GA4 flush anything it was holding back)', () => page.locator('#intro a[href$=".pdf"]').first().evaluate((el) => el.click()), 5000);
  await step('scroll to the bottom', scrollToBottom(page), 1500);
};
const shortVisit = async (page, step) => {
  await step('click the CV button', () => page.locator('#intro a[href$=".pdf"]').first().evaluate((el) => el.click()));
  await step('switch language to PT', () => page.locator('.lang-btn[data-lang="pt"]').click());
  await step('scroll to the bottom', scrollToBottom(page), 1500);
};

const A = await visit(PROD, { actions: fullVisit });
const B = await visit(COPY, { actions: shortVisit });
const C = await visit(COPY, { stripGuard: true, actions: shortVisit });
await browser.close();
server.close();

// ---------------------------------------------------------------- report
const summary = (list) => { const c = {}; for (const h of list) c[h.en] = (c[h.en] || 0) + 1; return c; };
const fmt = (list) => Object.entries(summary(list)).map(([k, v]) => `${k} x${v}`).join('   ') || '(no hit)';
let problems = 0;

// ----- A. the real site
// Expected number of GA4 hits per event for the actions above (2 section/logo clicks, 1 language switch, 1 impact click, 2 CV clicks).
// page_view comes from the Google tag; the others are this site's own events and only appear once the portfolio container
// (with its event tag) is published. GA4 "enhanced measurement" must stay off for scrolls and file downloads: the site sends
// its own scroll_depth and cv_download, so a hit for either of them below means every visit is counted twice.
const EXPECTED = { page_view: 1, site_context: 1, language_toggle: 1, nav_click: 2, impact_stat_click: 1, cv_download: 2 };
const ENHANCED_OFF = ['file_download', 'scroll'];
const ZERO = ['contact_click', 'outbound_click', 'certificate_open', 'case_filter', 'project_open', 'carousel_navigate', 'menu_toggle', 'training_toggle', 'back_to_top', 'js_error'];
const hits = A.hits;
const tids = [...new Set(hits.map((h) => h.tid).filter(Boolean))];
console.log(`===== A. the real site (https://${PROD}/) =====`);
console.log('GTM / gtag scripts requested:');
for (const r of A.gtmRequests) console.log('  ' + r);
console.log(`\nGA4 properties receiving hits: ${tids.join(', ') || '(none)'}`);
for (const s of A.steps) console.log(`\n> ${s.name}: ${fmt(s.list)}`);

const total = summary(hits);
console.log('\nHits per event over the whole visit (seen / expected):');
for (const [en, want] of Object.entries(EXPECTED)) {
  const n = total[en] || 0;
  const ok = n === want || (n === 0 && en !== 'page_view');
  const note = n === 0 ? (en === 'page_view' ? 'MISSING' : 'not seen (that tag is not in the published container)') : n === want ? 'ok' : (n > want ? 'DUPLICATE' : 'missing hits');
  if (!ok) problems++;
  console.log(`  ${en.padEnd(18)} ${String(n).padStart(2)} / ${want}   ${note}`);
}
for (const en of ZERO) if (total[en]) { problems++; console.log(`  ${en.padEnd(18)} ${String(total[en]).padStart(2)} / 0   UNEXPECTED (the script never did that action)`); }
for (const en of ENHANCED_OFF) {
  if (total[en]) { problems++; console.log(`  ${en.padEnd(18)} ${String(total[en]).padStart(2)} / 0   DUPLICATE: GA4 enhanced measurement is still on for this (Admin > Data streams > Enhanced measurement); the site already sends its own equivalent`); }
  else console.log(`  ${en.padEnd(18)}  0 / 0   ok (enhanced measurement is off in GA4)`);
}
const other = Object.keys(total).filter((k) => !(k in EXPECTED) && !ZERO.includes(k) && !ENHANCED_OFF.includes(k));
if (other.length) console.log('  other events (not checked): ' + other.map((k) => `${k} x${total[k]}`).join(', '));
if (tids.length > 1) { problems++; console.log(`WARNING: hits went to ${tids.length} different GA4 properties: ${tids.join(', ')}`); }
const views = hits.filter((h) => h.en === 'page_view');
if (views.length > 1) console.log('  the extra page_view hits were for: ' + views.slice(1).map((h) => h.dl).join(', '));

// ----- B and C. a copy of the page on another domain
console.log(`\n===== B. a copy at https://${COPY}/ (page untouched) =====`);
console.log('GTM scripts requested: ' + (B.gtmRequests.join(', ') || '(none: the page never loaded GTM)'));
console.log('GA4 hits: ' + fmt(B.hits));
if (B.gtmRequests.length || B.hits.length) { problems++; console.log('PROBLEM: the page guard did not keep a copy out of the analytics'); }

console.log(`\n===== C. a copy at https://${COPY}/ whose host guard was deleted =====`);
console.log('GTM scripts requested: ' + (C.gtmRequests.join(', ') || '(none)'));
console.log('GA4 hits: ' + fmt(C.hits));
if (C.stripped === 0 || !C.gtmRequests.length) { problems++; console.log('PROBLEM: test setup: the guard could not be removed, so this scenario proved nothing'); }
else if (C.hits.length) {
  problems++;
  const hosts = [...new Set(C.hits.map((h) => h.host))].join(', ');
  console.log(`PROBLEM: the published GTM container let the foreign host through. GA4 (${[...new Set(C.hits.map((h) => h.tid))].join(', ')}) would record these visits with hostname ${hosts}.`);
  console.log('  Fix: import and publish _tools/gtm/portfolio-container.json (it limits both tags to Page Hostname ' + PROD + '). Steps: _tools/gtm/README.md, section "Copies of the site on other domains".');
}

console.log(problems ? `\nRESULT: ${problems} problem(s)` : '\nRESULT: every action was counted exactly once, and a copy on another domain sends nothing');
process.exit(problems ? 1 : 0);
