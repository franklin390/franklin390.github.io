// G11 — Voice: the copy should read like a person wrote it. Fails on stock phrases / buzzwords (EN + PT), the same opener on
// every bullet, stacked participial tails, runaway sentences, and the same sentence pasted into several sections.
// Heuristics for THIS site (see facts/voice.json for the sources), not an AI detector.
import path from 'node:path';
import { Gate } from './lib/report.mjs';
import { TOOLS, readJson, LANGS } from './lib/common.mjs';
import { siteUnits, cvUnits, words, sentences } from './lib/copy.mjs';

export const id = 'G11';

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const stdev = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

export async function run() {
  const g = new Gate('G11', 'Voice: human tone, no stock phrases, no copy-paste repetition');
  const cfg = readJson(path.join(TOOLS, 'facts/voice.json'));
  const L = cfg.limits;
  const all = [...siteUnits(), ...cvUnits()];
  const prose = all.filter((u) => !u.legacy && !u.title && u.key !== 'meta.title');
  const label = (u) => u.key;

  for (const art of ['site', 'cv']) for (const lang of LANGS) {
    const tag = `[${art} ${lang.toUpperCase()}]`;
    const us = prose.filter((u) => u.artifact === art && u.lang === lang);
    if (!us.length) { g.fail(`${tag} no copy found`, 'the voice gate found nothing to check (broken loader?)'); continue; }

    // 1) stock phrases and buzzwords
    const res = cfg.banned[lang].map((r) => new RegExp(r, 'i'));
    const hits = [];
    for (const u of us) for (const re of res) { const m = u.text.match(re); if (m) hits.push(`${label(u)}: "${m[0]}"`); }
    g.check(hits.length === 0, `${tag} no stock phrases or buzzwords (${res.length} patterns over ${us.length} texts)`, hits.join('\n'));

    // 2) dashes (weak signal: only a pile-up fails)
    const dashes = us.reduce((n, u) => n + (u.text.match(/—|\s–\s/g) || []).length, 0);
    g.check(dashes <= L.maxDashesPerArtifact, `${tag} dashes used as punctuation: ${dashes} (limit ${L.maxDashesPerArtifact})`, us.filter((u) => /—|\s–\s/.test(u.text)).map(label).join(', '));

    // 3) participial tails ", ensuring ..." / ", garantindo ..."
    const tailRe = new RegExp(cfg.tails[lang], 'gi');
    const tails = us.flatMap((u) => (u.text.match(tailRe) || []).map((t) => `${label(u)}: "${t}"`));
    g.check(tails.length <= L.maxTailsPerArtifact, `${tag} stacked participial tails: ${tails.length} (limit ${L.maxTailsPerArtifact})`, tails.join('\n'));

    // 4) runaway sentences
    const long = [];
    for (const u of us) for (const s of sentences(u.text)) { const n = words(s).length; if (n > L.maxSentenceWords) long.push(`${label(u)}: ${n} words`); }
    g.check(long.length === 0, `${tag} no sentence longer than ${L.maxSentenceWords} words`, long.join('\n'));

    // 5) the same opening word on too many bullets of one list
    const groups = new Map();
    for (const u of us) {
      if (!(u.bullet || /\.(a|t|b)\d+$/.test(u.key))) continue;
      const k = u.key.replace(/(\[\d+\]|\d+)$/, '');
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(words(u.text)[0]);
    }
    const sameOpen = [];
    for (const [k, list] of groups) {
      const c = {};
      for (const w of list) c[w] = (c[w] || 0) + 1;
      for (const [w, n] of Object.entries(c)) if (n > L.maxSameOpener) sameOpen.push(`${k}: "${w}" opens ${n} of ${list.length} bullets`);
    }
    g.check(sameOpen.length === 0, `${tag} no bullet list where more than ${L.maxSameOpener} items open with the same word`, sameOpen.join('\n'));

    // 6) sentence-length rhythm in real paragraphs (warn only)
    for (const u of us) {
      const ss = sentences(u.text);
      if (ss.length < 4) continue;
      const lens = ss.map((s) => words(s).length);
      const cv = stdev(lens) / mean(lens);
      if (cv < L.minUniformityCv) g.warn(`${tag} ${label(u)}: sentences are almost the same length (variation ${cv.toFixed(2)}), read it aloud`, lens.join(' / '));
    }
  }

  // 7) exclamation marks (site)
  for (const lang of LANGS) {
    const n = prose.filter((u) => u.artifact === 'site' && u.lang === lang).reduce((s, u) => s + (u.text.match(/!/g) || []).length, 0);
    g.check(n <= L.maxExclamationsSite, `[site ${lang.toUpperCase()}] exclamation marks: ${n} (limit ${L.maxExclamationsSite})`);
  }

  // 8) the same sentence pasted into several sections
  for (const art of ['site', 'cv']) for (const lang of LANGS) {
    const us = prose.filter((u) => u.artifact === art && u.lang === lang && !u.meta);
    const grams = new Map();
    for (const u of us) {
      const w = words(u.text);
      const seen = new Set();
      for (let i = 0; i + L.ngram <= w.length; i++) {
        const gram = w.slice(i, i + L.ngram).join(' ');
        if (seen.has(gram)) continue;
        seen.add(gram);
        if (!grams.has(gram)) grams.set(gram, new Set());
        grams.get(gram).add(u.key);
      }
    }
    const heavy = [...grams].filter(([, keys]) => keys.size > L.maxRepeatedNgramKeys);
    const pair = new Map();
    for (const [, keys] of grams) { const k = [...keys]; for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const p = k[i] + '  ~  ' + k[j]; pair.set(p, (pair.get(p) || 0) + 1); } }
    g.check(heavy.length === 0, `[${art} ${lang.toUpperCase()}] no ${L.ngram}-word phrase repeated in more than ${L.maxRepeatedNgramKeys} places`, heavy.slice(0, 8).map(([gram, keys]) => `"${gram}" in ${[...keys].join(', ')}`).join('\n'));
    const top = [...pair].sort((a, b) => b[1] - a[1]).slice(0, 5).filter(([, n]) => n >= 4);
    if (top.length) g.info(`[${art} ${lang.toUpperCase()}] most similar text pairs (shared ${L.ngram}-grams)`, top.map(([p, n]) => `${n}  ${p}`).join('\n'));
  }

  // 9) about paragraphs speak in first person (EN)
  for (const u of prose.filter((x) => x.artifact === 'site' && x.lang === 'en' && /^about\.p\d$/.test(x.key))) {
    g.check(/\bI\b|\bI'm\b|\bmy\b/.test(u.text), `[site EN] ${u.key} is written in the first person`);
  }

  // 10) information: average sentence length by area
  for (const lang of LANGS) {
    const areas = { about: /^about\.p\d/, experience: /^exp\./, cases: /^case\./, services: /^service\./ };
    const rows = [];
    for (const [name, re] of Object.entries(areas)) {
      const lens = prose.filter((u) => u.artifact === 'site' && u.lang === lang && re.test(u.key)).flatMap((u) => sentences(u.text).map((s) => words(s).length));
      if (lens.length) rows.push(`${name}: ${mean(lens).toFixed(1)} words/sentence (n=${lens.length}, max ${Math.max(...lens)})`);
    }
    g.info(`[site ${lang.toUpperCase()}] sentence length by area`, rows.join('\n'));
  }
  return g;
}
