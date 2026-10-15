// Tiny gate/report framework: each gate collects checks; run-all aggregates them.
export class Gate {
  constructor(id, name) { this.id = id; this.name = name; this.checks = []; Gate.latest.set(id, this); }
  pass(msg) { this.checks.push({ status: 'pass', msg }); }
  fail(msg, detail) { this.checks.push({ status: 'fail', msg, detail }); }
  warn(msg, detail) { this.checks.push({ status: 'warn', msg, detail }); }
  info(msg, detail) { this.checks.push({ status: 'info', msg, detail }); }
  /** assert helper: cond ? pass : fail */
  check(cond, msg, detail) { cond ? this.pass(msg) : this.fail(msg, detail); return cond; }
  get failed() { return this.checks.filter((c) => c.status === 'fail').length; }
  get warned() { return this.checks.filter((c) => c.status === 'warn').length; }
  get passed() { return this.checks.filter((c) => c.status === 'pass').length; }
}

/** most recent Gate per id: lets run-all keep the checks a gate had recorded before it crashed */
Gate.latest = new Map();

export function renderMarkdown(gates, meta = {}) {
  const lines = [`# Verification report`, '', `Generated: ${new Date().toISOString()}`, ...Object.entries(meta).map(([k, v]) => `- ${k}: ${v}`), ''];
  lines.push('| Gate | Name | Pass | Fail | Warn |', '|---|---|---:|---:|---:|');
  for (const g of gates) lines.push(`| ${g.id} | ${g.name} | ${g.passed} | ${g.failed} | ${g.warned} |`);
  for (const g of gates) {
    lines.push('', `## ${g.id} — ${g.name}`);
    for (const c of g.checks.filter((c) => c.status !== 'pass')) {
      const icon = { fail: 'FAIL', warn: 'WARN', info: 'INFO' }[c.status];
      lines.push(`- **${icon}** ${c.msg}${c.detail ? `\n  - ${String(c.detail).split('\n').join('\n  - ')}` : ''}`);
    }
    if (g.checks.every((c) => c.status === 'pass')) lines.push('- all checks passed');
  }
  return lines.join('\n');
}
