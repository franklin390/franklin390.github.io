// Dumps the rendered text of the site (EN, PT) and of the CV PDFs into _tools/out/audit/ for independent review.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, pdfText } from './lib/common.mjs';
import { getEnv } from './lib/browser.mjs';
import { CV_FILES } from './g3-facts.mjs';

const ctx = { cleanup: [] };
const env = await getEnv(ctx);
const dir = path.join(OUT, 'audit');
fs.mkdirSync(dir, { recursive: true });

for (const lang of ['en', 'pt', 'es']) {
  const s = await env.open(lang);
  const text = await s.page.evaluate(() => {
    const out = [];
    const walk = (el, depth) => {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) return;
      if (/^(H1|H2|H3|H4|H5)$/.test(el.tagName)) out.push('\n' + '#'.repeat(Math.min(depth, 5)) + ' ' + el.textContent.replace(/\s+/g, ' ').trim());
      else if (['P', 'LI', 'SPAN', 'A', 'STRONG', 'BLOCKQUOTE'].includes(el.tagName) && !el.querySelector('p,li,h1,h2,h3,h4,h5,blockquote')) {
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        if (t) out.push((el.tagName === 'LI' ? '- ' : '') + t);
      } else for (const c of el.children) walk(c, depth + 1);
    };
    walk(document.body, 0);
    const imgs = [...document.querySelectorAll('img[alt]')].filter((i) => i.alt).map((i) => `[image alt] ${i.alt}`);
    return out.join('\n') + '\n\n' + imgs.join('\n') + `\n\n[meta title] ${document.title}\n[meta description] ${document.querySelector('meta[name=description]').content}`;
  });
  fs.writeFileSync(path.join(dir, `site-${lang}.txt`), text);
  await s.close();
  fs.writeFileSync(path.join(dir, `cv-${lang}.txt`), pdfText(path.join(ROOT, CV_FILES[lang]), 'layout'));
}
for (const f of ctx.cleanup) await f();
console.log('audit dumps:', fs.readdirSync(dir).join(', '));
