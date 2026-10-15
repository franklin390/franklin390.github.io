// G1 — Static HTML: validity, references, ids, a11y basics, forbidden/stale strings, JSON-LD, in-sync generated regions.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { HtmlValidate } from 'html-validate';
import { Gate } from './lib/report.mjs';
import { ROOT, TOOLS, loadFacts, existsExact } from './lib/common.mjs';

export const id = 'G1';

const loadDictRaw = (lang) => {
  const sandbox = { window: { I18N: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, `js/i18n/${lang}.js`), 'utf8'), sandbox);
  return sandbox.window.I18N[lang];
};

export const HV_CONFIG = {
  extends: ['html-validate:recommended'],
  rules: {
    'void-style': 'off', 'no-trailing-whitespace': 'off', 'attribute-boolean-style': 'off', 'long-title': 'off',
    'no-inline-style': 'off', 'prefer-native-element': 'off', 'attr-quotes': 'off', 'doctype-style': 'off',
    'no-redundant-role': 'off', 'heading-level': 'off', 'wcag/h30': 'off', 'wcag/h37': 'off', 'no-implicit-close': 'off',
    'element-permitted-content': 'error', 'no-dup-id': 'error', 'valid-id': 'off', 'require-sri': 'off',
    'prefer-tbody': 'off', 'no-raw-characters': 'off', 'tel-non-breaking': 'off', 'script-element': 'off', 'no-inline-style ': 'off',
    'text-content': 'off', 'no-missing-references': 'error', 'input-missing-label': 'off',
  },
};

