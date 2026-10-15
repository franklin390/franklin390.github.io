// G6 — Links: every external URL on the page answers (network problems and bot-blocks are WARN, 404/410 are FAIL),
// local PDFs really are PDFs, and the CV links point at real, non-empty files.
import fs from 'node:fs';
import path from 'node:path';
import { Gate } from './lib/report.mjs';
import { ROOT } from './lib/common.mjs';

export const id = 'G6';

async function probe(url) {
  const opts = { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (portfolio-link-check)' } };
  try {
    const r = await fetch(url, { ...opts, method: 'GET' });
    return { status: r.status };
  } catch (e) {
    return { error: e.cause?.code || e.name || String(e.message) };
  }
}

export async function run() {
  const g = new Gate('G6', 'Links (external reachability, local PDFs)');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ext = [...new Set([...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]))].filter((u) => !/googletagmanager|fonts\.g/.test(u));
  const results = await Promise.all(ext.map(async (u) => [u, await probe(u)]));
  let netDown = 0;
  // addresses of THIS site (the language pages, the social card...) exist as files in the repository: that is the check that matters
  // before a deploy. Online they are only a warning, because a new page answers 404 until it is published.
  const own = (u) => {
    const m = u.match(/^https:\/\/franklin390\.github\.io(\/[^?#]*)$/);
    if (!m) return null;
    const rel = decodeURIComponent(m[1]).replace(/^\//, '');
    const file = rel === '' || rel.endsWith('/') ? rel + 'index.html' : rel;
    return fs.existsSync(path.join(ROOT, file)) ? file : null;
  };
  for (const [u, r] of results) {
    const local = own(u);
    if (local) {
      g.pass(`${u} is a file of this repository (${local})`);
      if (r.status && r.status >= 400) g.warn(`${u} → ${r.status} online: not published yet? (it exists in the repository)`);
      continue;
    }
    if (r.error) { netDown++; g.warn(`could not reach ${u} from this machine (${r.error})`); continue; }
    if (r.status >= 200 && r.status < 400) g.pass(`${u} → ${r.status}`);
    else if ([401, 403, 429, 999].includes(r.status)) g.warn(`${u} → ${r.status} (site blocks automated checks; verify manually)`);
    else g.fail(`${u} → ${r.status}`);
  }
  if (netDown) g.info(`${netDown}/${ext.length} external URLs unreachable from this environment — run \`npm run verify:links\` on a normal connection to confirm them`);

  // local PDFs: real PDF header and non-empty
  const pdfs = [...new Set([...html.matchAll(/(?:href|data-href-en|data-href-pt)="([^"]+\.pdf)"/g)].map((m) => decodeURIComponent(m[1])))];
  for (const p of pdfs) {
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) { g.fail(`PDF missing: ${p}`); continue; }
    const head = fs.readFileSync(f).subarray(0, 5).toString('latin1');
    g.check(head === '%PDF-' && fs.statSync(f).size > 1000, `PDF valid: ${p}`, `header=${head}`);
  }
  return g;
}
