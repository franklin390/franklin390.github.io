// Regenerates the repetitive regions of index.html from facts/training.json.
// Regions are delimited by  <!--@region:NAME-->  ...  <!--@end:NAME-->  and are rewritten in place (idempotent).
// Usage: node gen-regions.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, TOOLS, readJson } from './verify/lib/common.mjs';
import { syncHtml, loadDict } from './sync-html.mjs';

const check = process.argv.includes('--check');
const file = path.join(ROOT, 'index.html');
const raw = fs.readFileSync(file, 'utf8');
const CRLF = String.fromCharCode(13, 10);
const eol = raw.includes(CRLF) ? CRLF : '\n';
let html = raw.split(CRLF).join('\n'); // process in LF, write back with the file's own line endings
const T = readJson(path.join(TOOLS, 'facts/training.json'));

const title = (it) => (it.titleLiteral
  ? `<h4 translate="no">${it.titleLiteral}</h4>`
  : `<h4 data-i18n="${it.titleKey}"></h4>`);

const featured = T.featured.map((it) => {
  const dateLine = it.validUntil
    ? `<span data-i18n="train.issued"></span> <span data-date="${it.issued}"></span> <span translate="no">·</span> <span data-i18n="train.validuntil"></span> <span data-date="${it.validUntil}"></span>`
    : it.completed
      ? `<span data-i18n="train.completed"></span> <span data-date="${it.completed}"></span>`
      : `<span data-i18n="train.issued"></span> <span data-date="${it.issued}"></span>`;
  const link = it.external
    ? `<a href="${it.href}" rel="noopener" data-i18n="train.verify"></a>`
    : `<a href="${it.href}" data-i18n="train.view"></a>`;
  return `\t\t\t\t\t<article class="cert-card" id="cert-${it.id}">
\t\t\t\t\t\t<div class="cert-top"><span class="cert-ico"><i class="fa-solid ${it.icon}" aria-hidden="true"></i></span><p class="cert-issuer" translate="no">${it.issuer}</p></div>
\t\t\t\t\t\t${title(it)}
\t\t\t\t\t\t<p class="cert-date">${dateLine}</p>
\t\t\t\t\t\t<p class="cert-link">${link}</p>
\t\t\t\t\t</article>`;
}).join('\n');

const courses = T.courses.map((c) => `\t\t\t\t\t<li><span class="train-date" data-date="${c.date}"></span><span class="train-main"><a href="${c.href}" data-i18n="train.${c.id}"></a></span><span class="train-issuer" translate="no">${c.issuer}</span></li>`).join('\n');

const catKey = { ml: 'projects.cat.ml', forecast: 'projects.cat.forecast', bd: 'projects.cat.bd' };
const projects = T.projects.map((p) => `\t\t\t\t\t<!-- ${p.id} -->
\t\t\t\t\t<div class="folio-wrapper block-1-1 block-mob-full stack">
\t\t\t\t\t\t<div class="bgrid folio-item">
\t\t\t\t\t\t\t<div class="item-wrap">
\t\t\t\t\t\t\t\t<p class="h05 tag-label" data-i18n="projects.tag"></p> <br>
\t\t\t\t\t\t\t\t<img src="images/portfolio/${p.img}.webp" alt="${p.title}" translate="no" loading="lazy" decoding="async" width="800" height="801">
\t\t\t\t\t\t\t\t<a href="#modal-${p.id.slice(1)}" class="overlay">
\t\t\t\t\t\t\t\t\t<div class="folio-item-table">
\t\t\t\t\t\t\t\t\t\t<div class="folio-item-cell">
\t\t\t\t\t\t\t\t\t\t\t<h3 class="folio-title" translate="no">${p.title}</h3>
\t\t\t\t\t\t\t\t\t\t\t<span class="folio-types" data-i18n="${catKey[p.cat]}"></span>
\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t</a>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div id="modal-${p.id.slice(1)}" class="popup-modal slider mfp-hide">
\t\t\t\t\t\t\t<div class="media"><img src="images/portfolio/modals/m-${p.img.replace('blood_donations', 'blood_donations')}.webp" alt="" loading="lazy" decoding="async" width="1050" height="700"></div>
\t\t\t\t\t\t\t<div class="description-box">
\t\t\t\t\t\t\t\t<h4 translate="no">${p.title}</h4>
\t\t\t\t\t\t\t\t<p data-i18n="projects.${p.id}.desc"></p>
\t\t\t\t\t\t\t\t<div class="categories" data-i18n="${catKey[p.cat]}"></div>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<div class="link-box">
\t\t\t\t\t\t\t\t<a href="${p.href}" rel="noopener" data-i18n="projects.view"></a>
\t\t\t\t\t\t\t\t<a href="#" class="popup-modal-dismiss" data-i18n="projects.close"></a>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>`).join('\n');

