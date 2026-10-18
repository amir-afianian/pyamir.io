import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { buildSite } from './build-site.mjs';

const dir = buildSite();
const port = Number(process.env.PORT) || 4318;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const file = path.join(dir, pathname.endsWith('/') ? pathname + 'index.html' : pathname);
  if (!file.startsWith(dir + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': `${types[path.extname(file)] ?? 'application/octet-stream'}; charset=utf-8`, 'cache-control': 'no-store' }).end(body);
  });
}).listen(port, '127.0.0.1', () => console.log(`serving _site on http://127.0.0.1:${port}`));
