// Builds the small woff2 fonts the page actually loads (the originals stay in the repository, unused):
//   fonts/subset/*.woff2                            Poppins + Lora cut to the characters of the site (Latin, accents, punctuation + every character used in the text)
//   css/font-awesome-6/webfonts/fa-*-subset.woff2   only the icons the page uses (see css/font-awesome-6/css/subset.css)
//   css/micons/fonts/icomoon-subset.woff2           only the service icons the page uses
//   fonts/subset/manifest.json                      what each file was built from; gate G15 checks it is current and covers every character of the site
//
// Usage: node build-fonts.mjs            build
//        node build-fonts.mjs --check    exit code 1 if the manifest (inputs) is out of date
// Run again after adding text with a new character or a new icon (npm run build:site does it).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.resolve(TOOLS, '..');
const rel = (p) => path.join(ROOT, p);
const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
export const MANIFEST = 'fonts/subset/manifest.json';

// characters kept in every text font regardless of the current text: Basic Latin, Latin-1 (enough for English, Portuguese and Spanish), punctuation, a few symbols
const RANGES = [[0x20, 0x7e], [0xa0, 0xff], [0x2010, 0x2027], [0x2030, 0x203a], [0x2190, 0x2193]];
const EXTRA = [0x20ac, 0x2122, 0x2212, 0x2248, 0x2264, 0x2265, 0x2026, 0x00d7, 0x00f7];

