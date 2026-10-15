import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// SITE_ROOT lets the self-test point every gate at a mutated copy of the site
export const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.resolve(TOOLS, '..');
export const OUT = path.join(TOOLS, 'out');

// Languages of the site and the CVs. Gates loop over these; English is the default and the reference text.
export const LANGS = ['en', 'pt', 'es'];
export const LANG_LABEL = { en: 'EN', pt: 'PT', es: 'ES' };
export const HTML_LANG = { en: 'en', pt: 'pt-BR', es: 'es' };
export const OG_LOCALE = { en: 'en_US', pt: 'pt_BR', es: 'es_LA' };
export const CV_FILE = Object.fromEntries(LANGS.map((l) => [l, `pdf/cv/Franklin_Ferreira_Staff_Data_Engineer_CV_${l.toUpperCase()}.pdf`]));
export const LEGACY_COMMIT = '166ee54'; // last commit before this refresh (portfolio as it was)

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const loadFacts = () => {
  const facts = readJson(path.join(TOOLS, 'facts/facts.json'));
  const priv = path.join(TOOLS, 'fixtures/private-forbidden.json'); // local only (git-ignored): exact private values
  if (fs.existsSync(priv)) facts.forbidden.patterns.push(...readJson(priv).patterns);
  facts.privatePatternsLoaded = fs.existsSync(priv);
  return facts;
};

/** Aggressive normalisation for literal-evidence matching: accent/case/punctuation/whitespace insensitive,
 *  but keeps ~ + % > because they change the meaning of a number. */
export function norm(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9~+%>]+/g, '');
}

export function pdfText(pdfPath, mode = 'raw') {
  const args = mode === 'layout' ? ['-layout'] : ['-raw'];
  return execFileSync('pdftotext', [...args, '-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** LinkedIn export text without the 'Page x of y' footers that split sentences across pages. */
export function linkedinText() {
  const pdf = process.env.LINKEDIN_PDF || path.join(TOOLS, 'fixtures/linkedin-profile.pdf');
  if (!fs.existsSync(pdf)) throw new Error(`LinkedIn export not found: ${pdf} (set LINKEDIN_PDF)`);
  return pdfText(pdf).split('\n').filter((l) => !/^Page \d+ of \d+$/.test(l.trim())).join('\n');
}

export function gitShow(file, rev = LEGACY_COMMIT) {
  return execFileSync('git', ['show', `${rev}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Case-sensitive existence check (GitHub Pages serves from Linux; Windows/macOS file systems are case-insensitive). */
export function existsExact(root, rel) {
  let dir = root;
  for (const seg of rel.split('/').filter(Boolean)) {
    let names;
    try { names = fs.readdirSync(dir); } catch (e) { return false; }
    if (!names.includes(seg)) return false;
    dir = path.join(dir, seg);
  }
  return true;
}
