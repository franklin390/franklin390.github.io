// G13 — Analytics: what the site pushes to the dataLayer is exactly the measurement plan (facts/analytics.json):
// every event fires with the right parameters, names/values obey the GA4 limits, no personal data ever travels, a visitor
// who sends GPC / Do Not Track stays silent, the page still resolves the language by itself, and the generated GTM
// container + guide are in sync with the plan.
import fs from 'node:fs';
import path from 'node:path';
import { Gate } from './lib/report.mjs';
import { ROOT, TOOLS } from './lib/common.mjs';
import { getEnv } from './lib/browser.mjs';
import { pathToFileURL } from 'node:url';
import { loadCatalog, buildContainer, buildReadme, allParams } from '../build-gtm.mjs';
import { mapHost, GUARD_LINE } from './lib/hostmap.mjs';

export const id = 'G13';

// Hostnames a copy of the page could live on. None of them may reach the analytics.
const FOREIGN_HOSTS = ['copy-of-my-site.example', 'franklin390.github.io.evil.example', 'evil-franklin390.github.io', 'www.franklin390.github.io', 'franklin390.github.io.', 'localhost', '127.0.0.1', ''];
const isHostCondition = (f) => f.type === 'MATCH_REGEX' && f.parameter.some((p) => p.key === 'arg0' && p.value === '{{Page Hostname}}');

/** Every tag of the container must fire only through triggers that carry an anchored "Page Hostname" condition accepting my hosts and nothing else. */
function hostGuardProblems(cv, hosts) {
  const problems = [];
  if (!cv.builtInVariable.some((v) => v.type === 'PAGE_HOSTNAME' && v.name === 'Page Hostname')) problems.push('the built-in variable Page Hostname is not enabled');
  const byId = new Map(cv.trigger.map((t) => [t.triggerId, t]));
  for (const tag of cv.tag) {
    if (!tag.firingTriggerId || !tag.firingTriggerId.length) { problems.push(`${tag.name}: no firing trigger`); continue; }
    for (const tid of tag.firingTriggerId) {
      const t = byId.get(tid);
      if (!t) { problems.push(`${tag.name}: fires on built-in trigger ${tid}, which has no host condition`); continue; }
      const cond = (t.filter || []).find(isHostCondition);
      if (!cond) { problems.push(`${tag.name} → ${t.name}: no Page Hostname condition`); continue; }
      let re;
      try { re = new RegExp(cond.parameter.find((p) => p.key === 'arg1').value); } catch (e) { problems.push(`${t.name}: the host regex does not compile`); continue; }
      for (const h of hosts) if (!re.test(h)) problems.push(`${t.name}: blocks the real site ${h}`);
      for (const h of FOREIGN_HOSTS) if (re.test(h)) problems.push(`${t.name}: lets "${h}" through`);
    }
  }
  return problems;
}

const BLOCKED = /googletagmanager\.com|google-analytics\.com|kit\.fontawesome\.com/;
const grab = (page) => page.evaluate(() => window.dataLayer.filter((x) => x && typeof x.event === 'string' && !x.event.startsWith('gtm.')).map((x) => JSON.parse(JSON.stringify(x))));
const consentDenied = (page) => page.evaluate(() => window.dataLayer.some((x) => Object.prototype.toString.call(x) === '[object Arguments]' && x[0] === 'consent' && x[1] === 'default' && x[2] && x[2].analytics_storage === 'denied'));
// the page keeps working but external links, PDFs and mailto do not navigate away during the test
const keepOnPage = (page) => page.evaluate(() => document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href]'); if (a && /^(mailto:|https?:)|\.pdf($|[?#])/i.test(a.getAttribute('href'))) e.preventDefault(); }));
const fire = (page, sel) => page.locator(sel).first().evaluate((el) => el.click());

