// G0 — Ledger fidelity: every evidence string in facts.json must exist literally in the LinkedIn export.
import { Gate } from './lib/report.mjs';
import { loadFacts, linkedinText, norm } from './lib/common.mjs';

export const id = 'G0';
export async function run() {
  const g = new Gate('G0', 'Ledger fidelity vs LinkedIn export');
  const facts = loadFacts();
  const pdf = norm(linkedinText());
  g.info(`LinkedIn export text: ${pdf.length} normalised chars`);

  const checkEvidence = (label, evidence) => {
    if (!evidence || !evidence.length) { g.fail(`${label}: no evidence`); return; }
    for (const e of evidence) g.check(pdf.includes(norm(e)), `${label}: evidence found`, `not in LinkedIn export: "${e}"`);
  };

  checkEvidence('identity.headline', facts.identity.headlineEvidence);
  checkEvidence('identity.email', facts.identity.emailEvidence);
  checkEvidence('identity.linkedin', facts.identity.linkedinEvidence);
  for (const c of facts.companies) checkEvidence(`company:${c.id}`, c.evidence);
  for (const r of facts.roles) {
    checkEvidence(`role:${r.id}`, r.evidence);
    if (r.pendingConfirmation) g.warn(`role:${r.id} end date derived (${r.end})`, r.pendingConfirmation);
    if (r.confirmedByOwner) g.info(`role:${r.id} end date ${r.end} confirmed by the owner`, r.confirmedByOwner);
  }
  for (const e of facts.education) checkEvidence(`education:${e.id}`, e.evidence);
  for (const e of facts.research) checkEvidence(`research:${e.id}`, e.evidence);
  for (const l of facts.languages) checkEvidence(`language:${l.id}`, l.evidence);
  for (const c of facts.claims) {
    if (c.source === 'owner') {
      // not in the LinkedIn export: confirmed by the owner. It must say when and what exactly was confirmed, and stays visible as a warning.
      g.check(!!c.confirmedOn && !!c.note && !c.evidence, `claim:${c.id} is owner-confirmed with a date and a note (no LinkedIn evidence expected)`);
      g.warn(`claim:${c.id} confirmed by the owner on ${c.confirmedOn}, not in the LinkedIn export`, c.note);
      continue;
    }
    checkEvidence(`claim:${c.id}`, c.evidence);
  }
  for (const m of facts.metrics.allowed) checkEvidence(`metric:${m.token}`, m.evidence);
  for (const s of [...facts.skillsCore.items, ...facts.skillsCore.leadershipAllowed]) {
    // single skill names: must appear somewhere in the export (headline, technologies, summary)
    g.check(pdf.includes(norm(s)), `skill:${s} appears in LinkedIn export`, `"${s}" not found`);
  }
  return g;
}
