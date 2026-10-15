// One-off + re-runnable: parse the ORIGINAL (pre-refresh) index.html from git and dump every
// credential/project item to facts/legacy.json. Baseline for "nothing silently dropped" (G10).
import fs from 'node:fs';
import path from 'node:path';
import { gitShow, TOOLS, LEGACY_COMMIT } from '../verify/lib/common.mjs';

const html = gitShow('index.html');
const MONTHS = { janeiro: 1, fevereiro: 2, 'março': 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const clean = (s) => s.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const iso = (txt) => {
  const parts = txt.split(' - ').map((p) => {
    const m = p.trim().match(/^([A-Za-zçÇãÃ]+),\s*(\d{4})$/);
    if (!m) return /atual/i.test(p) ? 'present' : p.trim();
    return `${m[2]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}`;
  });
  return { start: parts[0], end: parts[1] ?? null };
};

const sectionIds = ['owl-slider-work', 'owl-slider-cert', 'owl-slider-academy', 'owl-slider-degree', 'owl-slider-extra'];
const out = { _source: `git ${LEGACY_COMMIT}:index.html`, sections: {} };
for (const id of sectionIds) {
  const start = html.indexOf(`id="${id}"`);
  const end = html.indexOf('/timeline-wrap', start);
  const chunk = html.slice(start, end);
  const blocks = chunk.split('<div class="timeline-block">').slice(1);
  out.sections[id] = blocks.map((b) => {
    const h3 = b.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? '';
    const href = h3.match(/href="([^"]+)"/)?.[1] ?? null;
    const dateText = clean(b.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
    const title = clean(b.match(/<h4>([\s\S]*?)<\/h4>/)?.[1] ?? '');
    const desc = clean(b.match(/<div class="timeline-content">[\s\S]*?<\/h4>\s*<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
    return { title, dateText, ...iso(dateText), linkLabel: clean(h3), href, desc };
  });
}
out.sections.projects = [...html.matchAll(/<div id="modal-(\d+)" class="popup-modal[\s\S]*?<h4>([\s\S]*?)<\/h4>\s*<p>([\s\S]*?)<\/p>[\s\S]*?class="categories">([\s\S]*?)<\/div>[\s\S]*?<a href="([^"]+)">Ver Projeto/g)]
  .map((m) => ({ modal: m[1], title: clean(m[2]), desc: clean(m[3]), category: clean(m[4]), href: m[5] }));
out.skills = [...html.matchAll(/<div class="progress percent(\d+)"><span>([^<]+)<\/span><\/div>\s*<strong>([^<]+)<\/strong>/g)].map((m) => ({ name: m[3].trim(), pct: Number(m[1]), label: m[2] }));

fs.writeFileSync(path.join(TOOLS, 'facts/legacy.json'), JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out.sections)) console.log(k.padEnd(22), v.length);
console.log('skills'.padEnd(22), out.skills.length);
