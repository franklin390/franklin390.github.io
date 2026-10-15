// Minimal static server that mimics GitHub Pages for the repo root.
// Usage: node serve.mjs [port]   (default 4173). Also importable: startServer(port).
import http from 'node:http';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.otf': 'font/otf', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.ico': 'image/x-icon',
};

/** the request handler, reusable by an http2 server (perf.mjs) */
export const handle = (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      // Jekyll/Pages never serve underscore-prefixed or dot paths: mirror that so tests catch leaks.
      if (rel.split('/').some((seg) => seg.startsWith('_') || (seg.startsWith('.') && seg.length > 1))) {
        res.writeHead(404).end('Not found (hidden path, as on GitHub Pages)');
        return;
      }
      let file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(404).end('Not found'); return; }
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      // like GitHub Pages: text-like files are sent gzip-compressed (so measured transfer sizes are the real ones)
      const gzip = /gzip/.test(req.headers['accept-encoding'] || '') && /^(text\/|application\/(xml|json)|image\/svg|font\/(ttf|otf)|application\/vnd\.ms-fontobject)/.test(type);
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', ...(gzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}) });
      if (gzip) fs.createReadStream(file).pipe(zlib.createGzip({ level: 6 })).pipe(res); else fs.createReadStream(file).pipe(res);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
};

export function startServer(port = 0) {
  const server = http.createServer(handle);
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => { server.port = server.address().port; resolve(server); }));
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const port = Number(process.argv[2]) || 4173;
  await startServer(port);
  console.log(`Serving ${ROOT} at http://127.0.0.1:${port}/`);
}