// --- selected work: case-study cards (data in facts/cases.json, texts in the dictionaries)
const CASES = readJson(path.join(TOOLS, 'facts/cases.json')).cases;
const cases = CASES.map((c, i) => {
  const block = (labelKey, textKey, cls = '') => `\t\t\t\t\t\t<p class="case-block${cls}"><span class="case-label" data-i18n="${labelKey}"></span><span data-i18n="${textKey}"></span></p>`;
  const lines = [
    `\t\t\t\t\t<article class="case-card${c.wide ? ' case-wide' : ''}" id="case-${c.id}" data-cat="${c.cat}" data-num="${String(i + 1).padStart(2, '0')}">`,
    `\t\t\t\t\t\t<div class="case-head"><span class="case-ico"><i class="fa-solid ${c.icon}" aria-hidden="true"></i></span></div>`,
    `\t\t\t\t\t\t<p class="case-meta" translate="no">${c.meta}</p>`,
    `\t\t\t\t\t\t<h3 data-i18n="case.${c.key}.title"></h3>`,
  ];
  if (c.metric) lines.push(`\t\t\t\t\t\t<div class="case-metric"><span class="case-metric-num" translate="no">${c.metric.num.replace('>', '&gt;')}</span><span class="case-metric-cap" data-i18n="${c.metric.cap}"></span></div>`);
  if (c.blocks) {
    // a decision record: free labelled blocks side by side instead of the context / what / result story
    lines.push('\t\t\t\t\t\t<div class="case-cols">', ...c.blocks.map((b) => block(b.label, b.text).replace(/^\t/, '\t\t')), '\t\t\t\t\t\t</div>');
  } else {
    if (c.context) lines.push(block(c.contextLabel || 'case.label.context', `case.${c.key}.context`));
    lines.push(block('case.label.what', `case.${c.key}.what`));
    if (c.result) lines.push(block('case.label.result', `case.${c.key}.result`, ' case-result'));
  }
  if (c.stack.length) lines.push(`\t\t\t\t\t\t<ul class="case-stack" translate="no">${c.stack.map((s) => `<li>${s}</li>`).join('')}</ul>`);
  lines.push('\t\t\t\t\t</article>');
  return lines.join('\n');
}).join('\n');

const regions = { 'train-featured': featured, 'train-courses': courses, 'projects-slides': projects, cases };
const EN = loadDict('en');
let changed = false;
for (const [name, body] of Object.entries(regions)) {
  const re = new RegExp(`(<!--@region:${name}-->)[\\s\\S]*?(<!--@end:${name}-->)`);
  if (!re.test(html)) { console.error(`region ${name} not found in index.html`); process.exit(2); }
  const filled = syncHtml(body, EN).html; // regions carry the inline EN text too, so gen-regions and sync-html agree
  const next = html.replace(re, `$1\n${filled}\n\t\t\t\t\t$2`);
  if (next !== html) { changed = true; html = next; }
}
if (check) { console.log(changed ? 'gen-regions: index.html is OUT OF DATE (run node gen-regions.mjs)' : 'gen-regions: up to date'); process.exit(changed ? 1 : 0); }
fs.writeFileSync(file, html.split('\n').join(eol));
console.log(changed ? 'gen-regions: index.html updated' : 'gen-regions: no changes');
