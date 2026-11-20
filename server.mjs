// Zero-dependency static server so any PC on the network can open the briefing:
//   node server.mjs            → briefing on :8080, digital-twin viewer on :8081
// Any static host (IIS, nginx, Apache) serving ./public works for the briefing itself.
//
// The digital-twin viewer is served READ-ONLY, in place, from local_app/viewer
// (override with TWIN_DIR). Only GET/HEAD are answered, so the viewer's autosave
// (POST /api/save → data/app_state.json) and editor writes are refused: the copy
// running in flood-twin-viewer.exe and its files are never touched. It needs its
// own port because the viewer fetches absolute paths like /api/... and ./data/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const PORT = Number(process.env.PORT) || 8080;
const TWIN_PORT = Number(process.env.TWIN_PORT) || 8081;
const TWIN_DIR = process.env.TWIN_DIR || path.resolve(import.meta.dirname, '..', 'local_app', 'viewer');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm',
};

// Text files are gzipped once per version and kept in memory (three.module.js: 1.2 MB → ~0.25 MB).
const COMPRESS = /^(text\/|application\/(json|wasm)|image\/svg)/;
const gzCache = new Map();
function gzipped(file, st) {
  const hit = gzCache.get(file);
  if (hit && hit.mtime === st.mtimeMs) return hit.buf;
  const buf = zlib.gzipSync(fs.readFileSync(file), { level: 4 });
  gzCache.set(file, { mtime: st.mtimeMs, buf });
  return buf;
}
// Pre-warm three.module.js in the gzip cache so the very first browser launch doesn't wait on compression.
try {
  const threeFile = path.join(import.meta.dirname, 'public', 'vendor', 'three.module.js');
  gzipped(threeFile, fs.statSync(threeFile));
} catch {}

// The briefing preloads the twin viewer and drives it (Path 5, buildings on) through one script,
// added to the viewer's index.html as it is served here. The viewer's files are never changed.
const TWIN_SCRIPT = '/__ngt/autoplay.js';
const twinInject = {
  [TWIN_SCRIPT]: path.join(import.meta.dirname, 'twin', 'autoplay.js'),
  html: (s) => s.replace('</body>', `<script src="${TWIN_SCRIPT}"></script></body>`),
};

function serve(root, port, label, inject = null) {
  root = path.resolve(root);
  http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.writeHead(405).end(); // read-only by design
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return res.writeHead(400).end(); }
    if (inject && inject[rel]) {
      return fs.readFile(inject[rel], (err, buf) => err ? res.writeHead(404).end()
        : res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-cache' }).end(req.method === 'HEAD' ? undefined : buf));
    }
    if (inject && (rel === '/' || rel === '/index.html')) {
      return fs.readFile(path.join(root, 'index.html'), 'utf8', (err, html) => err ? res.writeHead(404).end()
        : res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' }).end(req.method === 'HEAD' ? undefined : inject.html(html)));
    }
    const file = path.join(root, rel.endsWith('/') ? rel + 'index.html' : rel);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end(); // block ../ traversal

    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return res.writeHead(404).end('Not found');
      const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      // Browsers revalidate with the ETag (a cheap 304), so edits show up on the next load;
      // third-party libraries and media never change in place, so those are cached for a week.
      const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
      const cache = /^(vendor|assets)[\\/]/.test(path.relative(root, file)) ? 'public, max-age=604800' : 'no-cache';
      const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', ETag: etag, 'Cache-Control': cache };
      if (req.headers['if-none-match'] === etag) return res.writeHead(304, headers).end();
      if (COMPRESS.test(type) && !req.headers.range && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
        let buf;
        try { buf = gzipped(file, st); } catch { return res.writeHead(500).end(); }
        res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': buf.length, Vary: 'Accept-Encoding' });
        return res.end(req.method === 'HEAD' ? undefined : buf);
      }
      // Range support so demo videos can seek and loop smoothly.
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (m) {
        const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]);
        const end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
        if (start > end) return res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end();
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
        return req.method === 'HEAD' ? res.end() : fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
      req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
    });
  }).listen(port, '0.0.0.0', () => console.log(`${label} → http://localhost:${port}`));
}

// Some portals send X-Frame-Options: SAMEORIGIN, so browsers refuse to show them inside the
// briefing. Each gets its own pass-through port: every request is relayed unchanged and only the
// framing headers are dropped from responses. The portal and its server are never modified.
// A whole port (not a sub-path) per portal, because portals fetch absolute paths like /static/...
const FRAME_PROXIES = [
  { port: Number(process.env.AVALANCHE_PORT) || 8082, target: process.env.AVALANCHE_URL || 'http://172.18.61.6:5000', label: 'Snow avalanche portal' },
];
function frameProxy({ port, target, label }) {
  const up = new URL(target);
  http.createServer((req, res) => {
    const fwd = http.request({ host: up.hostname, port: up.port || 80, method: req.method, path: req.url, headers: { ...req.headers, host: up.host } }, (r) => {
      const h = { ...r.headers };
      delete h['x-frame-options'];
      if (h['content-security-policy']) h['content-security-policy'] = h['content-security-policy'].replace(/frame-ancestors[^;]*;?/i, '');
      if (h.location) h.location = h.location.replace(up.origin, `http://${req.headers.host}`); // keep redirects on the proxy
      res.writeHead(r.statusCode, h);
      r.pipe(res);
    });
    // Drop the connection like the portal itself would, so the briefing's fallback detects it.
    fwd.on('error', () => { console.warn(`${label} is unreachable at ${target}`); res.destroy(); });
    fwd.setTimeout(15000, () => fwd.destroy());
    req.pipe(fwd);
  }).listen(port, '0.0.0.0', () => console.log(`${label} (framing proxy for ${target}) → http://localhost:${port}`));
}
FRAME_PROXIES.forEach(frameProxy);

serve(path.join(import.meta.dirname, 'public'), PORT, 'NGT briefing portal');
if (fs.existsSync(path.join(TWIN_DIR, 'index.html'))) serve(TWIN_DIR, TWIN_PORT, `Digital twin viewer (read-only, ${TWIN_DIR})`, twinInject);
else console.warn(`Digital twin viewer not found at ${TWIN_DIR} — set TWIN_DIR to enable it.`);
