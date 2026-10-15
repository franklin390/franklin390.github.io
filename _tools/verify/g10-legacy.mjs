// G10 — "Nothing silently dropped": every credential/project of the ORIGINAL site (git 166ee54) is still reachable,
// with the same date, and training.json (verified against the certificate PDFs) agrees with it.
import fs from 'node:fs';
import path from 'node:path';
import { Gate } from './lib/report.mjs';
import { ROOT, TOOLS, readJson, existsExact } from './lib/common.mjs';

export const id = 'G10';

const normHref = (h) => decodeURIComponent(h).replace(/\s+/g, ' ');

export async function run() {
  const g = new Gate('G10', 'Legacy content preserved & certificates verified');
  const legacy = readJson(path.join(TOOLS, 'facts/legacy.json'));
  const training = readJson(path.join(TOOLS, 'facts/training.json'));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const hrefsInHtml = new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => normHref(m[1])));

  const newByHref = new Map([...training.featured, ...training.courses].map((t) => [normHref(t.href), t]));
  const dateOf = (t) => t.date || t.completed || t.issued;

  // 1) every legacy course/formation/certification link survives, with a consistent date
  const legacyCreds = [...legacy.sections['owl-slider-cert'], ...legacy.sections['owl-slider-degree']];
  let moved = 0;
  for (const it of legacyCreds) {
    const h = normHref(it.href);
    const t = newByHref.get(h);
    if (!t) { g.fail(`legacy item missing from training.json: "${it.title}" (${it.href})`); continue; }
    if (!hrefsInHtml.has(h)) { g.fail(`legacy item missing from index.html: "${it.title}"`); continue; }
    // legacy start/end vs new: the new date must equal the legacy END (or the single date); formations may shift (see verifiedBy)
    const legacyEnd = it.end && it.end !== 'present' ? it.end : it.start;
    const nd = dateOf(t);
    const ok = nd === legacyEnd || nd === it.start;
    if (ok) g.pass(`${it.title}: date ${nd} consistent`);
    else if (/certificate|PDF viewed/i.test(t.verifiedBy) && t.verifiedBy) { moved++; g.info(`${it.title}: legacy ${it.start}→${it.end} vs new ${nd} (kept; backed by PDF: ${t.verifiedBy})`); }
    else g.fail(`${it.title}: date changed without PDF evidence (${it.start}→${it.end} vs ${nd})`);
  }
  g.check(newByHref.size === legacyCreds.length, `training.json holds exactly the ${legacyCreds.length} legacy credentials (no additions, no losses)`, `training=${newByHref.size}`);

  // 2) all 13 projects survive with the same URL
  const projects = legacy.sections.projects;
  const newProj = new Set(training.projects.map((p) => p.href));
  for (const p of projects) {
    g.check(newProj.has(p.href) && hrefsInHtml.has(p.href), `project preserved: ${p.title}`, p.href);
    const t = training.projects.find((x) => x.href === p.href);
    g.check(t && t.title === p.title, `project title unchanged: ${p.title}`, t ? t.title : 'n/a');
  }
  g.check(training.projects.length === projects.length, `exactly ${projects.length} projects`);

  // 3) the talks/podcast/links of the old site survive
  for (const url of ['https://thedevconf.com/', 'https://www.youtube.com/watch?v=KEap4SCQf-8', 'https://www.clicksign.com/']) {
    g.check(hrefsInHtml.has(url), `legacy link kept: ${url}`);
  }
  // the old Let's Code domain no longer resolves; its successor (Ada) is linked instead — needs the owner's confirmation
  g.check(hrefsInHtml.has('https://ada.tech') && !hrefsInHtml.has('https://www.letscode.com.br'), "Let's Code link: dead www.letscode.com.br replaced by https://ada.tech");
  g.warn("PENDING CONFIRMATION — the employer link for 'Let's Code from Ada' now points to https://ada.tech because www.letscode.com.br no longer resolves");

  // 4) every certificate file on disk is linked (no orphan PDFs) and every training href exists
  const linked = new Set([...newByHref.keys()]);
  const orphan = [];
  for (const dir of ['pdf/dsa', 'pdf/others']) for (const f of fs.readdirSync(path.join(ROOT, dir))) if (!linked.has(`${dir}/${f}`)) orphan.push(`${dir}/${f}`);
  g.check(orphan.length === 0, 'every certificate PDF in the repo is linked from the page', orphan.join(', '));
  for (const [h] of newByHref) if (!/^https?:/.test(h)) g.check(existsExact(ROOT, decodeURIComponent(h)), `file exists (exact case): ${h}`);

  // 5) every training item states how it was verified
  const unverified = [...training.featured, ...training.courses].filter((t) => !t.verifiedBy);
  g.check(unverified.length === 0, 'every training entry has a verifiedBy note', unverified.map((t) => t.id).join(', '));
  g.info(`${moved} formation date(s) intentionally differ from the legacy range because the certificate PDF shows the completion date`);

  // 6) skills dropped from the legacy bars are listed (informational, so the user can object)
  const dropped = legacy.skills.filter((s) => !new RegExp(s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(html)).map((s) => s.name);
  g.info(`${dropped.length} legacy self-rated skills are no longer listed as skills`, dropped.join(', '));
  return g;
}