export async function run(ctx) {
  const g = new Gate('G13', 'Analytics (dataLayer events, privacy, GTM container)');
  const cat = loadCatalog();
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const eventNames = Object.keys(cat.events);

  // ---------------------------------------------------------------- static
  {
    const loaders = (html.match(/googletagmanager\.com\/gtm\.js\?id=/g) || []).length;
    const ids = [...html.matchAll(/'dataLayer','(GTM-[A-Z0-9]+)'/g)].map((m) => m[1]);
    const ns = [...html.matchAll(/ns\.html\?id=(GTM-[A-Z0-9]+)/g)].map((m) => m[1]);
    g.check(loaders === 1 && ids.length === 1 && ids[0] === cat.gtmContainer && ns.length === 1 && ns[0] === cat.gtmContainer, `GTM container ${cat.gtmContainer} is installed exactly once (script + noscript)`, JSON.stringify({ loaders, ids, ns }));
    g.check(html.indexOf('__trackingOptOut') > -1 && html.indexOf('__trackingOptOut') < html.indexOf('googletagmanager.com/gtm.js'), 'the privacy-signal snippet (GPC / Do Not Track → consent denied) runs before GTM loads');
    g.check(!/gtag\/js|google-analytics\.com\/(analytics|ga)\.js|gtag\('config'|\bG-[A-Z0-9]{8,}\b|fbq\(|clarity\.ms|hotjar/i.test(html), 'GTM is the only analytics loader: no direct gtag.js / analytics.js, no measurement id and no other tracker hard-coded in the page (each would count every visit twice)');
    g.check(html.includes('(function gtag() { window.dataLayer.push(arguments); })') || /function gtag\(\)\s*\{\s*(window\.)?dataLayer\.push\(arguments\)/.test(html), 'consent is pushed as an arguments object (the only form GTM reads)');
    const order = ['js/i18n.js', 'js/main.js', 'js/analytics.js'].map((s) => html.indexOf(`<script src="${s}">`));
    g.check(order.every((x) => x > 0) && order[0] < order[1] && order[1] < order[2], 'analytics.js is loaded after i18n.js and main.js (it needs the language and the carousels)', order.join(' < '));
    // a copy of the page on another domain keeps the snippet: GTM must only load on my hostname(s)
    const guard = html.match(/var HOSTS = (\[[^\]]*\]);\s*if \(HOSTS\.indexOf\(location\.hostname\) === -1\) return;[\s\S]*?googletagmanager\.com\/gtm\.js/);
    let pageHosts = [];
    try { pageHosts = guard ? JSON.parse(guard[1].replace(/'/g, '"')) : []; } catch (e) { /* reported below */ }
    g.check(html.includes(GUARD_LINE) && !!guard && JSON.stringify(pageHosts) === JSON.stringify(cat.allowedHosts), `the GTM loader only runs on the allowed host(s) ${cat.allowedHosts.join(', ')} (same list as the measurement plan)`, 'page: ' + JSON.stringify(pageHosts));
    const bad = [];
    for (const [n, e] of Object.entries(cat.events)) {
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(n)) bad.push(`event name ${n}`);
      if (e.params.length > cat.constraints.maxParamsPerEvent) bad.push(`${n}: too many parameters`);
      for (const p of e.params) if (!cat.params[p] || !/^[a-z][a-z0-9_]{0,39}$/.test(p)) bad.push(`${n}: parameter ${p} undefined or badly named`);
    }
    g.check(bad.length === 0, `the measurement plan obeys the GA4 naming limits (${eventNames.length} events, ${Object.keys(cat.params).length} parameters)`, bad.join('\n'));
  }

  // ---------------------------------------------------------------- generated GTM container + guide
  {
    const file = path.join(TOOLS, 'gtm/portfolio-container.json');
    const readme = path.join(TOOLS, 'gtm/README.md');
    if (!fs.existsSync(file) || !fs.existsSync(readme)) g.fail('GTM container or guide missing', 'run: node build-gtm.mjs');
    else {
      const have = JSON.parse(fs.readFileSync(file, 'utf8'));
      const mid = have.containerVersion.variable.find((v) => v.name === 'Const - GA4 Measurement ID').parameter[0].value;
      g.check(JSON.stringify(have) === JSON.stringify(buildContainer(cat, mid)), 'the GTM container file matches the measurement plan (same events, parameters, variables)', 'run: node build-gtm.mjs ' + mid);
      g.check(fs.readFileSync(readme, 'utf8') === buildReadme(cat), 'the English GTM guide matches the measurement plan', 'run: node build-gtm.mjs');
      const cv = have.containerVersion;
      const varNames = new Set([...cv.variable.map((v) => v.name), ...cv.builtInVariable.map((v) => v.name), '_event']);
      const refs = [...JSON.stringify([cv.tag, cv.trigger]).matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
      const missing = [...new Set(refs.filter((r) => !varNames.has(r)))];
      g.check(missing.length === 0, 'every {{variable}} used by a tag or trigger exists in the container', missing.join(', '));
      const ids = [...cv.tag.map((t) => 't' + t.tagId), ...cv.trigger.map((t) => 'g' + t.triggerId), ...cv.variable.map((v) => 'v' + v.variableId)];
      g.check(new Set(ids).size === ids.length, 'tag, trigger and variable ids are unique');
      const eventTag = cv.tag.find((t) => t.type === 'gaawe');
      const rows = eventTag.parameter.find((p) => p.key === 'eventSettingsTable').list.map((r) => r.map[0].value);
      g.check(JSON.stringify(rows) === JSON.stringify(allParams(cat)), 'the GA4 event tag forwards every parameter of the plan', rows.join(','));
      const regex = new RegExp(cv.trigger[0].customEventFilter[0].parameter[1].value);
      g.check(eventNames.every((n) => regex.test(n)) && !regex.test('gtm.js') && !regex.test('cv_download_extra'), 'the trigger fires for every planned event and for nothing else');
      // a copy of the site on another domain must stay out of the data, even if the page guard is deleted
      const guardProblems = hostGuardProblems(cv, cat.allowedHosts);
      g.check(guardProblems.length === 0, `every tag fires only through a trigger limited to ${cat.allowedHosts.join(', ')} (Page Hostname); look-alike hosts, sub-domains, localhost and file:// are rejected`, guardProblems.join('\n'));
      const clone = () => JSON.parse(JSON.stringify(cv));
      const loose = clone(); loose.trigger.forEach((t) => (t.filter || []).forEach((f) => { f.parameter.find((p) => p.key === 'arg1').value = 'franklin390\\.github\\.io'; }));
      const noFilter = clone(); delete noFilter.trigger.find((t) => t.type === 'CUSTOM_EVENT').filter;
      const builtIn = clone(); builtIn.tag.find((t) => t.type === 'googtag').firingTriggerId = ['2147479573'];
      const noVar = clone(); noVar.builtInVariable = noVar.builtInVariable.filter((v) => v.name !== 'Page Hostname');
      g.check([loose, noFilter, builtIn, noVar].every((c) => hostGuardProblems(c, cat.allowedHosts).length > 0), 'negative control: the host check rejects an unanchored regex, a trigger without the condition, a tag on a built-in trigger and a missing Page Hostname variable');
    }
  }

  // ---------------------------------------------------------------- behaviour in a real browser
  const env = await getEnv(ctx);
  const all = []; // every event seen in any scenario
  const note = (list) => { all.push(...list); return list; };

  // ----- S1: an English desktop visitor goes through the whole page
  {
    const s = await env.open('en', { width: 1280, reducedMotion: 'reduce' });
    const p = s.page;
    await keepOnPage(p);
    await p.waitForTimeout(1200);
    let ev = await grab(p);
    const ctxEv = ev.find((e) => e.event === 'site_context');
    g.check(ctxEv && ctxEv.site_language === 'en' && ctxEv.language_source === 'url' && ctxEv.browser_language === 'en' && ctxEv.device_class === 'desktop' && ctxEv.reduced_motion === 'yes', 'site_context: language, how it was chosen, browser language, device class and reduced motion are reported', JSON.stringify(ctxEv));
    g.check(!(await consentDenied(p)), 'a normal visitor gets no consent denial from the privacy snippet');

    // contact + CV
    await p.evaluate(() => window.scrollTo(0, 0));
    await fire(p, '#intro a[href$=".pdf"]');
    await fire(p, '#contact a[data-contact="hiring"]');
    await fire(p, '#contact a[data-contact="projects"]');
    await fire(p, '#contact a[href*="linkedin.com"]');
    await fire(p, '#contact a[href*="github.com"]');
    await fire(p, 'footer a[href*="github.com"]');
    // links that leave the site
    await fire(p, '#resume a.link-chip[href*="clicksign.com"]');
    await fire(p, '#resume a.link-chip[href*="thedevconf.com"]');
    await fire(p, '#resume a.link-chip[href*="youtube.com"]');
    await fire(p, '#resume a[href*="credly.com"]');
    await fire(p, '.popup-modal a[href*="github.io"]');
    await fire(p, '#owl-slider-cert a[href$=".pdf"]');
    // the four fold buttons of the phone layout (hidden on a wide screen, but they exist and work)
    await p.evaluate(() => document.querySelectorAll('[data-fold-toggle]').forEach((b) => b.click()));
    await p.waitForTimeout(300);
    // navigation, impact, filters, training list
    await p.locator('#main-nav-wrap a[href="#about"]').click();
    await p.waitForTimeout(900);
    await p.locator('a.brand').click();
    await p.waitForTimeout(900);
    await p.locator('#impact .stat-link[href="#case-finops"]').evaluate((el) => el.click());
    await p.waitForTimeout(1500);
    await p.locator('.case-filter[data-filter="governance"]').click();
    await p.locator('.train-details summary').first().evaluate((el) => el.click());
    // the early projects open (their carousel is then measured)
    await p.locator('.early-projects summary').first().evaluate((el) => el.click());
    await p.waitForTimeout(700);
    // carousel moves (slide 1 -> 2), then a row of the career-at-a-glance list is used, a project opens, a skill tag is hovered
    await p.evaluate(() => window.jQuery('#owl-slider-work').data('owlCarousel').next());
    await p.waitForTimeout(500);
    await p.locator('.glance-link[href="#role-ck-arch"]').evaluate((el) => el.click());
    await p.waitForTimeout(1800);
    await p.evaluate(() => document.querySelector('#owl-slider-port').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(600);
    await p.locator('#portfolio .item-wrap a.overlay').first().click({ force: true });
    await p.waitForSelector('.mfp-content', { state: 'visible', timeout: 5000 }).catch(() => {});
    await p.locator('.popup-modal-dismiss').first().click({ force: true }).catch(() => {});
    await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelector('#about .skill-groups').scrollIntoView({ block: 'center' }));
    await p.locator('#about .tags li', { hasText: 'Databricks' }).first().hover();
    await p.waitForTimeout(800);
    // the language switch: pointer, then keyboard
    await p.locator('.lang-btn[data-lang="pt"]').click();
    await p.waitForTimeout(300);
    await p.locator('.lang-btn[data-lang="es"]').focus();
    await p.keyboard.press('Enter');
    await p.waitForTimeout(500);
    await p.locator('#main-nav-wrap a[href="#contact"]').click();   // an event after the switches must already carry the new language
    await p.waitForTimeout(900);
    // reading: scroll depth, section time, a case card
    await p.evaluate(() => window.scrollTo(0, 0));
    for (const f of [0.3, 0.55, 0.8, 1]) { await p.evaluate((x) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * x), f); await p.mouse.move(100 + f * 300, 300); await p.waitForTimeout(450); }
    await p.locator('.case-filter[data-filter="all"]').click({ force: true }); // the governance filter hid this card earlier
    await p.evaluate(() => document.querySelector('#case-finops').scrollIntoView({ block: 'center' }));
    await p.mouse.move(200, 400);
    await p.waitForTimeout(2600);
    await p.evaluate(() => document.querySelector('#about').scrollIntoView({ block: 'center' }));
    for (let i = 0; i < 5; i++) { await p.mouse.move(300 + i * 20, 350); await p.waitForTimeout(1000); }
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(200);
    await p.evaluate(() => { delete document.visibilityState; });
    // a translated skill must still be reported with its English name (the page is in Spanish by now); done after the dwell flush so it does not add time to that measurement
    await p.evaluate(() => document.querySelector('#about .skill-groups').scrollIntoView({ block: 'center' }));
    await p.locator('#about .tags li[data-i18n="tag.dimensional"]').first().hover();
    await p.waitForTimeout(800);
    // the rest: back to top, print, a script error
    await p.evaluate(() => window.scrollTo(0, 800));
    await p.waitForTimeout(500);
    await p.locator('#go-top a').click({ force: true });
    await p.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    // a real script file of this site (errors from injected code carry no file name and are ignored on purpose)
    await p.route('**/js/g13-probe.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "setTimeout(function () { throw new Error('g13 probe'); }, 0);" }));
    await p.addScriptTag({ url: env.base + '/js/g13-probe.js' });
    await p.waitForTimeout(400);
    ev = note(await grab(p));
    const find = (name, fn = () => true) => ev.find((e) => e.event === name && fn(e));
    const ok = (cond, msg, detail) => g.check(!!cond, msg, detail);

    ok(find('cv_download', (e) => /_CV_EN\.pdf$/.test(e.file_name) && e.cv_language === 'en' && e.location === 'intro'), 'cv_download: file, CV language and where on the page', JSON.stringify(find('cv_download')));
    ok(find('contact_click', (e) => e.method === 'email_hiring' && e.location === 'contact'), 'contact_click: e-mail from the Hiring path');
    ok(find('contact_click', (e) => e.method === 'email_projects' && e.location === 'contact'), 'contact_click: e-mail from the Projects path');
    ok(find('contact_click', (e) => e.method === 'linkedin' && e.location === 'contact'), 'contact_click: LinkedIn');
    ok(find('contact_click', (e) => e.method === 'github' && e.location === 'footer'), 'contact_click: GitHub from the footer (location comes from the DOM)');
    ok(find('outbound_click', (e) => e.link_type === 'company' && e.link_domain === 'clicksign.com'), 'outbound_click: company site');
    ok(find('outbound_click', (e) => e.link_type === 'event' && e.link_domain === 'thedevconf.com'), 'outbound_click: event page');
    ok(find('outbound_click', (e) => e.link_type === 'episode'), 'outbound_click: podcast episode');
    ok(find('outbound_click', (e) => e.link_type === 'certificate_verify' && /credly\.com$/.test(e.link_domain)), 'outbound_click: Credly verification');
    ok(find('outbound_click', (e) => e.link_type === 'project' && e.location === 'portfolio'), 'outbound_click: a project opened from its modal');
    ok(find('certificate_open', (e) => /\.pdf$/.test(e.file_name) && e.location === 'resume'), 'certificate_open: certificate PDF');
    ok(find('nav_click', (e) => e.item === 'about' && e.via === 'bar') && find('nav_click', (e) => e.item === 'top' && e.via === 'brand'), 'nav_click: section link in the bar and the logo');
    ok(find('impact_stat_click', (e) => e.item === 'cost'), 'impact_stat_click: the ">50%" number');
    ok(find('case_filter', (e) => e.item === 'governance'), 'case_filter: chosen theme');
    ok(find('training_toggle', (e) => e.state === 'open' && e.item === 'courses'), 'training_toggle: course list opened (item courses)');
    ok(find('training_toggle', (e) => e.state === 'open' && e.item === 'early_projects'), 'training_toggle: early projects opened (item early_projects)');
    for (const [btn, item] of [['about-more', 'about_more'], ['skills-more', 'skills_more'], ['work-more', 'work_more'], ['exp-detail', 'experience_detail']]) {
      ok(find('content_toggle', (e) => e.item === item && e.state === 'open'), `content_toggle: ${item} opened from its button`);
    }
    ok(find('nav_click', (e) => e.via === 'glance' && e.item === 'role-ck-arch'), 'nav_click: a career-at-a-glance row reports via glance and the role id');
    ok(find('carousel_navigate', (e) => e.item === 'experience' && e.slide === 'role-fb-techlead'), 'carousel_navigate: experience carousel reports the role that was shown', JSON.stringify(find('carousel_navigate')));
    ok(find('project_open', (e) => /^modal-\d+$/.test(e.item)), 'project_open: project id');
    ok(find('skill_hover', (e) => e.item === 'Databricks'), 'skill_hover: skill the pointer rested on');
    ok(find('skill_hover', (e) => e.item === 'Dimensional modeling'), 'skill_hover: a translated skill reports its English name (checked with the page in Spanish)');
    const toggles = ev.filter((e) => e.event === 'language_toggle');
    ok(toggles.length === 2 && toggles[0].from_language === 'en' && toggles[0].to_language === 'pt' && toggles[0].method === 'pointer' && toggles[1].from_language === 'pt' && toggles[1].to_language === 'es' && toggles[1].method === 'keyboard', 'language_toggle: from, to, and whether it was pointer or keyboard', JSON.stringify(toggles));
    ok(find('nav_click', (e) => e.item === 'contact' && e.site_language === 'es'), 'events sent after a language switch carry the new language');
    ok([25, 50, 75, 100].every((m) => find('scroll_depth', (e) => e.percent === m)), 'scroll_depth: 25, 50, 75 and 100% milestones');
    ok(find('case_view', (e) => e.item === 'finops'), 'case_view: a case card that stayed on screen for 2 s');
    ok(find('section_view', (e) => e.item === 'about'), 'section_view: a section read for 2+ active seconds');
    const dwell = find('section_dwell', (e) => e.item === 'about');
    ok(dwell && dwell.seconds >= 3 && dwell.seconds <= 8, 'section_dwell: active seconds in the section when the tab is hidden (3 to 8 s for the 5 s stay)', JSON.stringify(dwell));
    const sum = find('engagement_summary');
    ok(sum && sum.total_seconds >= 3 && sum.sections_seen >= 1 && sum.max_scroll_percent >= 90, 'engagement_summary: total active seconds, sections seen and deepest scroll', JSON.stringify(sum));
    ok(find('back_to_top'), 'back_to_top: button used');
    ok(find('page_print'), 'page_print: print requested');
    ok(find('js_error', (e) => /g13 probe/.test(e.message)), 'js_error: error thrown by the site\'s own page is reported (message and file)', JSON.stringify(find('js_error')));
    await s.close();
  }

  // ----- S2: a phone with the hamburger menu
  {
    const s = await env.open('en', { width: 375, reducedMotion: 'reduce' });
    const p = s.page;
    await p.waitForTimeout(800);
    await p.locator('.menu-toggle').click();
    await p.waitForTimeout(500);
    await p.locator('#main-nav-wrap a[href="#services"]').click();
    await p.waitForTimeout(900);
    const ev = note(await grab(p));
    g.check(ev.find((e) => e.event === 'site_context' && e.device_class === 'mobile') && ev.find((e) => e.event === 'menu_toggle' && e.state === 'open') && ev.find((e) => e.event === 'nav_click' && e.item === 'services' && e.via === 'dropdown'), 'phone: device class, hamburger open and navigation from the dropdown', JSON.stringify(ev.map((e) => e.event)));
    await s.close();
  }

  // ----- S3: a Brazilian browser opening the site without ?lang= still gets English (decision), and we learn about the mismatch
  {
    const context = await env.browser.newContext({ locale: 'pt-BR', viewport: { width: 1280, height: 900 } });
    await context.route(BLOCKED, (r) => r.abort());
    const page = await context.newPage();
    await page.goto(env.base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const ev = note(await grab(page));
    const c = ev.find((e) => e.event === 'site_context');
    g.check(c && c.site_language === 'en' && c.browser_language === 'pt' && c.language_source === 'default', 'a pt-BR browser without ?lang= still shows English and the mismatch is recorded (site_language en, browser_language pt)', JSON.stringify(c));
    await context.close();
  }

  // ----- S4: visitors who send Global Privacy Control or Do Not Track
  for (const [label, script] of [['Global Privacy Control', () => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true })], ['Do Not Track', () => Object.defineProperty(navigator, 'doNotTrack', { value: '1' })]]) {
    const context = await env.browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await context.route(BLOCKED, (r) => r.abort());
    await context.addInitScript(script);
    const page = await context.newPage();
    await page.goto(env.base + '/?lang=pt', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await keepOnPage(page);
    await fire(page, '#intro a[href$=".pdf"]');
    await page.locator('.lang-btn[data-lang="es"]').click();
    await page.locator('#main-nav-wrap a[href="#about"]').click();
    await page.waitForTimeout(1500);
    const ev = await grab(page);
    g.check(ev.length === 0 && (await consentDenied(page)), `${label}: no event is sent and analytics consent is denied before GTM loads`, JSON.stringify(ev.map((e) => e.event)));
    await context.close();
  }

  // ----- S5: counted exactly once. Every single action produces exactly the planned events (nothing doubled), the tab-hide flush
  // reports once, and no history method that GTM / gtag wrap (and count as a new page view) is ever called.
  {
    const context = await env.browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await context.route(BLOCKED, (r) => r.abort());
    // spy exactly like GTM / gtag do: wrap history.pushState / replaceState and count the calls
    await context.addInitScript(() => { window.__hist = 0; for (const m of ['pushState', 'replaceState']) { const o = history[m]; history[m] = function () { window.__hist++; return o.apply(this, arguments); }; } });
    const page = await context.newPage();
    await page.goto(env.base + '/?lang=en', { waitUntil: 'load' });
    await page.waitForFunction(() => { const p = document.querySelector('#preloader'); return !p || getComputedStyle(p).display === 'none'; }, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1300);
    await keepOnPage(page);
    const NOISE = new Set(['site_context', 'scroll_depth', 'section_view', 'section_dwell', 'engagement_summary', 'case_view']); // time/scroll based, never caused by one click
    const once = async (label, action, expected, wait = 1300) => {
      const before = (await grab(page)).length;
      await action();
      await page.waitForTimeout(wait);
      const evs = (await grab(page)).slice(before);
      note(evs);
      const got = evs.map((e) => e.event).filter((n) => !NOISE.has(n)).sort();
      g.check(JSON.stringify(got) === JSON.stringify([...expected].sort()), `exactly the planned events for one ${label}: ${expected.join(' + ')}`, 'got: ' + (got.join(', ') || 'nothing'));
    };
    await once('CV click', () => fire(page, '#intro a[href$=".pdf"]'), ['cv_download']);
    await once('e-mail click', () => fire(page, '#contact a[href^="mailto:"]'), ['contact_click']);
    await once('LinkedIn click', () => fire(page, '#contact a[href*="linkedin.com"]'), ['contact_click']);
    await once('company link click', () => fire(page, '#resume a.link-chip[href*="clicksign.com"]'), ['outbound_click']);
    await once('certificate PDF click', () => fire(page, '#owl-slider-cert a[href$=".pdf"]'), ['certificate_open']);
    await once('navigation click', () => page.locator('#main-nav-wrap a[href="#about"]').click(), ['nav_click'], 1500);
    await once('impact number click (it also scrolls to a case)', () => page.locator('#impact .stat-link[href="#case-finops"]').evaluate((el) => el.click()), ['impact_stat_click'], 3000);
    await page.evaluate(() => window.jQuery('#owl-slider-work').trigger('owl.jumpTo', 3));
    await page.waitForTimeout(3000);
    await once('impact number click that moves the experience carousel by itself', () => page.locator('#impact .stat-link[href="#role-fb-staff"]').evaluate((el) => el.click()), ['impact_stat_click'], 3200);
    await once('case filter click', () => page.locator('.case-filter[data-filter="governance"]').click(), ['case_filter']);
    await once('course list toggle', () => page.locator('.train-details summary').first().evaluate((el) => el.click()), ['training_toggle']);
    await once('read-more button (the other text of About)', () => page.locator('[data-fold-toggle="about-more"]').evaluate((el) => el.click()), ['content_toggle']);
    await once('early projects button (it also measures their carousel)', () => page.locator('.early-projects summary').first().evaluate((el) => el.click()), ['training_toggle'], 1500);
    await once('career-at-a-glance row (it also moves the experience carousel by itself)', () => page.locator('.glance-link[href="#role-ck-arch"]').evaluate((el) => el.click()), ['nav_click'], 3000);
    await once('carousel move', () => page.evaluate(() => window.jQuery('#owl-slider-work').data('owlCarousel').next()), ['carousel_navigate'], 1500);
    await page.evaluate(() => document.querySelector('#owl-slider-port').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(600);
    await once('project open', () => page.locator('#portfolio .item-wrap a.overlay').first().click({ force: true }), ['project_open'], 1500);
    await page.locator('.popup-modal-dismiss').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    await once('language switch (it also re-lays out every carousel)', () => page.locator('.lang-btn[data-lang="pt"]').click(), ['language_toggle'], 1800);
    // leaving the page: visibilitychange AND pagehide both fire in a real browser, the summary must still be reported once
    const beforeHide = (await grab(page)).length;
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
    await page.waitForTimeout(400);
    const flushed = note((await grab(page)).slice(beforeHide));
    const dwellItems = flushed.filter((e) => e.event === 'section_dwell').map((e) => e.item);
    g.check(flushed.filter((e) => e.event === 'engagement_summary').length === 1 && new Set(dwellItems).size === dwellItems.length, 'leaving the page (visibilitychange + pagehide) reports one engagement_summary and one section_dwell per section, not two', JSON.stringify(flushed.map((e) => e.event + ':' + (e.item || ''))));
    const histCalls = await page.evaluate(() => window.__hist);
    g.check(histCalls === 0, 'no call to history.pushState / replaceState during the whole visit (GTM and gtag wrap them and would count each call, e.g. the ?lang= update, as a duplicate page view)', 'calls: ' + histCalls);
    const dl = await grab(page);
    const adjacentSame = dl.filter((e, i) => i > 0 && JSON.stringify(e) === JSON.stringify(dl[i - 1]));
    g.check(adjacentSame.length === 0, 'no event was pushed twice in a row with identical content', JSON.stringify(adjacentSame.slice(0, 3)));
    await context.close();
  }

  // ----- S6: a copy of the page on another domain must not reach my analytics. The page is served under different hostnames
  // (no network involved) and we watch whether the GTM loader runs.
  {
    const visit = async (url, { host, strip = false } = {}) => {
      const context = await env.browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await context.route(BLOCKED, (r) => r.abort());
      const state = host ? await mapHost(context, host, env.base, { stripGuard: strip }) : { stripped: 0 };
      const page = await context.newPage();
      const gtm = [];
      const errors = [];
      page.on('request', (r) => { if (/googletagmanager\.com\/gtm\.js/.test(r.url())) gtm.push(r.url()); });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(1000);
      const loaderRan = await page.evaluate(() => (window.dataLayer || []).some((x) => x && x.event === 'gtm.js'));
      const siteEvents = (await grab(page)).length;
      await context.close();
      return { gtm, errors, loaderRan, siteEvents, stripped: state.stripped };
    };
    const real = await visit(`https://${cat.allowedHosts[0]}/?lang=en`, { host: cat.allowedHosts[0] });
    g.check(real.loaderRan && real.gtm.length === 1 && real.gtm[0].includes('id=' + cat.gtmContainer) && real.errors.length === 0, `on ${cat.allowedHosts[0]} the page loads GTM ${cat.gtmContainer} exactly once (the guard does not break the real site)`, JSON.stringify({ loaderRan: real.loaderRan, requests: real.gtm }));
    for (const host of ['copy-of-my-site.example', `${cat.allowedHosts[0]}.evil.example`]) {
      const copy = await visit(`https://${host}/?lang=en`, { host });
      g.check(!copy.loaderRan && copy.gtm.length === 0 && copy.errors.length === 0 && copy.siteEvents > 0, `a copy of the page at ${host} never loads GTM, shows no error and still works`, JSON.stringify({ loaderRan: copy.loaderRan, requests: copy.gtm, errors: copy.errors.slice(0, 2), siteEvents: copy.siteEvents }));
    }
    const local = await visit(`${env.base}/?lang=en`);
    g.check(!local.loaderRan && local.gtm.length === 0, 'the page opened from localhost does not load GTM either (local previews never reach the analytics)', JSON.stringify(local.gtm));
    const disk = await visit(pathToFileURL(path.join(ROOT, 'index.html')).href + '?lang=en');
    g.check(!disk.loaderRan && disk.gtm.length === 0 && disk.errors.length === 0, 'a saved copy opened from disk (file://) does not load GTM', JSON.stringify({ requests: disk.gtm, errors: disk.errors.slice(0, 2) }));
    // control: without the guard the loader does run on a foreign host, so the checks above are not vacuous
    const stripped = await visit('https://copy-of-my-site.example/?lang=en', { host: 'copy-of-my-site.example', strip: true });
    g.check(stripped.stripped > 0 && stripped.loaderRan && stripped.gtm.length === 1, 'control: with the guard removed from the copy, the GTM loader does run on the foreign host (so the guard is what keeps it out)', JSON.stringify({ stripped: stripped.stripped, loaderRan: stripped.loaderRan, requests: stripped.gtm.length }));
  }

  // ---------------------------------------------------------------- hygiene of everything that was sent
  {
    const problems = [];
    const privateRe = fs.existsSync(path.join(TOOLS, 'fixtures/private-forbidden.json')) ? JSON.parse(fs.readFileSync(path.join(TOOLS, 'fixtures/private-forbidden.json'), 'utf8')).patterns.map((p) => p.re) : []; // exact private values live outside the repository
    const patterns = [...cat.forbiddenInValues.patterns, ...privateRe].map((r) => new RegExp(r, 'i'));
    for (const e of all) {
      const def = cat.events[e.event];
      if (!def) { problems.push(`unknown event "${e.event}"`); continue; }
      const allowed = new Set(['event', ...cat.commonParams, ...def.params]);
      if (!e.site_language || !['en', 'pt', 'es'].includes(e.site_language)) problems.push(`${e.event}: site_language missing or invalid`);
      for (const [k, v] of Object.entries(e)) {
        if (!allowed.has(k)) { problems.push(`${e.event}: parameter "${k}" is not in the plan`); continue; }
        if (k === 'event') continue;
        const pd = cat.params[k];
        if (!pd) { problems.push(`${e.event}: parameter "${k}" is not declared in the plan`); continue; }
        const t = pd.type;
        if (typeof v !== t) problems.push(`${e.event}.${k}: expected ${t}, got ${typeof v}`);
        if (typeof v === 'string' && v.length > cat.constraints.maxValueLength) problems.push(`${e.event}.${k}: longer than ${cat.constraints.maxValueLength} characters`);
        if (typeof v === 'string' && patterns.some((re) => re.test(v))) problems.push(`${e.event}.${k}: looks like personal data ("${v.slice(0, 30)}")`);
      }
      for (const p of def.params.filter((x) => !['message', 'file', 'slide', 'link_domain', 'location'].includes(x))) if (!(p in e)) problems.push(`${e.event}: planned parameter "${p}" is missing`);
    }
    g.check(problems.length === 0, `all ${all.length} events sent match the plan: known name, only planned parameters, right types, <= ${cat.constraints.maxValueLength} chars, no personal data`, [...new Set(problems)].slice(0, 12).join('\n'));
    const never = eventNames.filter((n) => !all.some((e) => e.event === n));
    g.check(never.length === 0, `every one of the ${eventNames.length} planned events was seen firing`, 'never fired: ' + never.join(', '));
  }
  return g;
}
