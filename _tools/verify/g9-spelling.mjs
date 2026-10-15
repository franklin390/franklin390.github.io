// G9 — Spelling: EN (en.js), Brazilian-Portuguese (pt.js) and Spanish (es.js) dictionaries with cspell; also the CV sources.
// cspell silently skips files outside its working directory, so it runs FROM the site root and every run must report
// "Files checked >= 1" (a blind spell-checker fails the gate). Canary files with known typos prove it can see errors.
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { Gate } from './lib/report.mjs';
import { ROOT, TOOLS, LANGS } from './lib/common.mjs';

export const id = 'G9';

function spell(relFile, locale) {
  const bin = path.join(TOOLS, 'node_modules/cspell/bin.mjs');
  const r = spawnSync('node', [bin, '--no-progress', '--config', path.join(TOOLS, 'cspell.json'), '--locale', locale, '--root', ROOT, relFile], { cwd: ROOT, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const checked = Number((out.match(/Files checked:\s*(\d+)/) || [])[1] || 0);
  const words = [...new Set([...out.matchAll(/Unknown word \(([^)]+)\)/g)].map((m) => m[1]))];
  return { words, checked, out };
}

// visible text only (never dictionary KEYS, ids, urls or e-mails)
function valuesOf(rel) {
  const full = path.join(ROOT, rel);
  if (rel.endsWith('.js')) {
    const sandbox = { window: { I18N: {} } };
    vm.runInNewContext(fs.readFileSync(full, 'utf8'), sandbox);
    return Object.values(Object.values(sandbox.window.I18N)[0]);
  }
  const out = [];
  const walk = (v, key) => {
    if (typeof v === 'string') { if (!['lang', 'htmlLang', 'email', 'linkedin', 'github', 'portfolio', 'linkedinUrl', 'githubUrl', 'portfolioUrl', 'start', 'end', 'date', 'pdfKeywords'].includes(key)) out.push(v); }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  walk(JSON.parse(fs.readFileSync(full, 'utf8')));
  return out;
}

export async function run() {
  const g = new Gate('G9', 'Spelling (EN, PT-BR and ES)');

  // canaries (written inside the site root so cspell can see them)
  const canaryDir = path.join(ROOT, 'g9-canary');
  fs.mkdirSync(canaryDir, { recursive: true });
  try {
    fs.writeFileSync(path.join(canaryDir, 'en.js'), 'window.I18N={en:{a:"I helped bild the platfrom and the enviroment"}};\n');
    fs.writeFileSync(path.join(canaryDir, 'pt.js'), 'window.I18N={pt:{a:"Arquitetei os processos de proteção de dados e governança",b:"habiliade e Javascrit e bliblioteca"}};\n');
    fs.writeFileSync(path.join(canaryDir, 'es.js'), 'window.I18N={es:{a:"Diseñé los procesos de protección de datos y gobernanza",b:"habiliadd y Javascrit y bibliotca"}};\n');
    const enC = spell('g9-canary/en.js', 'en');
    const esC = spell('g9-canary/es.js', 'es');
    const ptC = spell('g9-canary/pt.js', 'pt-BR');
    g.check(enC.checked === 1 && ['bild', 'platfrom', 'enviroment'].every((w) => enC.words.includes(w)), 'canary: EN checker sees and flags known typos', `checked=${enC.checked} words=${enC.words.join(', ')}`);
    g.check(ptC.checked === 1 && ['habiliade', 'Javascrit', 'bliblioteca'].every((w) => ptC.words.includes(w)) && !ptC.words.includes('Arquitetei') && !ptC.words.includes('governança'), 'canary: PT-BR checker flags typos and accepts correct Portuguese', `checked=${ptC.checked} words=${ptC.words.join(', ')}`);
    g.check(esC.checked === 1 && ['habiliadd', 'Javascrit', 'bibliotca'].every((w) => esC.words.includes(w)) && !esC.words.includes('Diseñé') && !esC.words.includes('gobernanza'), 'canary: ES checker flags typos and accepts correct Spanish', `checked=${esC.checked} words=${esC.words.join(', ')}`);
  } finally {
    fs.rmSync(canaryDir, { recursive: true, force: true });
  }

  const LOCALE = { en: 'en', pt: 'pt-BR', es: 'es' };
  const targets = LANGS.map((l) => [`js/i18n/${l}.js`, LOCALE[l]]);
  for (const l of LANGS) if (fs.existsSync(path.join(ROOT, `_cv/${l}.json`))) targets.push([`_cv/${l}.json`, LOCALE[l]]);
  const textDir = path.join(ROOT, 'g9-text');
  fs.mkdirSync(textDir, { recursive: true });
  for (const [file, locale] of targets) {
    const tmpRel = 'g9-text/' + file.replace(/[\/]/g, '_') + '.txt';
    fs.writeFileSync(path.join(ROOT, tmpRel), valuesOf(file).join('\n') + '\n');
    const r = spell(tmpRel, locale);
    g.check(r.checked >= 1, `${file}: file was actually inspected (Files checked: ${r.checked})`, r.out.slice(0, 200));
    g.check(r.words.length === 0, `${file}: no spelling issues in visible text (${locale})`, `unknown words: ${r.words.join(', ')}`);
  }
  fs.rmSync(textDir, { recursive: true, force: true });
  return g;
}
