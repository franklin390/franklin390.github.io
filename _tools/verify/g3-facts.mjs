// G3 — Fact consistency: site (EN+PT+ES) and CV PDFs (EN+PT+ES) are checked AGAINST the independent ledger.
//   • every claim token present      • roles/companies/dates present in the right block
//   • invented numbers rejected      • forbidden strings absent      • skills tags ⊆ ledger vocabulary
import fs from 'node:fs';
import path from 'node:path';
import { Gate } from './lib/report.mjs';
import { ROOT, loadFacts, norm, pdfText, LANGS, CV_FILE } from './lib/common.mjs';
import { range, fmt } from './lib/dates.mjs';
import { getEnv, collectTextNodes } from './lib/browser.mjs';

export const id = 'G3';

export const CV_FILES = CV_FILE;

const ROLE_DOM = { 'fb-staff': 'role-fb-staff', 'fb-techlead': 'role-fb-techlead', 'fb-de': 'role-fb-de', 'ck-lead': 'role-ck-lead', 'ck-arch': 'role-ck-arch', 'ck-ds': 'role-ck-ds', 'lc-adj': 'role-lc' };
const COMPANY_DOM = { flutter: 'exp-flutter', clicksign: 'exp-clicksign', letscode: 'exp-letscode' };
const EDU_DOM = { pucrs: 'edu-pucrs', xp: 'edu-xp', uezo: 'edu-uezo' };

const dashes = (s) => s.replace(/[–—‑]/g, '-').replace(/\s+/g, ' ');
const has = (hay, needle) => norm(hay).includes(norm(needle));

/** unit-bearing numbers: 15+, >50%, ~3x, ~50, 100+ ... */
const NUMBER_RE = /(?:[~>]\s?\d+(?:[.,]\d+)?\s?[%x×+]?|\d+(?:[.,]\d+)?\s?(?:%|x\b|×|\+(?![\w])))/g;

