// G2 — i18n integrity (EN/PT/ES): key parity, no empties, translations differ from EN, protected tokens identical, glossary,
// language leakage (EN/PT/ES kept apart), text-length expansion, used/unused keys, and DOM coverage (every visible text
// node is translated or `translate="no"`).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { Gate } from './lib/report.mjs';
import { ROOT, TOOLS, readJson, LANGS } from './lib/common.mjs';
import { getEnv, collectTextNodes } from './lib/browser.mjs';

export const id = 'G2';

const loadDict = (lang) => {
  const sandbox = { window: { I18N: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, `js/i18n/${lang}.js`), 'utf8'), sandbox);
  return sandbox.window.I18N[lang];
};

const EN_FUNCTION = new Set(['the', 'and', 'of', 'with', 'for', 'to', 'in', 'on', 'by', 'from', 'is', 'are', 'was', 'that', 'this', 'it', 'at', 'as', 'an', 'or']);
// words that exist in Portuguese but NOT in Spanish (and the other way round): "de", "que", "para", "por" are shared, so they prove nothing
const PT_ONLY = new Set(['não', 'uma', 'um', 'dos', 'das', 'da', 'do', 'ao', 'os', 'as', 'seu', 'sua', 'é', 'com', 'também', 'são', 'já', 'pela', 'pelo', 'nas', 'nos', 'você', 'mais', 'muito', 'até', 'na']);
const ES_ONLY = new Set(['el', 'los', 'las', 'del', 'una', 'con', 'y', 'sus', 'su', 'es', 'más', 'un', 'en', 'al', 'lo', 'también', 'esta', 'este', 'estas', 'estos']);
const words = (s) => s.toLowerCase().replace(/[^a-zà-ú0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);
const distinctHits = (s, set) => [...new Set(words(s).filter((w) => set.has(w)))];

// numbers with affixes + protected tech names
function tokens(s, protectedList) {
  const toks = [];
  for (const m of s.matchAll(/[~>]?\d+(?:[.,]\d+)?[+%x×]?/g)) toks.push(m[0].replace('×', 'x'));
  for (const t of protectedList) {
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'), 'g');
    for (const _ of s.matchAll(re)) toks.push(t);
  }
  return toks.sort();
}

export async function run(ctx) {
  const g = new Gate('G2', 'i18n integrity (EN/PT/ES)');
  const D = Object.fromEntries(LANGS.map((l) => [l, loadDict(l)]));
  const en = D.en;
  const TARGETS = LANGS.filter((l) => l !== 'en');
  const gl = readJson(path.join(TOOLS, 'glossary.json'));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ek = Object.keys(en);
  const sameAllowed = new Set(gl.sameInBothLanguages);

  for (const L of TARGETS) {
    const T = D[L], U = L.toUpperCase(), tk = Object.keys(T);

    // 1) key parity + no empties
    g.check(ek.length === tk.length && ek.every((k) => k in T), `EN and ${U} define the same ${ek.length} keys`,
      `missing in ${U}: ${ek.filter((k) => !(k in T)).join(', ')}\nextra in ${U}: ${tk.filter((k) => !(k in en)).join(', ')}`);
    const empty = [...ek.filter((k) => !String(en[k]).trim()), ...tk.filter((k) => !String(T[k]).trim())];
    g.check(empty.length === 0, `no empty translations (${U})`, empty.join(', '));
    const nonString = ek.filter((k) => typeof en[k] !== 'string' || typeof T[k] !== 'string');
    g.check(nonString.length === 0, `all ${U} values are strings`, nonString.join(', '));

    // 3) differs from EN unless allow-listed
    const same = ek.filter((k) => en[k] === T[k] && !sameAllowed.has(k) && !(gl.sameInLang?.[L] || []).includes(k));
    g.check(same.length === 0, `${U} differs from EN (apart from allow-listed proper nouns)`, same.join(', '));

    // 4) protected tokens identical per key
    const bad = [];
    for (const k of ek) {
      const a = tokens(en[k], gl.protectedTokens).join('|');
      const b = tokens(T[k] || '', gl.protectedTokens).join('|');
      if (a !== b) bad.push(`${k}\n    EN: ${a || '-'}\n    ${U}: ${b || '-'}`);
    }
    g.check(bad.length === 0, `numbers, % / + / ~ affixes and tech names identical in EN and ${U} for every key`, bad.slice(0, 8).join('\n'));

    // 5) glossary
    const gbad = [];
    for (const k of ek) for (const t of gl.terms) {
      if (!t[L]) continue;
      let src = en[k]; for (const x of t.stripFromEn || []) src = src.split(x).join('');
      if (src.toLowerCase().includes(t.en.toLowerCase()) && !t[L].some((p) => T[k].toLowerCase().includes(p.toLowerCase()))) gbad.push(`${k}: EN has "${t.en}" but ${U} lacks ${t[L].map((x) => `"${x}"`).join(' / ')}`);
    }
    g.check(gbad.length === 0, `glossary terms translated consistently (${U})`, gbad.slice(0, 10).join('\n'));

    // 6) language leakage
    const leakEnglish = tk.filter((k) => !gl.englishTermsAllowedInPt.includes(k) && distinctHits(T[k], EN_FUNCTION).length >= 2);
    g.check(leakEnglish.length === 0, `no English function words in ${U} strings`, leakEnglish.map((k) => `${k}: ${distinctHits(T[k], EN_FUNCTION).join(',')}`).join('\n'));
    const other = L === 'pt' ? ['es', ES_ONLY, 'Spanish'] : ['pt', PT_ONLY, 'Portuguese'];
    const leakOther = tk.filter((k) => distinctHits(T[k], other[1]).length >= 3);
    g.check(leakOther.length === 0, `no ${other[2]} function words in ${U} strings`, leakOther.map((k) => `${k}: ${distinctHits(T[k], other[1]).join(',')}`).join('\n'));
    if (L === 'es') {
      const ptChars = tk.filter((k) => /[ãõç]/i.test(T[k]) && !/Educação/.test(T[k]));
      g.check(ptChars.length === 0, 'ES strings contain no Portuguese-only letters (ã õ ç)', ptChars.join(', '));
    }

    // 7) length expansion (UI overflow risk): informational
    const ratios = ek.filter((k) => en[k].length > 25).map((k) => [k, T[k].length / en[k].length]);
    const outliers = ratios.filter(([, r]) => r > 1.5 || r < 0.7);
    if (outliers.length) g.warn(`${outliers.length} string(s) with ${U}/EN length ratio outside 0.7–1.5 (check layout)`, outliers.map(([k, r]) => `${k}: ${r.toFixed(2)}`).join('\n'));
    else g.pass(`${U}/EN length ratios within 0.7–1.5`);
    const avg = ratios.reduce((s, [, r]) => s + r, 0) / ratios.length;
    g.info(`average ${U}/EN length ratio: ${avg.toFixed(2)}`);
  }

  // ES must not simply be the PT text
  {
    const copied = ek.filter((k) => D.es[k] === D.pt[k] && !sameAllowed.has(k) && !(gl.sameEsAndPt || []).includes(k));
    g.check(copied.length === 0, 'ES is not a copy of PT (apart from allow-listed proper nouns)', copied.join(', '));
  }

  // 2) keys used in HTML <-> dictionary
  const used = new Set([...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const p of m[1].split(';')) used.add(p.split(':')[1].trim());
  const runtimeKeys = new Set(['lang.announce', 'carousel.prev', 'carousel.next', 'work.filter.showing']); // used by JS / Owl at runtime, not in index.html
  const usedMissing = [...used].filter((k) => !(k in en));
  g.check(usedMissing.length === 0, `all ${used.size} keys used in index.html exist in the dictionaries`, usedMissing.join(', '));
  const unused = ek.filter((k) => !used.has(k) && !runtimeKeys.has(k));
  g.check(unused.length === 0, 'no unused dictionary keys', unused.join(', '));

  // 6b) EN strings contain no other language
  const leakEn = ek.filter((k) => distinctHits(en[k], PT_ONLY).length >= 3 || distinctHits(en[k], ES_ONLY).length >= 3);
  g.check(leakEn.length === 0, 'no Portuguese or Spanish function words in EN strings', leakEn.map((k) => `${k}: ${[...distinctHits(en[k], PT_ONLY), ...distinctHits(en[k], ES_ONLY)].join(',')}`).join('\n'));
  const accentsInEn = ek.filter((k) => /[ãõçñáéíóúâêô¿¡]/i.test(en[k]) && !/Educação|Pontifícia|Católica/.test(en[k]));
  g.check(accentsInEn.length === 0, 'EN strings contain no Portuguese or Spanish accents', accentsInEn.join(', '));

  // 8) no markup in plain-text values (data-i18n uses textContent)
  const htmlKeys = new Set([...html.matchAll(/data-i18n-html="([^"]+)"/g)].map((m) => m[1]));
  const markup = ek.filter((k) => !htmlKeys.has(k) && /<[a-z/]/i.test(LANGS.map((l) => D[l][k]).join(' ')));
  g.check(markup.length === 0, 'no HTML markup inside plain-text dictionary values', markup.join(', '));

  // 9) DOM coverage in a real browser, every language
  const env = await getEnv(ctx);
  for (const lang of LANGS) {
    const s = await env.open(lang);
    const nodes = await s.page.evaluate(collectTextNodes);
    const uncovered = nodes.filter((n) => !n.covered);
    g.check(uncovered.length === 0, `[${lang}] every text node is translated or marked translate="no" (${nodes.length} nodes)`,
      uncovered.slice(0, 12).map((n) => `<${n.tag}#${n.id}> "${n.text.slice(0, 60)}"`).join('\n'));
    // attributes with human text
    const attrs = await s.page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('[alt],[title],[aria-label]')) {
        for (const a of ['alt', 'title', 'aria-label']) {
          const v = el.getAttribute(a);
          if (!v || !v.trim()) continue;
          const spec = el.getAttribute('data-i18n-attr') || '';
          const covered = spec.split(';').some((p) => p.split(':')[0].trim() === a) || !!el.closest('[translate="no"]');
          if (!covered) out.push(`<${el.tagName.toLowerCase()}> ${a}="${v.slice(0, 50)}"`);
        }
      }
      return out;
    });
    g.check(attrs.length === 0, `[${lang}] alt/title/aria-label attributes are translated or marked translate="no"`, attrs.slice(0, 10).join('\n'));
    await s.close();
  }
  return g;
}
