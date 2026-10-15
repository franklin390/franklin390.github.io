// G12 — Keywords and provenance.
//  1) every keyword recruiters/ATS look for is present (site EN/PT, CV EN/PT) and none is stuffed;
//  2) nothing is invented: every tool, acronym, camelCase brand or proper noun in the new copy exists in the LinkedIn export;
//  3) technologies that appear in the export only as COURSE content (Spark, Kafka, ...) never show up as work experience.
import fs from 'node:fs';
import path from 'node:path';
import { Gate } from './lib/report.mjs';
import { ROOT, TOOLS, readJson, linkedinText, LANGS } from './lib/common.mjs';
import { siteUnits, cvUnits, htmlNeutralTags, htmlRoleTech } from './lib/copy.mjs';

export const id = 'G12';

const fold = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
const boundary = (term) => new RegExp('(^|[^a-z0-9])' + esc(fold(term)) + '($|[^a-z0-9])', 'i');

export async function run() {
  const g = new Gate('G12', 'Keywords (coverage, no stuffing) and provenance (nothing invented)');
  const cfg = readJson(path.join(TOOLS, 'facts/keywords.json'));
  const li = fold(linkedinText()).replace(/\s+/g, ' ');
  const inLinkedIn = (term) => boundary(term).test(li);
  const P = cfg.provenance;
  const confirmed = new Set(P.userConfirmed.map(fold));
  const neutral = new Set(P.neutral.map(fold));

  const site = siteUnits();
  const cv = cvUnits();
  const tags = htmlNeutralTags().map((t, i) => ({ id: `site:html-tag:${i}`, key: `html tag "${t}"`, artifact: 'site', lang: 'en', text: t }));
  const tagsBy = Object.fromEntries(LANGS.map((l) => [l, tags.map((u) => ({ ...u, lang: l }))]));

  // ---- 1) coverage + stuffing
  const corpus = (art, lang) => {
    const us = art === 'site' ? [...site.filter((u) => u.lang === lang), ...tagsBy[lang]] : cv.filter((u) => u.lang === lang);
    return us.map((u) => u.text).join('\n');
  };
  const text = { site: Object.fromEntries(LANGS.map((l) => [l, corpus('site', l)])), cv: Object.fromEntries(LANGS.map((l) => [l, corpus('cv', l)])) };
  let must = 0, mustOk = 0;
  const missing = [], stuffed = [];
  for (const k of cfg.keywords) {
    for (const art of k.where) for (const lang of LANGS) {
      const re = new RegExp('(' + k[lang].join('|') + ')', 'gi');
      const n = (text[art][lang].match(re) || []).length;
      if (k.level === 'must') { must++; if (n > 0) mustOk++; }
      if (n === 0) missing.push(`${k.level.toUpperCase()} ${k.id} missing in ${art} ${lang.toUpperCase()}`);
      const cap = art === 'site' ? k.maxSite : k.maxCv;
      if (cap && n > cap) stuffed.push(`${k.id} appears ${n}x in ${art} ${lang.toUpperCase()} (cap ${cap})`);
    }
  }
  const mustMissing = missing.filter((m) => m.startsWith('MUST'));
  g.check(mustMissing.length === 0, `all ${cfg.keywords.filter((k) => k.level === 'must').length} must-have keywords appear in the site and the CV, EN and PT (${mustOk}/${must} slots)`, mustMissing.join('\n'));
  const niceMissing = missing.filter((m) => m.startsWith('NICE'));
  if (niceMissing.length) g.warn('nice-to-have keywords missing', niceMissing.join('\n'));
  g.check(stuffed.length === 0, 'no keyword is repeated beyond its cap (no stuffing)', stuffed.join('\n'));

  // ---- 2) provenance
  // the "Technologies:" line of each role slide is hand-written in index.html (tool names, same in every language)
  const roleTech = htmlRoleTech().map((t, i) => ({ id: `site:role-tech:${i}`, key: `role technologies line ${i + 1}`, artifact: 'site', lang: 'en', text: t }));
  const scope = [
    ...site.filter((u) => !u.legacy && u.key !== 'meta.title'),
    ...LANGS.flatMap((l) => tagsBy[l]),
    ...roleTech,
    ...cv.filter((u) => !u.archive) // certificate and talk titles are checked by G10 against the legacy site
  ];
  const unknown = new Map();
  const note = (u, term) => { const k = fold(term); if (!unknown.has(k)) unknown.set(k, new Set()); unknown.get(k).add(u.key); };
  const known = (term) => { const k = fold(term); return neutral.has(k) || confirmed.has(k) || inLinkedIn(term); };
  for (const u of scope) {
    const t = u.text;
    const f = fold(t);
    // known tools and techniques
    for (const term of P.techVocabulary) if (boundary(term).test(f) && !known(term)) note(u, term);
    // acronyms and camelCase brands
    for (const m of t.matchAll(/\b[A-Z]{2,}[A-Z0-9]*\b/g)) if (!known(m[0])) note(u, m[0]);
    for (const m of t.matchAll(/\b[A-Z][a-z]+(?:[A-Z][A-Za-z]+)+\b/g)) if (!known(m[0])) note(u, m[0]);
    // capitalised words in the middle of a sentence (company, product and place names): EN only, because PT title-case
    // headings ("Arquitetura e Governança de Dados") are not names, and every name is already proven in the EN text
    if (u.lang === 'en') for (const s of t.split(/(?<=[.!?:])\s+/)) {
      const toks = [...s.matchAll(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]+/g)];
      toks.forEach((m, i) => { if (i > 0 && /^[A-ZÀ-Ý]/.test(m[0]) && /[a-zà-ÿ]/.test(m[0]) && !known(m[0])) note(u, m[0]); });
    }
  }
  const unk = [...unknown].map(([term, keys]) => `"${term}" in ${[...keys].slice(0, 3).join(', ')}${keys.size > 3 ? ' …' : ''}`);
  g.check(unk.length === 0, `every tool, acronym and proper noun in the copy exists in the LinkedIn export (${scope.length} texts checked)`, unk.join('\n'));

  // ---- 3) course-only technologies must not be claimed as experience
  const claimed = [];
  for (const u of scope) {
    if (u.training || /^train\./.test(u.key)) continue;
    for (const term of P.trainingOnly) if (boundary(term).test(fold(u.text)) && !confirmed.has(fold(term))) claimed.push(`"${term}" in ${u.key}`);
  }
  g.check(claimed.length === 0, `technologies seen in the export only as course content (${P.trainingOnly.length} terms) are not presented as work experience`, claimed.join('\n'));

  // ---- 4) JSON-LD knowsAbout must come from the export too
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch (e) { return null; } }).filter(Boolean);
  const knows = ld.flatMap((o) => o.knowsAbout || []);
  const offLd = knows.filter((k) => !known(k) && !(k.split(/[\s/&,-]+/).filter((w) => w.length > 3).every((w) => known(w))));
  g.check(ld.length > 0 && offLd.length === 0, `JSON-LD knowsAbout (${knows.length} topics) is backed by the export`, offLd.join(', '));
  return g;
}