export async function run(ctx) {
  const g = new Gate('G3', 'Fact consistency (site + CV vs ledger)');
  const facts = loadFacts();
  const env = await getEnv(ctx);

  const site = {};
  const blocks = {};
  const tags = {};
  for (const lang of LANGS) {
    const s = await env.open(lang);
    const nodes = await s.page.evaluate(collectTextNodes);
    site[lang] = dashes(nodes.map((n) => n.text).join('\n'));
    blocks[lang] = await s.page.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll('[id]')) out[el.id] = el.textContent.replace(/\s+/g, ' ').trim();
      return out;
    });
    tags[lang] = await s.page.evaluate(() => [...document.querySelectorAll('.tags li')].map((li) => li.textContent.trim()));
    await s.close();
  }

  // CV text (skipped until the CVs are built)
  const cv = {};
  for (const lang of LANGS) {
    const f = path.join(ROOT, CV_FILES[lang]);
    if (fs.existsSync(f)) cv[lang] = dashes(pdfText(f, 'raw')).replace(/(\w)- (?=[a-zà-ú])/gi, '$1-'); // re-join words hyphen-wrapped at line ends
  }
  const cvBuilt = Object.keys(cv).length === LANGS.length;
  if (!cvBuilt) g.warn('CV PDFs not built yet — CV fact checks skipped', Object.values(CV_FILES).join('\n'));

  for (const lang of LANGS) {
    const L = lang.toUpperCase();
    // identity
    g.check(site[lang].includes(facts.identity.title), `[site ${L}] shows title "${facts.identity.title}"`);
    g.check(site[lang].toLowerCase().includes('brazil') || site[lang].includes('Brasil'), `[site ${L}] shows location Brazil/Brasil`);
    g.check(site[lang].includes(facts.identity.location[lang]), `[site ${L}] location is exactly "${facts.identity.location[lang]}"`);

    // claims
    for (const c of facts.claims) {
      for (const where of c.where) {
        const text = where === 'site' ? site[lang] : cv[lang];
        if (where === 'cv' && !cvBuilt) continue;
        const miss = c[lang].filter((re) => !new RegExp(re, 'i').test(text));
        g.check(miss.length === 0, `[${where} ${L}] claim "${c.id}" present`, `missing patterns: ${miss.join(' , ')}`);
      }
    }

    // roles / companies / dates, inside their own DOM block
    for (const r of facts.roles) {
      const blk = dashes(blocks[lang][ROLE_DOM[r.id]] || '');
      const title = (lang === 'pt' && r.titlePt) || (lang === 'es' && r.titleEs) || r.title;
      g.check(has(blk, title), `[site ${L}] role ${r.id}: title "${title}" in its block`, blk.slice(0, 120));
      const co = facts.companies.find((c) => c.id === r.company);
      g.check(has(blk, co.name), `[site ${L}] role ${r.id}: employer "${co.name}" in its slide`, blk.slice(0, 120));
      const expected = dashes(range(r.start, r.end, lang));
      g.check(blk.includes(expected), `[site ${L}] role ${r.id}: dates "${expected}" in its block`, blk.slice(0, 160));
    }
    for (const e of facts.education) {
      const blk = dashes(blocks[lang][EDU_DOM[e.id]] || '');
      g.check(has(blk, e.school), `[site ${L}] education ${e.id}: school present`);
      g.check(blk.includes(dashes(range(e.start, e.end, lang))), `[site ${L}] education ${e.id}: dates "${range(e.start, e.end, lang)}"`, blk.slice(0, 160));
    }
    const r0 = facts.research[0];
    g.check(dashes(blocks[lang]['talk-research'] || '').includes(dashes(range(r0.start, r0.end, lang))), `[site ${L}] undergraduate research dates "${range(r0.start, r0.end, lang)}"`);
    for (const l of facts.languages) {
      const lvl = { pt: l.levelPt, es: l.levelEs }[lang] || l.levelEn;
      g.check(has(site[lang], lvl) && has(site[lang], l.name[lang]), `[site ${L}] language ${l.name[lang]} — ${lvl}`);
    }

    // invented numbers
    const allowed = new Set(facts.metrics.allowed.flatMap((m) => [m.token, ...(m.alt || [])]).map((t) => t.replace(/\s/g, '')));
    for (const [label, text] of [['site', site[lang]], ...(cvBuilt ? [['cv', cv[lang]]] : [])]) {
      const found = [...new Set([...text.matchAll(NUMBER_RE)].map((m) => m[0].replace(/\s/g, '').replace('×', 'x')))];
      const bad = found.filter((t) => !allowed.has(t) && !allowed.has(t.replace(/^[~>]/, '')) && ![...allowed].some((a) => a.replace(/^[~>]/, '') === t.replace(/^[~>]/, '')));
      g.check(bad.length === 0, `[${label} ${L}] no unit-bearing numbers outside the ledger (${found.join(' ')})`, `not in ledger: ${bad.join(' ')}`);
    }

    // forbidden strings on rendered text
    for (const f of facts.forbidden.patterns) {
      const re = new RegExp(f.re, 'i');
      const targets = [];
      if (f.scope === 'site' || f.scope === 'all') targets.push(['site', site[lang]]);
      if ((f.scope === 'cv' || f.scope === 'all') && cvBuilt) targets.push(['cv', cv[lang]]);
      for (const [label, text] of targets) {
        const m = text.match(re);
        const allowedHit = m && (f.allowIn || []).some((a) => text.slice(Math.max(0, m.index - 12), m.index + m[0].length + 12).includes(a));
        g.check(!m || allowedHit, `[${label} ${L}] forbidden /${f.re}/ absent`, m ? `…${text.slice(Math.max(0, m.index - 30), m.index + 40)}…` : '');
      }
    }
  }

  // skills vocabulary (EN render is enough: tags are language-neutral or translated)
  const vocab = [...facts.skillsCore.items, ...facts.skillsCore.leadershipAllowed, ...(facts.skillsCore.ownerConfirmed || [])].map(norm);
  const offVocab = tags.en.filter((t) => !vocab.some((v) => norm(t).includes(v) || v.includes(norm(t))));
  g.check(offVocab.length === 0, `skill tags (${tags.en.length}) come only from the ledger vocabulary (LinkedIn, plus ${(facts.skillsCore.ownerConfirmed || []).length} tools confirmed by the owner)`, `not in ledger: ${offVocab.join(', ')}`);
  g.check(LANGS.every((l) => tags[l].length === tags.en.length), 'same number of skill tags in EN, PT and ES');

  // pending confirmations are surfaced, never hidden
  for (const r of facts.roles.filter((x) => x.pendingConfirmation)) g.warn(`PENDING CONFIRMATION — ${r.title}: end date ${fmt(r.end, 'en')} is derived`, r.pendingConfirmation);
  const xp = facts.education.find((e) => e.id === 'xp');
  if (xp && xp.confirmedByOwner) g.info('"MBA in Data Engineering (XP Educação)" is on LinkedIn only; confirmed by the owner', xp.confirmedByOwner);
  else g.warn('PENDING CONFIRMATION — "MBA in Data Engineering (XP Educação)" comes from LinkedIn only; the certificates in the repo are two 148h bootcamps ("curso de formação profissional"), not an MBA diploma.');
  return g;
}
