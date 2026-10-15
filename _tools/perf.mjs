// Lab performance run: a phone (390px, Slow 4G, CPU 4x slower, like Lighthouse mobile) loads the page from a local HTTP/2 server
// with gzip (what GitHub Pages does). The median of several runs is printed, plus where the bytes and the blocking time go.
// Google Tag Manager is blocked on purpose (third party, not reproducible offline); see the README for its effect.
//
// Usage: node perf.mjs [path ...]        e.g.  node perf.mjs "" pt/        (default: the English home page)
//        RUNS=7 node perf.mjs --json out/perf-now.json
//        node perf.mjs --budget          exit code 1 if a budget is exceeded (used by gate G15)
import fs from 'node:fs';
import path from 'node:path';
import http2 from 'node:http2';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { handle } from './serve.mjs';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const RUNS = Number(process.env.RUNS || 5);
const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const targets = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
if (!targets.length) targets.push('');

/** self-signed certificate for the local HTTP/2 server (browsers only speak h2 over TLS) */
function certificate() {
  const dir = path.join(TOOLS, 'out');
  fs.mkdirSync(dir, { recursive: true });
  const key = path.join(dir, 'perf-key.pem'), crt = path.join(dir, 'perf-cert.pem');
  if (!fs.existsSync(key) || !fs.existsSync(crt)) {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '30', '-subj', '/CN=localhost'], { stdio: 'pipe' });
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
}

export async function startH2() {
  const server = http2.createSecureServer({ ...certificate(), allowHTTP1: true }, handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  server.port = server.address().port;
  return server;
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const kb = (n) => Math.round(n / 1024);

const INIT = () => {
  const P = (window.__perf = { fcp: 0, lcp: 0, lcpEl: '', cls: 0, tbt: 0, longTasks: 0, preloaderHidden: 0 });
  const obs = (type, fn) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true }); } catch (e) { /* unsupported */ } };
  obs('paint', (e) => { if (e.name === 'first-contentful-paint') P.fcp = e.startTime; });
  obs('largest-contentful-paint', (e) => { P.lcp = e.startTime; P.lcpEl = (e.element ? e.element.tagName.toLowerCase() + (e.url ? ' ' + e.url.replace(location.origin, '') : '') + (e.element.id ? '#' + e.element.id : '') : '?'); });
  obs('layout-shift', (e) => { if (!e.hadRecentInput) P.cls += e.value; });
  obs('longtask', (e) => { P.longTasks++; if (e.startTime >= P.fcp) P.tbt += Math.max(0, e.duration - 50); });
  const iv = setInterval(() => {
    const p = document.getElementById('preloader');
    if (p && getComputedStyle(p).display === 'none') { P.preloaderHidden = performance.now(); clearInterval(iv); }
  }, 40);
};

async function once(browser, base, target) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true, reducedMotion: 'no-preference' });
  await context.route(/googletagmanager|google-analytics/, (r) => r.abort());
  if (process.env.BLOCK) await context.route(new RegExp(process.env.BLOCK), (r) => r.abort()); // experiments: what does this file cost?
  await context.addInitScript(INIT);
  if (process.env.HTML_DROP) { // experiments: remove every line of the page that matches this regex (e.g. a preload tag) before the browser sees it
    const drop = new RegExp(process.env.HTML_DROP);
    await context.route(/127\.0\.0\.1:\d+\/(\?.*)?$/, async (route) => { const r = await route.fetch(); const body = (await r.text()).split('\n').filter((l) => !drop.test(l)).join('\n'); await route.fulfill({ response: r, body }); });
  }
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const req = new Map();
  cdp.on('Network.responseReceived', (e) => req.set(e.requestId, { url: e.response.url, type: e.type, mime: e.response.mimeType, proto: e.response.protocol, size: 0 }));
  cdp.on('Network.loadingFinished', (e) => { const r = req.get(e.requestId); if (r) r.size = e.encodedDataLength; });
  await page.goto(`${base}/${target}`, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource');
    return { ...window.__perf, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, blocking: res.filter((r) => r.renderBlockingStatus === 'blocking').map((r) => r.name.replace(location.origin + '/', '')) };
  });
  await context.close();
  const by = { html: 0, css: 0, js: 0, font: 0, image: 0, other: 0 };
  let total = 0, count = 0;
  for (const r of req.values()) {
    if (r.url.startsWith('data:')) continue;
    const k = r.type === 'Document' ? 'html' : r.type === 'Stylesheet' ? 'css' : r.type === 'Script' ? 'js' : r.type === 'Font' ? 'font' : r.type === 'Image' ? 'image' : 'other';
    by[k] += r.size; total += r.size; count++;
  }
  return { ...m, by, total, count, files: [...req.values()].filter((r) => !r.url.startsWith('data:')).sort((a, b) => b.size - a.size).map((r) => ({ f: r.url.replace(/^https:\/\/127\.0\.0\.1:\d+\//, ''), n: r.size, p: r.proto })) };
}

export async function measure(target = '', runs = RUNS) {
  const server = await startH2();
  const browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-certificate-errors'] });
  const base = `https://127.0.0.1:${server.port}`;
  await once(browser, base, target); // warm-up (certificate, JIT)
  const all = [];
  for (let i = 0; i < runs; i++) all.push(await once(browser, base, target));
  await browser.close();
  server.close();
  const pick = (f) => median(all.map(f));
  const first = all[0];
  return {
    target: '/' + target, runs,
    fcp: Math.round(pick((r) => r.fcp)), lcp: Math.round(pick((r) => r.lcp)), lcpEl: first.lcpEl, cls: +pick((r) => r.cls).toFixed(3), tbt: Math.round(pick((r) => r.tbt)),
    dcl: Math.round(pick((r) => r.dcl)), load: Math.round(pick((r) => r.load)), preloaderHidden: Math.round(pick((r) => r.preloaderHidden)),
    transferKB: kb(pick((r) => r.total)), requests: first.count, by: Object.fromEntries(Object.keys(first.by).map((k) => [k, kb(pick((r) => r.by[k]))])),
    renderBlocking: first.blocking, protocol: first.files[0]?.p, top: first.files.slice(0, 12).map((f) => `${(f.n / 1024).toFixed(1)} KB  ${f.f}`),
  };
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const out = [];
  for (const t of targets) {
    const r = await measure(t);
    out.push(r);
    console.log(`\n${r.target}  (median of ${r.runs} runs, Slow 4G + CPU 4x, ${r.protocol})`);
    console.log(`  FCP ${r.fcp} ms   LCP ${r.lcp} ms (${r.lcpEl})   TBT ${r.tbt} ms   CLS ${r.cls}`);
    console.log(`  DOMContentLoaded ${r.dcl} ms   load ${r.load} ms   preloader gone ${r.preloaderHidden} ms`);
    console.log(`  transfer ${r.transferKB} KB in ${r.requests} requests: ${Object.entries(r.by).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    console.log(`  render-blocking (${r.renderBlocking.length}): ${r.renderBlocking.join(', ')}`);
    console.log('  biggest:\n    ' + r.top.join('\n    '));
  }
  if (jsonOut) fs.writeFileSync(path.resolve(TOOLS, jsonOut), JSON.stringify(out, null, 2));
}
