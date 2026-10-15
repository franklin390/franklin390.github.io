// Keeps the inline (no-JS / SEO) English copy in index.html identical to js/i18n/en.js.
// English text lives ONLY in en.js; this script writes it into every data-i18n* element.
// Usage: node sync-html.mjs [--check]        (--check: exit 1 if index.html would change)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './verify/lib/common.mjs';

export function loadDict(lang) {
  const code = fs.readFileSync(path.join(ROOT, `js/i18n/${lang}.js`), 'utf8');
  const sandbox = { window: { I18N: {} } };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.I18N[lang];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (iso) => {
  if (iso === 'present') return 'Present';
  const p = iso.split('-');
  return p.length === 1 ? p[0] : `${MONTHS[+p[1] - 1]} ${p[0]}`;
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const unesc = (s) => s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const attrOf = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return m ? m[1] : null; };
const setAttr = (tag, name, value) => {
  const v = escAttr(value);
  const re = new RegExp(`(\\s${name}=")[^"]*(")`);
  if (re.test(tag)) return tag.replace(re, `$1${v}$2`);
  return tag.replace(/\s*(\/?)>$/, ` ${name}="${v}"$1>`);
};

export function syncHtml(html, en) {
  const problems = [];
  const need = (key, where) => { if (typeof en[key] !== 'string') { problems.push(`missing EN key "${key}" (${where})`); return '[[' + key + ']]'; } return en[key]; };

  // 1) leaf elements: data-i18n / data-i18n-html / data-date / data-count
  //    Only opening tags carrying those attributes are matched; the element body runs to the next </tag>.
  const openRe = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?\sdata-(?:i18n|i18n-html|date|count)="[^"]*"[^>]*>/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = openRe.exec(html))) {
    const open = m[0];
    const tagName = m[1];
    const start = m.index + open.length;
    const closeIdx = html.indexOf(`</${tagName}>`, start);
    if (closeIdx < 0) { problems.push(`no closing </${tagName}> for ${open.slice(0, 80)}`); continue; }
    const inner = html.slice(start, closeIdx);
    let text = null;
    const k = attrOf(open, 'data-i18n');
    const kh = attrOf(open, 'data-i18n-html');
    if (k !== null) text = esc(need(k, 'data-i18n'));
    else if (kh !== null) text = need(kh, 'data-i18n-html');
    else if (attrOf(open, 'data-date') !== null) {
      const s = attrOf(open, 'data-date');
      const e = attrOf(open, 'data-date-end');
      text = e ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
    } else if (attrOf(open, 'data-count') !== null) {
      text = esc(unesc(attrOf(open, 'data-prefix') || '') + attrOf(open, 'data-count') + unesc(attrOf(open, 'data-suffix') || ''));
    }
    if (text === null) continue;
    if (/<[a-zA-Z]/.test(inner) && kh === null) problems.push(`<${tagName}> with ${open.match(/data-[a-z0-9-]+/)[0]} contains nested markup: ${inner.slice(0, 60)}`);
    out += html.slice(last, start) + text;
    last = closeIdx;
    openRe.lastIndex = closeIdx;
  }
  html = out + html.slice(last);

  // 2) attribute templates + per-language hrefs on opening tags
  html = html.replace(/<[a-zA-Z][a-zA-Z0-9]*\b[^>]*\sdata-(?:i18n-attr|href-en)="[^"]*"[^>]*>/g, (tag) => {
    const spec = attrOf(tag, 'data-i18n-attr');
    if (spec) for (const pair of spec.split(';')) {
      const i = pair.indexOf(':'); if (i < 1) continue;
      tag = setAttr(tag, pair.slice(0, i).trim(), need(pair.slice(i + 1).trim(), 'data-i18n-attr'));
    }
    const hrefEn = attrOf(tag, 'data-href-en');
    if (hrefEn) tag = setAttr(tag, 'href', hrefEn);
    return tag;
  });
  return { html, problems };
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const file = path.join(ROOT, 'index.html');
  const raw = fs.readFileSync(file, 'utf8');
  const CRLF = String.fromCharCode(13, 10);
  const eol = raw.includes(CRLF) ? CRLF : '\n';
  const before = raw.split(CRLF).join('\n'); // process in LF, write back with the file's own line endings
  const { html, problems } = syncHtml(before, loadDict('en'));
  problems.forEach((p) => console.error('PROBLEM:', p));
  if (process.argv.includes('--check')) {
    console.log(html === before ? 'sync-html: inline EN is in sync with en.js' : 'sync-html: index.html inline EN DIFFERS from en.js (run node sync-html.mjs)');
    process.exit(html === before && !problems.length ? 0 : 1);
  }
  fs.writeFileSync(file, html.split('\n').join(eol));
  console.log(html === before ? 'sync-html: no changes' : 'sync-html: index.html updated', problems.length ? `(${problems.length} problems)` : '');
  process.exit(problems.length ? 1 : 0);
}
