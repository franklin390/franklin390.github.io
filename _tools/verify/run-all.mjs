// Runs every gate module present in verify/ (g*.mjs), prints a summary, writes out/report.{json,md}.
// Usage: node verify/run-all.mjs [G0 G1 ...]   (no args = all)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown } from './lib/report.mjs';
import { OUT } from './lib/common.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2).map((s) => s.toUpperCase());
const files = fs.readdirSync(dir).filter((f) => /^g\d+-.*\.mjs$/.test(f)).sort();

const ctx = { cleanup: [] };
const gates = [];
for (const f of files) {
  const mod = await import(path.join(dir, f).replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
  if (only.length && !only.includes(mod.id)) continue;
  const t0 = Date.now();
  try {
    gates.push(await mod.run(ctx));
  } catch (e) {
    const { Gate } = await import('./lib/report.mjs');
    // keep everything the gate had already found: a crash must not hide the failures that caused it
    const g = Gate.latest.get(mod.id) || new Gate(mod.id, `${f} (crashed)`);
    g.fail('gate crashed', e.stack || String(e));
    gates.push(g);
  }
  const g = gates[gates.length - 1];
  console.log(`${g.failed ? '✗' : '✓'} ${g.id} ${g.name}  pass=${g.passed} fail=${g.failed} warn=${g.warned}  (${Date.now() - t0}ms)`);
}
for (const fn of ctx.cleanup) await fn();

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(gates, null, 2));
fs.writeFileSync(path.join(OUT, 'report.md'), renderMarkdown(gates));
const failed = gates.reduce((n, g) => n + g.failed, 0);
for (const g of gates) for (const c of g.checks.filter((c) => c.status === 'fail')) console.log(`  FAIL [${g.id}] ${c.msg}${c.detail ? ' — ' + String(c.detail).split('\n')[0] : ''}`);
console.log(failed ? `\n${failed} check(s) FAILED — see _tools/out/report.md` : '\nAll gates passed — _tools/out/report.md');
process.exit(failed ? 1 : 0);