// only the faces the stylesheets really use (a family such as "lora-bold-italic" lives in fonts/lora/lora-bolditalic-webfont.ttf)
function usedFaces() {
  const names = new Set();
  for (const css of ['css/main.css', 'css/base.css', 'css/staff.css', 'css/vendor.css']) for (const m of fs.readFileSync(rel(css), 'utf8').matchAll(/["']((?:lora|poppins)-[a-z-]+)["']/g)) names.add(m[1]);
  return [...names].sort().map((n) => { const [fam, ...w] = n.split('-'); const file = fam + '-' + w.join(''); return { src: `fonts/${fam}/${file}-webfont.ttf`, out: `fonts/subset/${file}.woff2` }; });
}

/** every character the visitor can see: the three dictionaries and the page markup */
export function siteChars() {
  const set = new Set();
  const add = (s) => { for (const ch of s) set.add(ch.codePointAt(0)); };
  for (const l of ['en', 'pt', 'es']) {
    const sandbox = { window: { I18N: {} } };
    vm.runInNewContext(fs.readFileSync(rel(`js/i18n/${l}.js`), 'utf8'), sandbox);
    for (const v of Object.values(sandbox.window.I18N[l])) add(String(v).replace(/<[^>]*>/g, ''));
  }
  add(fs.readFileSync(rel('index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, ''));
  for (const c of [0x0a, 0x0d, 0x09]) set.delete(c);
  return set;
}

export function textCodepoints() {
  const set = siteChars();
  for (const [a, b] of RANGES) for (let c = a; c <= b; c++) set.add(c);
  for (const c of EXTRA) set.add(c);
  return [...set].sort((a, b) => a - b);
}

/** private-use codepoints of the icons a stylesheet defines for the classes in use */
function iconCodepoints(cssFile, onlyClasses) {
  const css = fs.readFileSync(rel(cssFile), 'utf8');
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{\s*content:\s*"\\([0-9a-fA-F]+)"\s*;?\s*\}/g)) {
    const classes = [...m[1].matchAll(/\.([A-Za-z0-9_-]+)/g)].map((x) => x[1]);
    if (!onlyClasses || classes.some((c) => onlyClasses.has(c))) out.push(parseInt(m[2], 16));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function usedIconClasses() {
  const used = new Set();
  for (const f of ['index.html', 'js/main.js', 'js/analytics.js']) for (const m of fs.readFileSync(rel(f), 'utf8').matchAll(/\bicon-[a-z0-9-]+/g)) used.add(m[0]);
  return used;
}

/** Font Awesome codepoints the site's OWN stylesheets write as content (the hero button arrow, the calendar of the certificate dates...) */
export function siteCssIconCodepoints() {
  const out = new Set();
  for (const f of ['css/main.css', 'css/staff.css', 'css/base.css', 'css/vendor.css']) {
    for (const m of fs.readFileSync(rel(f), 'utf8').matchAll(/content:\s*["']\\([0-9a-fA-F]{4})["']/g)) {
      const cp = parseInt(m[1], 16);
      if (cp >= 0xf000 && cp <= 0xf8ff) out.add(cp); // Font Awesome's private-use range (icomoon uses E900+, not touched here)
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function plan() {
  const faCss = 'css/font-awesome-6/css/subset.css';
  const microns = iconCodepoints('css/micons/micons.css', usedIconClasses());
  const fa = [...new Set([...iconCodepoints(faCss, null), ...siteCssIconCodepoints()])].sort((a, b) => a - b);
  const text = textCodepoints();
  const jobs = [
    ...usedFaces().map((f) => ({ ...f, cps: text })),
    { src: 'css/font-awesome-6/webfonts/fa-solid-900.ttf', out: 'css/font-awesome-6/webfonts/fa-solid-subset.woff2', cps: fa },
    { src: 'css/font-awesome-6/webfonts/fa-regular-400.ttf', out: 'css/font-awesome-6/webfonts/fa-regular-subset.woff2', cps: fa },
    { src: 'css/font-awesome-6/webfonts/fa-brands-400.ttf', out: 'css/font-awesome-6/webfonts/fa-brands-subset.woff2', cps: fa },
    { src: 'css/micons/fonts/icomoon.ttf', out: 'css/micons/fonts/icomoon-subset.woff2', cps: microns },
  ];
  const manifest = {
    note: 'Generated by _tools/build-fonts.mjs. "inputs" must match the current sources (gate G15).',
    textChars: text,
    iconCodepoints: fa, // every Font Awesome icon the page can show, class-based or written in the site's CSS
    jobs: jobs.map((j) => ({ src: j.src, srcSha: sha(fs.readFileSync(rel(j.src))), out: j.out, count: j.cps.length, cpsSha: sha(Buffer.from(j.cps.join(','))) })),
  };
  return { jobs, manifest };
}

const current = () => (fs.existsSync(rel(MANIFEST)) ? JSON.parse(fs.readFileSync(rel(MANIFEST), 'utf8')) : null);
export const manifestIsCurrent = () => { const have = current(); return !!have && JSON.stringify(have) === JSON.stringify(plan().manifest) && plan().jobs.every((j) => fs.existsSync(rel(j.out))); };

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const { jobs, manifest } = plan();
  if (process.argv.includes('--check')) {
    const ok = manifestIsCurrent();
    console.log(ok ? 'subset fonts are current' : 'subset fonts are out of date: run node build-fonts.mjs');
    process.exit(ok ? 0 : 1);
  }
  let before = 0, after = 0;
  for (const j of jobs) {
    const src = fs.readFileSync(rel(j.src));
    const out = await subsetFont(src, String.fromCodePoint(...j.cps), { targetFormat: 'woff2' });
    fs.mkdirSync(path.dirname(rel(j.out)), { recursive: true });
    fs.writeFileSync(rel(j.out), out);
    before += src.length; after += out.length;
    console.log(`${j.out.padEnd(62)} ${(out.length / 1024).toFixed(1).padStart(6)} KB  (from ${(src.length / 1024).toFixed(0)} KB ttf)`);
  }
  fs.writeFileSync(rel(MANIFEST), JSON.stringify(manifest, null, 1) + '\n');
  console.log(`fonts: ${(before / 1024).toFixed(0)} KB of ttf -> ${(after / 1024).toFixed(0)} KB of woff2 subsets; manifest written`);
}