export async function run() {
  const g = new Gate('G1', 'Static HTML, references and forbidden strings');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const facts = loadFacts();

  // 1) generated/synced regions are up to date (EN inline copy == en.js, repetitive blocks == training.json)
  for (const [label, script] of [['gen-regions', 'gen-regions.mjs'], ['sync-html (inline EN == en.js)', 'sync-html.mjs']]) {
    try {
      execFileSync('node', [path.join(TOOLS, script), '--check'], { cwd: TOOLS, stdio: 'pipe' });
      g.pass(`${label}: up to date`);
    } catch (e) {
      g.fail(`${label}: index.html is out of date`, String(e.stdout || e.message).trim());
    }
  }

  // 2) HTML validity
  const hv = new HtmlValidate(HV_CONFIG);
  const report = await hv.validateString(html, 'index.html');
  const msgs = report.results.flatMap((r) => r.messages);
  g.check(msgs.filter((m) => m.severity === 2).length === 0, 'html-validate: no errors',
    msgs.filter((m) => m.severity === 2).slice(0, 15).map((m) => `L${m.line}:${m.column} [${m.ruleId}] ${m.message}`).join('\n'));
  const warns = msgs.filter((m) => m.severity === 1);
  if (warns.length) g.warn(`html-validate: ${warns.length} warning(s)`, warns.slice(0, 10).map((m) => `L${m.line} [${m.ruleId}] ${m.message}`).join('\n'));

  // 3) every local reference exists
  const refs = [...html.matchAll(/(?:src|href|data-href-en|data-href-pt)="([^"#][^"]*)"/g)].map((m) => m[1]);
  const missing = [];
  for (const r of new Set(refs)) {
    if (/^(https?:|mailto:|tel:|\/\/|data:)/.test(r)) continue;
    const p = decodeURIComponent(r.split('?')[0]);
    if (!existsExact(ROOT, p)) missing.push(r); // exact case: GitHub Pages is case-sensitive
  }
  g.check(missing.length === 0, `all ${new Set(refs).size} src/href references resolve to existing local files or external URLs`, `missing: ${missing.join(', ')}`);

  // CSS url() / @import references
  const cssMissing = [];
  for (const css of ['base.css', 'main.css', 'vendor.css', 'fonts.css', 'staff.css', 'micons/micons.css', 'font-awesome-6/css/all.css', 'font-awesome-6/css/subset.css']) {
    const file = path.join(ROOT, 'css', css);
    if (!fs.existsSync(file)) { cssMissing.push(`css/${css} (file)`); continue; }
    const txt = fs.readFileSync(file, 'utf8');
    for (const m of txt.matchAll(/(?:url\(\s*["']?|@import\s+["'])([^"')\s]+)/g)) {
      const ref = m[1];
      if (/^(data:|https?:|#)/.test(ref)) continue;
      const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
      if (!existsExact(ROOT, path.relative(ROOT, path.resolve(path.dirname(file), clean)).split(path.sep).join('/'))) cssMissing.push(`css/${css} -> ${ref}`);
    }
  }
  g.check(cssMissing.length === 0, 'CSS url()/@import targets exist', cssMissing.slice(0, 12).join('\n'));

  // Font Awesome: every icon class used in the HTML or JS exists in the bundled FA CSS (a missing glyph renders as an empty circle)
  {
    const faCss = fs.readFileSync(path.join(ROOT, 'css/font-awesome-6/css/all.css'), 'utf8');
    const SKIP = new Set(['fa-solid', 'fa-regular', 'fa-brands', 'fa-fw', 'fa-lg', 'fa-2x', 'fa-3x', 'fa-spin', 'fa-xs', 'fa-sm']);
    const used = new Set();
    for (const src of [html, fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8')]) {
      for (const m of src.matchAll(/class="([^"]*\bfa-[^"]*)"/g)) for (const k of m[1].split(/\s+/)) if (/^fa-/.test(k) && !SKIP.has(k)) used.add(k);
    }
    const missingIcons = [...used].filter((k) => !faCss.includes('.' + k + '::before') && !faCss.includes('.' + k + ':before'));
    g.check(missingIcons.length === 0, `all ${used.size} Font Awesome icon classes exist in the bundled font (no empty glyphs)`, 'missing: ' + missingIcons.join(', '));
  }

  // the page loads css/font-awesome-6/css/subset.css (only the icons in use): it must be current, and the page must link it instead of the 130 KB all.css
  try {
    execFileSync('node', [path.join(TOOLS, 'build-fa-subset.mjs'), '--check'], { cwd: TOOLS, stdio: 'pipe', env: { ...process.env, SITE_ROOT: ROOT } });
    g.pass('Font Awesome subset (subset.css) is up to date with the icons the page uses');
  } catch (e) {
    g.fail('Font Awesome subset is out of date (an icon was added or removed)', 'run: node build-fa-subset.mjs');
  }
  g.check(html.includes('href="css/font-awesome-6/css/subset.css"') && !html.includes('font-awesome-6/css/all.css'), 'the page links the small Font Awesome subset, not the full 130 KB stylesheet');

  // 4) ids unique + anchors resolve
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  g.check(dup.length === 0, 'element ids are unique', `duplicates: ${[...new Set(dup)].join(', ')}`);
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]).filter((a) => a);
  const badAnchors = [...new Set(anchors)].filter((a) => !ids.includes(a));
  g.check(badAnchors.length === 0, 'in-page anchors resolve', `unresolved: ${badAnchors.join(', ')}`);

  // 5) head / a11y basics
  g.check(/<html[^>]*\slang="en"/.test(html), '<html lang="en"> (default language) present');
  g.check(!/maximum-scale|user-scalable\s*=\s*no/.test(html), 'viewport does not block zoom');
  g.check(/<meta name="viewport" content="width=device-width, initial-scale=1">/.test(html), 'viewport meta present');
  g.check(/<link rel="canonical"/.test(html) && /hreflang="en"/.test(html) && /hreflang="pt-BR"/.test(html) && /hreflang="es"/.test(html) && /hreflang="x-default"/.test(html), 'canonical + hreflang (en, pt-BR, es, x-default) present');
  for (const p of ['og:title', 'og:description', 'og:image', 'og:locale', 'og:url']) g.check(html.includes(`property="${p}"`), `Open Graph ${p} present`);
  g.check(html.includes('name="twitter:card"'), 'twitter:card present');
  const imgsNoAlt = [...html.matchAll(/<img\b[^>]*>/g)].filter((m) => !/\salt=/.test(m[0]));
  g.check(imgsNoAlt.length === 0, 'every <img> has an alt attribute', imgsNoAlt.slice(0, 3).map((m) => m[0]).join('\n'));
  const iconOnly = [...html.matchAll(/<a\b([^>]*)>\s*<i\b[^>]*><\/i>\s*<\/a>/g)].filter((m) => !/aria-label=|data-i18n-attr="[^"]*aria-label/.test(m[1]));
  g.check(iconOnly.length === 0, 'icon-only links have an accessible name (aria-label)', iconOnly.slice(0, 3).map((m) => m[0]).join('\n'));
  g.check(/class="skip-link" href="#main"/.test(html), 'skip link present');
  // external links of the experience/talks timelines must be a visible "link chip" (not a plain-looking name)
  const hidden = [...html.matchAll(/<a\b[^>]*href="(https?:\/\/(?:www\.clicksign\.com|ada\.tech|thedevconf\.com|www\.youtube\.com)[^"]*)"[^>]*>/g)].filter((m) => !/class="link-chip"/.test(m[0]));
  g.check(hidden.length === 0, 'timeline external links (company, event, episode) are visible link chips', hidden.map((m) => m[1]).join(', '));
  g.check(![...html.matchAll(/<a\b[^>]*class="link-chip"[^>]*>/g)].some((m) => !/target="_blank"/.test(m[0]) || !/rel="noopener"/.test(m[0])), 'link chips open in a new tab with rel="noopener"');
  g.check((html.match(/<script src=/g) || []).length === 8, 'script tags as expected (jquery, plugins, en.js, pt.js, es.js, i18n.js, main.js, analytics.js: no Modernizr, Pace or jQuery Migrate)', `found ${(html.match(/<script src=/g) || []).length}`);

  // 6) JSON-LD: parses, has no PII
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ld) g.fail('JSON-LD Person block missing');
  else {
    try {
      const j = JSON.parse(ld[1]);
      g.check(j['@type'] === 'Person' && j.jobTitle === facts.identity.title, 'JSON-LD is a Person with the Staff job title');
      const piiKeys = ['birthDate', 'telephone', 'email', 'homeLocation', 'taxID', 'nationality'];
      g.check(!piiKeys.some((k) => k in j) && !('streetAddress' in (j.address || {})) && !('addressLocality' in (j.address || {})), 'JSON-LD has no PII fields (birthDate, telephone, email, street/city)');
      g.check(j.sameAs?.includes(facts.identity.linkedin) && j.sameAs?.includes(facts.identity.github), 'JSON-LD sameAs matches ledger (LinkedIn, GitHub)');
    } catch (e) { g.fail('JSON-LD does not parse', e.message); }
  }

  // 7) forbidden / stale / private strings: raw HTML + both dictionaries + CSS/JS shipped to the browser
  const en = loadDictRaw('en');
  const pt = loadDictRaw('pt');
  const es = loadDictRaw('es');
  const corpora = {
    'index.html': html,
    'en.js values': Object.values(en).join('\n'),
    'pt.js values': Object.values(pt).join('\n'),
    'es.js values': Object.values(es).join('\n'),
    'main.js': fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'),
    'i18n.js': fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8'),
  };
  for (const f of facts.forbidden.patterns.filter((p) => p.scope === 'site' || p.scope === 'all')) {
    const re = new RegExp(f.re, 'i');
    const hits = Object.entries(corpora).filter(([, txt]) => re.test(txt)).map(([k]) => k);
    g.check(hits.length === 0, `forbidden /${f.re}/ absent (${f.why})`, `found in: ${hits.join(', ')}`);
  }
  // 8) PII must not exist anywhere in tracked text files (history cannot be fixed here; the working tree can)
  const tracked = ['index.html', 'robots.txt', 'sitemap.xml', 'js/main.js', 'js/i18n.js', 'js/i18n', 'css/staff.css', '_cv'];
  for (const f of facts.forbidden.patterns.filter((p) => p.scope === 'all')) {
    try {
      const out = execFileSync('git', ['grep', '-I', '-n', '-i', '-P', f.re, '--', ...tracked], { cwd: ROOT, encoding: 'utf8' });
      g.fail(`git grep: forbidden /${f.re}/ found in tracked files (${f.why})`, out.split('\n').slice(0, 3).join('\n'));
    } catch (e) {
      if (e.status === 1) g.pass(`git grep: /${f.re}/ absent from tracked site files`);
      else g.warn('git grep unavailable (not a git checkout?)', String(e.message).slice(0, 120));
    }
  }
  if (!facts.privatePatternsLoaded) g.warn('private-forbidden.json not found: only generic PII shapes were checked (exact phone/birth values not loaded)');
  return g;
}
