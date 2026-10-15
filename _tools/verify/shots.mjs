// Screenshot helper: node verify/shots.mjs [widths=1280,375] [langs=en,pt] [outSubdir=screens]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from '../serve.mjs';
import { OUT } from './lib/common.mjs';

const widths = (process.argv[2] || '1280,375').split(',').map(Number);
const langs = (process.argv[3] || 'en,pt').split(',');
const sub = process.argv[4] || 'screens';
const dir = path.join(OUT, sub);
fs.mkdirSync(dir, { recursive: true });

const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome' });
for (const w of widths) for (const lang of langs) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 800 : 900 }, reducedMotion: 'reduce' });
  await ctx.route(/googletagmanager|google-analytics|kit\.fontawesome/, (r) => r.abort());
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/ERR_FAILED/.test(m.text())) logs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) logs.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${server.port}/?lang=${lang}`, { waitUntil: 'load' });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#preloader')).display === 'none', null, { timeout: 15000 }).catch(() => logs.push('PRELOADER NEVER HIDDEN'));
  await page.waitForTimeout(600);
  // force lazy images + reveal counters
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
  const file = path.join(dir, `full-${lang}-${w}.png`);
  if (!process.env.NO_FULL) await page.screenshot({ path: file, fullPage: true });
  for (const id of ['intro', 'about', 'impact', 'resume', 'portfolio', 'cta', 'services', 'contact']) {
    await page.locator('#' + id).screenshot({ path: path.join(dir, `sec-${id}-${lang}-${w}.png`) }).catch((e) => logs.push(`section ${id}: ${String(e.message).slice(0, 120)}`));
  }
  await page.locator('footer').screenshot({ path: path.join(dir, `sec-footer-${lang}-${w}.png`) }).catch(() => {});
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`${lang} ${w}px  height=${h}  logs=${logs.length}`);
  logs.forEach((l) => console.log('   ', l));
  await ctx.close();
}
await browser.close();
server.close();
