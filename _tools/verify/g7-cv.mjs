// G7 — CV PDFs (EN + PT + ES): A4, <= 2 pages, embedded fonts, real selectable text (no letter-spacing artefacts),
// section order, link annotations, metadata + language, alias, and EN/PT/ES structural parity.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Gate } from './lib/report.mjs';
import { fmt } from './lib/dates.mjs';
import { ROOT, TOOLS, readJson, pdfText, LANGS } from './lib/common.mjs';
import { CV_FILES } from './g3-facts.mjs';

export const id = 'G7';

const SECTIONS = {
  en: ['Summary', 'Career path', 'Core competencies', 'Experience', 'Education', 'Certifications', 'Talks & research', 'Languages'],
  pt: ['Resumo', 'Trajetória', 'Competências', 'Experiência', 'Formação', 'Certificações', 'Palestras e pesquisa', 'Idiomas'],
  es: ['Resumen', 'Trayectoria', 'Competencias', 'Experiencia', 'Formación', 'Certificaciones', 'Charlas e investigación', 'Idiomas'],
};
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function inspect(file) {
  const py = `
import json, sys, fitz
d = fitz.open(sys.argv[1])
cat = d.pdf_catalog()
out = {
  'pages': d.page_count,
  'size': [round(d[0].rect.width), round(d[0].rect.height)],
  'meta': d.metadata,
  'lang': d.xref_get_key(cat, 'Lang')[1],
  'tagged': d.xref_get_key(cat, 'StructTreeRoot')[0] != 'null',
  'fonts': [[f[3], f[1]] for p in d for f in p.get_fonts(full=True)],
  'links': [l.get('uri') for p in d for l in p.get_links() if l.get('uri')],
  'chars': sum(len(p.get_text()) for p in d),
  'images': sum(len(p.get_images()) for p in d),
}
print(json.dumps(out))`;
  return JSON.parse(execFileSync('python', ['-I', '-c', py, file], { encoding: 'utf8' }));
}

