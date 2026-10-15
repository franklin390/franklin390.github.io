// G17 — GitHub Pages readiness. The site is served from Linux with Jekyll in front: paths are case-sensitive (Windows is not),
// folders starting with "_" or "." are never published, files with front matter are processed as Liquid, and only files that
// are committed exist at all. This gate checks each of those on the files the pages really reference.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { Gate } from './lib/report.mjs';
import { ROOT } from './lib/common.mjs';

export const id = 'G17';

const PAGES = ['index.html', 'pt/index.html', 'es/index.html'];
const SITE = 'https://franklin390.github.io/';
const hidden = (f) => f.split('/').some((s) => s.startsWith('_') || s.startsWith('.'));

// every file the site can ask for: follows href, src, srcset, data-href-xx, url() and @import from the pages, the sitemap and the stylesheets
function references() {
  const out = []; // { from, ref, target }
  const seen = new Set();
  const queue = [...PAGES, 'sitemap.xml', 'robots.txt'];
  const resolve = (ref, from) => {
    let r = ref.trim();
    if (!r || /^(mailto:|tel:|data:|#|javascript:|\/\/)/i.test(r)) return null;
    if (/^https?:/i.test(r)) {
      if (!r.startsWith(SITE.slice(0, -1))) return null;
      r = '/' + r.slice(SITE.length);
      const first = r.split('/')[1];
      if (first && !fs.existsSync(path.join(ROOT, first))) return null; // another repository's project site (e.g. /Project_06_.../), checked online by G6
    }
    r = r.split('#')[0].split('?')[0];
    try { r = decodeURIComponent(r); } catch (e) { return null; }
    if (!r) return null;
    const base = r.startsWith('/') ? '' : path.posix.dirname(from);
    let p = path.posix.normalize(path.posix.join(base, r.replace(/^\//, '')));
    if (p.endsWith('/') || p === '.') p = path.posix.join(p, 'index.html');
    return p;
  };
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs) || !/\.(html|css|xml|txt)$/i.test(f)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const refs = new Set();
    for (const m of text.matchAll(/(?:href|src|data-href-[a-z]+|poster)\s*=\s*["']([^"']+)["']/gi)) refs.add(m[1]);
    for (const m of text.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)["']/gi)) refs.add(m[1]);
    for (const m of text.matchAll(/srcset\s*=\s*["']([^"']+)["']/gi)) m[1].split(',').forEach((s) => refs.add(s.trim().split(/\s+/)[0]));
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) refs.add(m[1]);
    for (const m of text.matchAll(/@import\s+["']([^"']+)["']/gi)) refs.add(m[1]);
    for (const m of text.matchAll(/<loc>([^<]+)<\/loc>/gi)) refs.add(m[1]);
    if (/robots\.txt$/.test(f)) for (const m of text.matchAll(/^Sitemap:\s*(\S+)/gim)) refs.add(m[1]);
    for (const ref of refs) {
      const target = resolve(ref, f);
      if (!target) continue;
      out.push({ from: f, ref, target });
      if (/\.(css)$/i.test(target) && !seen.has(target)) queue.push(target);
    }
  }
  return out;
}

/** the path as it really is on disk, segment by segment, or null when a segment differs only by case or is missing */
function exactCase(p) {
  let dir = ROOT;
  for (const seg of p.split('/')) {
    let names;
    try { names = fs.readdirSync(dir); } catch (e) { return { ok: false, why: 'missing folder' }; }
    if (names.includes(seg)) { dir = path.join(dir, seg); continue; }
    const alt = names.find((n) => n.toLowerCase() === seg.toLowerCase());
    return { ok: false, why: alt ? `on disk it is "${alt}"` : 'missing' };
  }
  return { ok: true };
}

export async function run() {
  const g = new Gate('G17', 'GitHub Pages readiness (case-sensitive paths, Jekyll rules, committed files, size)');
  const isRepo = fs.existsSync(path.join(ROOT, '.git'));
  const refs = references();
  const targets = [...new Set(refs.map((r) => r.target))].filter((t) => !/^\s*$/.test(t));

  // 1) every referenced file exists with exactly the same capitals
  const badCase = [];
  for (const r of refs) {
    const c = exactCase(r.target);
    if (!c.ok) badCase.push(`${r.from} → ${r.ref}: ${c.why}`);
  }
  g.check(badCase.length === 0, `all ${targets.length} files the pages, stylesheets and sitemap point to exist with the exact case of their name (GitHub Pages is case-sensitive)`, [...new Set(badCase)].slice(0, 8).join('\n'));

  // 2) none sits in a folder Jekyll never publishes
  const hiddenHits = targets.filter(hidden);
  g.check(hiddenHits.length === 0, 'nothing the site needs sits under a folder or file whose name starts with "_" or "." (Jekyll does not publish those)', hiddenHits.slice(0, 6).join('\n'));

  // 3) every needed file is committed (or would be by "git add -A")
  if (isRepo) {
    const tracked = new Set(execSync('git -c core.quotepath=false ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean));
    const untracked = new Set(execSync('git -c core.quotepath=false ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean));
    const missing = targets.filter((t) => fs.existsSync(path.join(ROOT, t)) && !tracked.has(t) && !untracked.has(t));
    g.check(missing.length === 0, 'every file the site needs is tracked by git or would be added by "git add -A" (none is hidden by .gitignore)', missing.slice(0, 6).join('\n'));
    const pending = targets.filter((t) => untracked.has(t));
    if (pending.length) g.info(`${pending.length} needed file(s) are not committed yet and will have to be (git add): ${pending.slice(0, 4).join(', ')}${pending.length > 4 ? ', …' : ''}`);
  } else {
    g.info('not a git repository here (selftest copy): the committed-files check was skipped');
  }

  // 4) Jekyll: no .nojekyll (it would publish _tools and _cv), no markdown or front matter in what is published
  g.check(!fs.existsSync(path.join(ROOT, '.nojekyll')), 'there is no .nojekyll file (with it GitHub Pages would publish _tools/ and _cv/, which today stay out because Jekyll skips "_" folders)');
  const published = [];
  const walk = (dir, rel) => {
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('_') || name.startsWith('.') || name === 'node_modules') continue;
      const abs = path.join(dir, name), r = rel ? `${rel}/${name}` : name;
      if (fs.statSync(abs).isDirectory()) walk(abs, r); else published.push(r);
    }
  };
  walk(ROOT, '');
  const cfg = fs.existsSync(path.join(ROOT, '_config.yml')) ? fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8').replace(/\r\n/g, '\n') : '';
  const exBlock = (cfg.match(/^exclude:\s*\n((?:[ \t]+-[^\n]*\n?)+)/m) || [])[1] || '';
  const excluded = [...exBlock.matchAll(/-\s*["']?([^\s"'#]+)/g)].map((m) => m[1]);
  const markdown = published.filter((f) => /\.(md|markdown)$/i.test(f) && !excluded.includes(f));
  g.check(markdown.length === 0, `every markdown file in the published folders is listed under exclude in _config.yml (${excluded.length ? excluded.join(', ') : 'nothing excluded'}); otherwise Jekyll turns it into a page of the site`, markdown.slice(0, 5).join(', '));
  const startsFrontMatter = (f) => { const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^\uFEFF/, ''); return /^---\r?\n/.test(t); };
  const frontMatter = published.filter((f) => /\.(html|css|js|xml|txt|json)$/i.test(f) && startsFrontMatter(f));
  g.check(frontMatter.length === 0, 'no published page, script or style starts with "---" (front matter makes Jekyll process the file as a Liquid template)', frontMatter.slice(0, 5).join(', '));

  // 5) names that only differ by case, or that break a URL
  const lower = new Map();
  const clash = [];
  for (const f of published) { const k = f.toLowerCase(); if (lower.has(k)) clash.push(`${lower.get(k)} / ${f}`); else lower.set(k, f); }
  g.check(clash.length === 0, 'no two published files differ only by capital letters (they cannot coexist on Windows or macOS)', clash.slice(0, 4).join('\n'));
  const odd = published.filter((f) => /[#?%\\]/.test(f));
  g.check(odd.length === 0, 'no published file name contains # ? % or a backslash', odd.slice(0, 4).join(', '));

  // 6) size
  const sizes = published.map((f) => [f, fs.statSync(path.join(ROOT, f)).size]).sort((a, b) => b[1] - a[1]);
  const total = sizes.reduce((s, [, n]) => s + n, 0);
  g.check(sizes[0][1] < 50 * 1024 * 1024, `the biggest published file is ${(sizes[0][1] / 1048576).toFixed(1)} MB (${sizes[0][0]}); GitHub refuses files above 100 MB and warns above 50 MB`);
  g.check(total < 300 * 1024 * 1024, `the published site is ${(total / 1048576).toFixed(0)} MB in ${published.length} files (a Pages site may not exceed 1 GB)`);
  if (total > 12 * 1024 * 1024) g.warn(`the published folder holds ${(total / 1048576).toFixed(1)} MB; the pages themselves load ~0.3 MB. Unused files add clones and deploy time (see node unused-files.mjs)`);

  // 7) the entry points exist
  for (const f of ['index.html', 'pt/index.html', 'es/index.html', 'robots.txt', 'sitemap.xml', 'favicon.png']) g.check(fs.existsSync(path.join(ROOT, f)), `${f} exists at the expected place`);
  return g;
}
