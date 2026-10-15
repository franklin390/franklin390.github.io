// Lists the files of the site that nothing uses any more. Read-only: it deletes nothing.
//   node unused-files.mjs
// A file counts as used when it is reachable from index.html, pt/index.html, es/index.html, sitemap.xml or robots.txt through
// href/src/srcset/data-href-*/url()/@import, or named inside a script or stylesheet that is itself reachable.
// "build input" = the file is not shipped as such but a script in _tools/ reads it (original fonts, icon sources).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ROOT, TOOLS } from './verify/lib/common.mjs';

const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean);
// everything `git add -A` would put in the repository (tracked + untracked and not ignored), minus what Jekyll never publishes
const all = [...new Set([...sh('git -c core.quotepath=false ls-files'), ...sh('git -c core.quotepath=false ls-files --others --exclude-standard')])]
  .filter((f) => fs.existsSync(path.join(ROOT, f)) && !f.split('/').some((s) => s.startsWith('_') || s.startsWith('.')));

const ROOTS = ['index.html', 'pt/index.html', 'es/index.html', 'sitemap.xml', 'robots.txt', '_config.yml'];
const used = new Set();
const queue = [...ROOTS];
const exts = '(?:png|jpe?g|webp|svg|gif|ico|woff2?|ttf|eot|otf|pdf|css|js|json|xml|txt|html)';
const norm = (p) => p.split(path.sep).join('/');

function resolve(ref, fromFile) {
  let r = ref.trim();
  if (!r || /^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(r)) {
    const m = r.match(/^https?:\/\/franklin390\.github\.io\/(.*)$/i);
    if (!m) return null;
    r = '/' + m[1];
  }
  r = r.split('#')[0].split('?')[0];
  try { r = decodeURIComponent(r); } catch (e) { /* keep as is */ }
  if (!r) return null;
  const base = r.startsWith('/') ? '' : path.posix.dirname(fromFile);
  let p = path.posix.normalize(path.posix.join(base, r.replace(/^\//, '')));
  if (p.endsWith('/') || p === '.') p = path.posix.join(p, 'index.html');
  if (fs.existsSync(path.join(ROOT, p)) && fs.statSync(path.join(ROOT, p)).isDirectory()) p = path.posix.join(p, 'index.html');
  return p;
}

while (queue.length) {
  const f = queue.shift();
  if (used.has(f) || !fs.existsSync(path.join(ROOT, f))) continue;
  used.add(f);
  if (!/\.(html|css|js|xml|txt|json)$/i.test(f)) continue;
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const refs = new Set();
  for (const m of text.matchAll(/(?:href|src|data-href-[a-z]+|poster|content)\s*=\s*["']([^"']+)["']/gi)) refs.add(m[1]);
  for (const m of text.matchAll(/srcset\s*=\s*["']([^"']+)["']/gi)) m[1].split(',').forEach((s) => refs.add(s.trim().split(/\s+/)[0]));
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) refs.add(m[1]);
  for (const m of text.matchAll(/@import\s+["']([^"']+)["']/gi)) refs.add(m[1]);
  for (const m of text.matchAll(/<loc>([^<]+)<\/loc>/gi)) refs.add(m[1]);
  if (/\.(js|json|xml|txt)$/i.test(f)) for (const m of text.matchAll(new RegExp('["\'`]([\\w./%-]+\\.' + exts + ')["\'`]', 'gi'))) refs.add(m[1]);
  for (const r of refs) {
    const p = resolve(r, f);
    if (p && all.includes(p) && !used.has(p)) queue.push(p);
    // a stylesheet or script names files relative to the page, not to itself
    if (p === null) continue;
    const alt = resolve(r.replace(/^\.\.\//, ''), 'index.html');
    if (alt && all.includes(alt) && !used.has(alt) && /\.(js)$/i.test(f)) queue.push(alt);
  }
}

// build inputs: files that a script in _tools/ opens
const toolSrc = fs.readdirSync(TOOLS).filter((x) => /\.mjs$/.test(x)).map((x) => fs.readFileSync(path.join(TOOLS, x), 'utf8')).join('\n')
  + fs.readdirSync(path.join(TOOLS, 'verify')).filter((x) => /\.mjs$/.test(x)).map((x) => fs.readFileSync(path.join(TOOLS, 'verify', x), 'utf8')).join('\n');
const isBuildInput = (f) => toolSrc.includes(f) || toolSrc.includes(path.posix.basename(f)) && /fonts\/|webfonts\/|\.ttf$|\.otf$/.test(f);

const unused = all.filter((f) => !used.has(f) && !/(^|\/)(README|LICENSE)(\.md)?$/i.test(f)); // documentation is not clutter
const sizeOf = (f) => fs.statSync(path.join(ROOT, f)).size;
const groups = {};
for (const f of unused) {
  const top = f.split('/').slice(0, f.split('/').length > 2 ? 2 : 1).join('/');
  (groups[top] ||= []).push(f);
}
const kb = (n) => (n / 1024).toFixed(0).padStart(6) + ' KB';
let total = 0;
console.log(`${all.length} publishable files, ${used.size} reachable from the pages, ${unused.length} not used\n`);
for (const [g, files] of Object.entries(groups).sort((a, b) => b[1].reduce((s, f) => s + sizeOf(f), 0) - a[1].reduce((s, f) => s + sizeOf(f), 0))) {
  const sz = files.reduce((s, f) => s + sizeOf(f), 0);
  total += sz;
  const inputs = files.filter(isBuildInput).length;
  console.log(`${kb(sz)}  ${g}  (${files.length} file${files.length > 1 ? 's' : ''}${inputs ? `, ${inputs} read by a build script` : ''})`);
  if (process.argv.includes('--files')) for (const f of files) console.log(`            ${isBuildInput(f) ? '[build input] ' : ''}${f}  ${kb(sizeOf(f)).trim()}`);
}
console.log(`\n${kb(total)} in total could go (before looking at the build inputs)`);
