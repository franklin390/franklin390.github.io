// Extracts "copy units" (one string + where it lives) from the site dictionaries and from the CV sources,
// so the voice/keyword/provenance gates can reason about the actual words without a browser.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, LANGS } from './common.mjs';
import { loadBoth } from './dict.mjs';

// Dictionary keys that are chrome / archive material rather than new prose.
const LEGACY = /^(a11y\.|lang\.|carousel\.|link\.|nav\.|train\.|projects\.|talks\.|work\.filter\.|exp\.label\.|social\.|footer\.|about\.lang\.|about\.photo|edu\.|meta\.locale)/;

export const words = (s) => (s.toLowerCase().match(/[a-zà-ÿ0-9][a-zà-ÿ0-9'’+#./-]*/g) || []);
export const sentences = (s) => s.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý0-9"“(])/).map((x) => x.trim()).filter(Boolean);

export function siteUnits() {
  const d = loadBoth();
  const units = [];
  for (const lang of LANGS) {
    for (const [key, text] of Object.entries(d[lang])) {
      units.push({ id: `site:${lang}:${key}`, key, artifact: 'site', lang, text, legacy: LEGACY.test(key), meta: /^meta\./.test(key), group: key.replace(/\.[^.]+$/, '') });
    }
  }
  return units;
}

/** Language-neutral skill tags that live only in index.html (translate="no" <li>s). */
export function htmlNeutralTags() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<li[^>]*translate="no"[^>]*>([^<]+)<\/li>/g)].map((m) => m[1].trim());
}

/** the "Technologies:" lines of the role slides: hand-written tool names in index.html (not in the dictionaries) */
export function htmlRoleTech() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<p class="role-tech">[\s\S]*?<span translate="no">([^<]+)<\/span>/g)].map((m) => m[1].trim());
}

export function cvUnits() {
  const units = [];
  for (const lang of LANGS) {
    const cv = JSON.parse(fs.readFileSync(path.join(ROOT, `_cv/${lang}.json`), 'utf8'));
    const add = (p, text, extra = {}) => { if (typeof text === 'string' && text.trim()) units.push({ id: `cv:${lang}:${p}`, key: p, artifact: 'cv', lang, text, legacy: false, meta: false, group: p.replace(/\[\d+\]$/, ''), ...extra }); };
    add('summary', cv.summary);
    add('tagline', cv.tagline, { title: true });
    add('pdfKeywords', cv.pdfKeywords, { title: true });
    (cv.highlights || []).forEach((h, i) => add(`highlights[${i}]`, h.label, { title: true }));
    (cv.courses || []).forEach((x, i) => add(`courses[${i}]`, x, { title: true, training: true, archive: true }));
    cv.competencies.forEach((c, i) => add(`competencies[${i}]`, c.items, { title: true }));
    cv.experience.forEach((co, ci) => co.roles.forEach((r, ri) => {
      const base = `experience[${ci}].roles[${ri}]`;
      add(`${base}.intro`, r.intro);
      (r.bullets || []).forEach((b, bi) => add(`${base}.bullets[${bi}]`, b, { bullet: true }));
      add(`${base}.tech`, r.tech, { title: true });
    }));
    (cv.certifications || []).forEach((c, i) => { add(`certifications[${i}].title`, c.title, { title: true, training: true, archive: true }); add(`certifications[${i}].desc`, c.desc, { training: true }); });
    (cv.talks || []).forEach((t, i) => add(`talks[${i}].title`, t.title, { title: true, training: true, archive: true }));
  }
  return units;
}
