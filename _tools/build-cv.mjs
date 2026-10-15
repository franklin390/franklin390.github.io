// Builds the CV PDFs (EN + PT + ES) from _cv/{en,pt,es}.json with Chrome (single column, real text, ATS-friendly).
// Usage: node build-cv.mjs            -> pdf/cv/Franklin_Ferreira_Staff_Data_Engineer_CV_{EN,PT,ES}.pdf (+ legacy alias = PT)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { ROOT, TOOLS, OUT, readJson } from './verify/lib/common.mjs';
import { range, fmt } from './verify/lib/dates.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderHtml(c) {
  const L = c.lang;
  const d = (a, b) => esc(range(a, b, L));
  const css = fs.readFileSync(path.join(ROOT, '_cv/cv.css'), 'utf8').replaceAll('{{FONTS}}', pathToFileURL(path.join(ROOT, 'fonts/poppins')).href);
  const k = c.contact;
  const exp = c.experience.map((co) => `
  <div class="company">
    <div class="company-head"><span class="co-left"><span class="company-name">${esc(co.company)}</span>${co.note ? `<span class="co-note">${esc(co.note)}</span>` : ''}</span><span class="dates">${d(co.start, co.end)}</span></div>
    ${co.roles.map((r) => `
    <div class="role">
      <div class="role-head"><span class="role-title">${esc(r.title)}</span><span class="dates">${d(r.start, r.end)}</span></div>
      ${r.intro ? `<p class="intro">${esc(r.intro)}</p>` : ''}
      <ul class="b">${r.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      ${r.tech ? `<p class="tech"><b>${esc(c.labels.technologies)}</b> ${esc(r.tech)}</p>` : ''}
    </div>`).join('')}
  </div>`).join('');
  // career path: every role of the main employers, oldest first (built from the experience data, so it can never drift from it)
  const pathNodes = c.experience.filter((co) => !co.concurrent)
    .flatMap((co) => co.roles.map((r) => ({ start: r.start, title: r.title, company: co.company })))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const pathHtml = `<ol class="path">${pathNodes.map((n, i) => `<li${i === pathNodes.length - 1 ? ' class="now"' : ''}><span class="p-date">${esc(fmt(n.start, L))}</span><span class="p-title">${esc(n.title.replace(/\s*\([^)]*\)/, ''))}</span><span class="p-co">${esc(n.company)}</span></li>`).join('')}</ol>`;
  const kpis = c.highlights ? `<ul class="kpis">${c.highlights.map((h) => `<li><span class="n">${esc(h.value)}</span><span class="l">${esc(h.label)}</span></li>`).join('')}</ul>` : '';
  return `<!doctype html>
<html lang="${c.htmlLang}"><head><meta charset="utf-8"><title>${esc(c.pdfTitle)}</title><style>${css}</style></head>
<body>
<header class="cv-head">
  <h1>${esc(c.name)}</h1>
  <div class="headline-row"><p class="headline">${esc(c.headline)}</p><span class="loc">${esc(c.location)}</span></div>
  <p class="tagline">${esc(c.tagline)}</p>
  <p class="contact"><span><a href="mailto:${k.email}">${k.email}</a></span><span><a href="${k.linkedinUrl}">${k.linkedin}</a></span><span><a href="${k.githubUrl}">${k.github}</a></span><span><a href="${k.portfolioUrl}">${k.portfolio}</a></span></p>
</header>
<section><h2>${esc(c.labels.summary)}</h2><p class="summary">${esc(c.summary)}</p>${kpis}</section>
<section><h2>${esc(c.labels.path)}</h2>${pathHtml}</section>
<section><h2>${esc(c.labels.competencies)}</h2><ul class="comp">${c.competencies.map((x) => `<li><b>${esc(x.label)}:</b> ${esc(x.items)}</li>`).join('')}</ul></section>
<section><h2>${esc(c.labels.experience)}</h2>${exp}</section>
<section><h2>${esc(c.labels.education)}</h2>${c.education.map((e) => `<div class="edu"><span class="l"><b>${esc(e.school)}</b> — ${esc(e.degree)}</span><span class="dates">${d(e.start, e.end)}</span></div>`).join('')}</section>
<section><h2>${esc(c.labels.certifications)}</h2>${c.certifications.map((x) => `<div class="cert"><span class="l"><b>${esc(x.title)}</b> — <span class="small">${esc(x.issuer)}</span></span><span class="dates">${d(x.date)}</span></div>${x.desc ? `<p class="cert-desc">${esc(x.desc)}</p>` : ''}`).join('')}${c.courses ? `<p class="courses"><b>${esc(c.labels.courses)}:</b> ${c.courses.map(esc).join('; ')}.</p>` : ''}</section>
<section><h2>${esc(c.labels.talks)}</h2>${c.talks.map((x) => `<div class="talk"><span class="l">${esc(x.title)}</span><span class="dates">${d(x.start, x.end)}</span></div>`).join('')}</section>
<section><h2>${esc(c.labels.languages)}</h2><div class="lang-row">${c.languages.map((x) => `<span><b>${esc(x.name)}</b> — ${esc(x.level)}</span>`).join('')}</div></section>
</body></html>`;
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const outDir = process.env.CV_OUT_DIR || path.join(ROOT, 'pdf/cv'); // CV_OUT_DIR: build somewhere else (e.g. a mirror) when the real PDFs are open in a viewer
  for (const lang of ['en', 'pt', 'es']) {
    const c = readJson(path.join(ROOT, `_cv/${lang}.json`));
    const htmlFile = path.join(OUT, `cv-${lang}.html`);
    fs.writeFileSync(htmlFile, renderHtml(c));
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const raw = path.join(OUT, `cv-${lang}.raw.pdf`);
    await page.pdf({ path: raw, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: false });
    await page.close();
    const dest = path.join(outDir, `Franklin_Ferreira_Staff_Data_Engineer_CV_${lang.toUpperCase()}.pdf`);
    execFileSync('python', ['-I', path.join(TOOLS, 'pdf_meta.py'), raw, dest, c.htmlLang, c.pdfTitle, c.pdfSubject, c.pdfKeywords], { stdio: 'inherit' });
  }
  await browser.close();
  // legacy alias: the old URL keeps working and now serves the (Portuguese) updated CV
  fs.copyFileSync(path.join(outDir, 'Franklin_Ferreira_Staff_Data_Engineer_CV_PT.pdf'), path.join(outDir, 'Franklin_Ferreira_Cientista_de_Dados_CV.pdf'));
  console.log('CVs built:', fs.readdirSync(outDir).join(', '));
}
