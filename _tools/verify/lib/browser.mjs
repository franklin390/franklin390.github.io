// Shared browser environment for gates: one static server + one Chrome per run.
import { chromium } from '@playwright/test';
import { startServer } from '../../serve.mjs';

const BLOCKED = /googletagmanager\.com|google-analytics\.com|kit\.fontawesome\.com/;
const ALLOWED_EXTERNAL = [/(^|\.)googletagmanager\.com$/, /(^|\.)google-analytics\.com$/];

export async function getEnv(ctx) {
  if (ctx.env) return ctx.env;
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome' });
  const base = `http://127.0.0.1:${server.port}`;

  async function open(lang = 'en', opts = {}) {
    const { width = 1280, height = width < 600 ? 800 : 900, reducedMotion = 'reduce', storageState, query, wait = true, hash = '', isMobile, hasTouch, path: sub = '' } = opts; // sub: folder of a static language page, e.g. 'pt/'
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion, storageState, ...(isMobile !== undefined ? { isMobile } : {}), ...(hasTouch !== undefined ? { hasTouch } : {}) });
    // Never hit the real analytics from tests; requests are still recorded below.
    await context.route(BLOCKED, (r) => r.abort());
    const page = await context.newPage();
    const logs = { console: [], errors: [], failed: [], external: new Set(), requests: [] };
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type()) && !/ERR_FAILED|ERR_BLOCKED/.test(m.text())) logs.console.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => logs.errors.push(e.message));
    page.on('response', (r) => { if (r.status() >= 400) logs.failed.push(`${r.status()} ${r.url()}`); });
    page.on('request', (r) => {
      const u = new URL(r.url());
      logs.requests.push(r.url());
      if (u.hostname !== '127.0.0.1' && !ALLOWED_EXTERNAL.some((re) => re.test(u.hostname))) logs.external.add(u.hostname);
    });
    const q = query !== undefined ? query : (lang ? `?lang=${lang}` : '');
    await page.goto(`${base}/${sub}${q}${hash}`, { waitUntil: 'load' });
    if (wait) {
      await page.waitForFunction(() => { const p = document.querySelector('#preloader'); return !p || getComputedStyle(p).display === 'none'; }, null, { timeout: 20000 }).catch(() => logs.errors.push('preloader never hidden'));
      await page.waitForTimeout(300);
    }
    return { page, context, logs, close: () => context.close() };
  }

  ctx.env = { base, open, browser };
  ctx.cleanup.push(async () => { await browser.close(); server.close(); });
  return ctx.env;
}

/** All visible-or-hidden text nodes of the page (scripts/styles excluded) with their i18n coverage. */
export const collectTextNodes = () => {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style,noscript')) continue;
    const covered = !!el.closest('[data-i18n],[data-i18n-html],[data-date],[data-count],[translate="no"]');
    out.push({ text: t, covered, tag: el.tagName.toLowerCase(), cls: el.className || '', id: el.closest('[id]')?.id || '' });
  }
  return out;
};