export async function run() {
  const g = new Gate('G7', 'CV PDFs (EN, PT & ES)');
  const src = Object.fromEntries(LANGS.map((l) => [l, readJson(path.join(ROOT, `_cv/${l}.json`))]));
  const texts = {};

  for (const lang of LANGS) {
    const L = lang.toUpperCase();
    const file = path.join(ROOT, CV_FILES[lang]);
    if (!fs.existsSync(file)) { g.fail(`[${L}] CV missing: ${CV_FILES[lang]}`); continue; }
    const info = inspect(file);
    const raw = pdfText(file, 'raw');
    const layout = pdfText(file, 'layout');
    texts[lang] = raw;

    g.check(fs.readFileSync(file).subarray(0, 5).toString() === '%PDF-', `[${L}] is a PDF`);
    g.check(info.size[0] === 595 && info.size[1] === 842, `[${L}] A4 page size (${info.size.join('x')} pt)`);
    g.check(info.pages <= 2, `[${L}] at most 2 pages (${info.pages})`);
    g.check(fs.statSync(file).size < 300 * 1024, `[${L}] file size < 300 KB (${Math.round(fs.statSync(file).size / 1024)} KB)`);
    g.check(info.fonts.length > 0 && info.fonts.every(([, ext]) => ext && ext !== 'n/a'), `[${L}] all fonts embedded (${[...new Set(info.fonts.map((f) => f[0]))].join(', ')})`, JSON.stringify(info.fonts));
    g.check(info.images === 0 && info.chars > 2500, `[${L}] real selectable text, no raster content (${info.chars} chars, ${info.images} images)`);
    g.check(info.tagged, `[${L}] tagged PDF (accessibility structure tree)`);

    // text extraction health (what an ATS sees)
    const spaced = raw.match(/(?:\b\w\b ){6,}/);
    g.check(!spaced, `[${L}] no letter-spacing artefacts in extracted text (the old CV extracted as "C e l u l a r")`, spaced ? spaced[0] : '');
    for (const [mode, t] of [['raw', raw], ['layout', layout]]) {
      let pos = -1; let ok = true; let at = '';
      for (const h of SECTIONS[lang]) {
        const i = t.toUpperCase().indexOf(h.toUpperCase(), pos + 1);
        if (i < 0 || i < pos) { ok = false; at = h; break; }
        pos = i;
      }
      g.check(ok, `[${L}] section headings appear in order in pdftotext -${mode}`, `stopped at "${at}"`);
    }
    // reading order: inside every role the extracted text must run title -> intro -> bullets (in order) -> technologies
    const flat = raw.replace(/\s+/g, ' ').replace(/(\w)- (?=[a-zà-ú])/gi, '$1-').replace(/• /g, '');
    const orderBad = [];
    const flatUp = flat.toUpperCase();
    let cursor = Math.max(0, flatUp.indexOf(src[lang].labels.experience.toUpperCase(), Math.max(0, flatUp.indexOf(src[lang].labels.competencies.toUpperCase()))));
    for (const co of src[lang].experience) {
      cursor = Math.max(cursor, flat.indexOf(co.company, cursor));
      for (const r of co.roles) {
        const seq = [r.title, ...(r.intro ? [r.intro] : []), ...r.bullets, ...(r.tech ? [src[lang].labels.technologies + ' ' + r.tech] : [])];
        for (const piece of seq) {
          const i = flat.indexOf(piece.replace(/\s+/g, ' '), cursor);
          if (i < 0) { orderBad.push(`${r.title}: "${piece.slice(0, 45)}…" not found after previous element`); break; }
          cursor = i + 1;
        }
      }
    }
    g.check(orderBad.length === 0, `[${L}] reading order inside roles is title → intro → bullets → technologies (what an ATS parses)`, orderBad.slice(0, 5).join('\n'));
    // reading order of the WHOLE document in the raw text stream (what an ATS reads): a marker from every block, strictly increasing
    {
      const s = src[lang];
      const flatAll = raw.replace(/\s+/g, ' ');
      const up = flatAll.toUpperCase();
      const lastCo = s.experience[s.experience.length - 1].company;
      const marks = [
        ['summary heading', s.labels.summary.toUpperCase(), up], ['summary text', s.summary.slice(0, 30), flatAll], ['key numbers', s.highlights[0].label.slice(0, 12), flatAll],
        ['career path heading', s.labels.path.toUpperCase(), up], ['competencies heading', s.labels.competencies.toUpperCase(), up], ['first competency', s.competencies[0].label, flatAll],
        ['experience heading', s.labels.experience.toUpperCase(), up], ['first employer', s.experience[0].company, flatAll], ['last employer', lastCo, flatAll],
        ['education heading', s.labels.education.toUpperCase(), up], ['first school', s.education[0].school, flatAll],
        ['certifications heading', s.labels.certifications.toUpperCase(), up], ['first certification', s.certifications[0].title, flatAll], ['selected courses', s.labels.courses, flatAll],
        ['talks heading', s.labels.talks.toUpperCase(), up], ['first talk', s.talks[0].title.slice(0, 25), flatAll],
        ['languages heading', s.labels.languages.toUpperCase(), up], ['first language', s.languages[0].name, flatAll]
      ];
      let p = -1; const bad = [];
      for (const [name, needle, hay] of marks) {
        const i = hay.indexOf(needle, Math.max(0, p + 1));
        if (i < 0 || i < p) { bad.push(name); break; }
        p = i;
      }
      g.check(bad.length === 0, `[${L}] the whole document reads in order in the text stream (summary → key numbers → career path → competencies → experience → education → certifications → talks → languages)`, 'out of order at: ' + bad.join(', '));
    }
    // chronology: everything is newest-first, and the career path reads oldest-first and comes from the experience data
    {
      const s = src[lang];
      const end = (x) => (x.end === 'present' || !x.end ? '9999-99' : x.end);
      const desc = (arr, key) => arr.every((x, i) => i === 0 || key(arr[i - 1]) >= key(x));
      g.check(desc(s.experience, (co) => end(co) + '|' + co.start) && s.experience.every((co) => desc(co.roles, (r) => r.start + '|' + end(r))), `[${L}] employers and roles are listed newest first`);
      g.check(desc(s.education, (e) => end(e)) && desc(s.certifications, (x) => x.date) && desc(s.talks, (x) => end(x) + '|' + x.start), `[${L}] education, certifications and talks are listed newest first (certifications: ${s.certifications.map((x) => x.date).join(' > ')})`);
      const nodes = s.experience.filter((co) => !co.concurrent).flatMap((co) => co.roles.map((r) => ({ start: r.start, title: r.title.replace(/\s*\([^)]*\)/, ''), company: co.company }))).sort((a, b) => (a.start < b.start ? -1 : 1));
      const f2 = raw.replace(/\s+/g, ' ');
      const a0 = f2.toUpperCase().indexOf(s.labels.path.toUpperCase()), a1 = f2.toUpperCase().indexOf(s.labels.competencies.toUpperCase(), a0);
      const seg = a0 >= 0 && a1 > a0 ? f2.slice(a0, a1) : '';
      let at = 0, okPath = seg.length > 0;
      for (const n of nodes) { const i = seg.indexOf(fmt(n.start, lang), at); const j = i < 0 ? -1 : seg.indexOf(n.title, i); if (i < 0 || j < 0) { okPath = false; break; } at = j; }
      g.check(okPath && nodes.length >= 5, `[${L}] the career path in the PDF lists ${nodes.length} roles from ${fmt(nodes[0].start, lang)} to ${fmt(nodes[nodes.length - 1].start, lang)}, oldest first, built from the experience data`, seg.slice(0, 200));
      const overlap = (a, b) => a.start <= end(b) && b.start <= end(a);
      const flagged = s.experience.filter((co) => co.concurrent);
      g.check(flagged.every((co) => co.note && raw.replace(/\s+/g, ' ').includes(co.note) && s.experience.some((o) => o !== co && !o.concurrent && overlap(co, o))), `[${L}] a role marked as running alongside another employer really overlaps it in time and says so (${flagged.map((c) => c.note).join('; ')})`);
      g.check((s.highlights || []).length === 6 && s.highlights.every((h) => raw.includes(h.value)), `[${L}] the key-numbers strip shows its 6 figures (${(s.highlights || []).map((h) => h.value).join(' ')})`);
    }
    g.check(/^Franklin Ferreira/m.test(raw) && raw.includes('Staff Data Engineer'), `[${L}] name and title are the first lines`);
    g.check(!/\b(Cientista de Dados e Arquiteto|Data Group Lead)\b/.test(raw), `[${L}] no stale titles`);

    // links
    const want = [`mailto:${src[lang].contact.email}`, src[lang].contact.linkedinUrl, src[lang].contact.githubUrl, src[lang].contact.portfolioUrl];
    const missing = want.filter((u) => !info.links.includes(u));
    g.check(missing.length === 0, `[${L}] clickable links present (email, LinkedIn, GitHub, portfolio)`, `missing: ${missing.join(', ')}; found: ${info.links.join(', ')}`);

    // metadata
    g.check(info.meta.title === src[lang].pdfTitle && info.meta.author === 'Franklin Ferreira' && !!info.meta.subject && !!info.meta.keywords, `[${L}] metadata: title/author/subject/keywords set`, JSON.stringify(info.meta));
    g.check(info.lang.replace(/[()]/g, '') === src[lang].htmlLang, `[${L}] document language tag is ${src[lang].htmlLang}`, info.lang);
  }

  // alias for the old URL serves the new PT CV
  const alias = path.join(ROOT, 'pdf/cv/Franklin_Ferreira_Cientista_de_Dados_CV.pdf');
  if (fs.existsSync(alias) && fs.existsSync(path.join(ROOT, CV_FILES.pt))) {
    g.check(sha(alias) === sha(path.join(ROOT, CV_FILES.pt)), 'legacy URL (…Cientista_de_Dados_CV.pdf) is byte-identical to the new PT CV');
  } else g.fail('legacy alias CV missing');

  // EN/PT/ES structural parity (source JSON) + same bullet count in the PDFs
  const shape = (c) => ({
    competencies: c.competencies.length,
    companies: c.experience.map((x) => [x.company, x.start, x.end, x.roles.map((r) => [r.start, r.end, r.bullets.length, !!r.tech, !!r.intro])]),
    education: c.education.map((e) => [e.school, e.start, e.end]),
    certifications: c.certifications.map((x) => [x.issuer, x.date, !!x.desc]),
    highlights: (c.highlights || []).map((h) => h.value),
    courses: (c.courses || []).length,
    concurrent: c.experience.map((co) => !!co.concurrent),
    talks: c.talks.map((x) => [x.start, x.end || null]),
    languages: c.languages.length,
  });
  const numbers = (c) => JSON.stringify([(c.highlights || []).map((h) => h.value), c.experience.flatMap((x) => x.roles.flatMap((r) => [r.intro || '', ...r.bullets])).map((s) => (s.match(/[~>]?\d+(?:[.,]\d+)?[+%x]?/g) || []).join(' '))]);
  const bullets = (t) => (t.replace(/\f/g, '\n').match(/^•/gm) || []).length; // pdftotext prefixes a page's first line with a form feed
  for (const other of LANGS.filter((l) => l !== 'en')) {
    const U = other.toUpperCase();
    g.check(JSON.stringify(shape(src.en)) === JSON.stringify(shape(src[other])), `EN and ${U} CVs have identical structure, companies, roles, bullet counts and dates`, 'source JSON shapes differ');
    g.check(numbers(src.en) === numbers(src[other]), `numbers and affixes per bullet are identical in EN and ${U}`);
    if (texts.en && texts[other]) g.check(bullets(texts.en) === bullets(texts[other]) && bullets(texts.en) > 10, `bullet count equal in both PDFs (EN ${bullets(texts.en)} vs ${U} ${bullets(texts[other])})`);
  }
  return g;
}
