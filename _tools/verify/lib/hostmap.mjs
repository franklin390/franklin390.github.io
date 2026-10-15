// Serves the local site under another hostname without touching the network: the page believes it lives at https://<host>/.
// Used to test what a copy of the page on another domain does (G13, live-gtm-check).
export const GUARD_LINE = 'if (HOSTS.indexOf(location.hostname) === -1) return;';

/**
 * @param context a Playwright browser context
 * @param host    hostname the page should see, e.g. 'franklin390.github.io' or 'copy-of-my-site.example'
 * @param base    where the real local server listens, e.g. 'http://127.0.0.1:4173'
 * @param opts.stripGuard  true = simulate a copier who deleted the hostname guard from the page's GTM snippet
 * @returns state  { stripped } how many HTML responses had the guard removed (0 means the anchor was not found)
 */
export async function mapHost(context, host, base, { stripGuard = false } = {}) {
  const state = { stripped: 0 };
  const re = new RegExp('^https://' + host.replace(/[.]/g, '\\.') + '(/|\\?|$)');
  await context.route(re, async (route) => {
    const u = new URL(route.request().url());
    const r = await fetch(base + u.pathname + u.search);
    const headers = {};
    r.headers.forEach((v, k) => { headers[k] = v; });
    delete headers['content-length'];
    delete headers['content-encoding']; // fetch() already decompressed the body
    let body = Buffer.from(await r.arrayBuffer());
    if (stripGuard && /text\/html/.test(headers['content-type'] || '')) {
      const html = body.toString('utf8');
      if (html.includes(GUARD_LINE)) { state.stripped++; body = Buffer.from(html.split(GUARD_LINE).join('/* host guard removed by the test */')); }
    }
    await route.fulfill({ status: r.status, headers, body });
  });
  return state;
}
