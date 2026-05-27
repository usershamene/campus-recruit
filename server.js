const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8080;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  // API: trigger update
  if (req.method === 'POST' && req.url === '/api/update') {
    const metaPath = path.join(ROOT, 'data', 'update-meta.json');
    // Check if already running
    if (global._updating) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, msg: '更新进行中，请稍候' }));
    }
    global._updating = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, msg: '开始更新' }));

    exec('node fetch-data.js', { cwd: ROOT, timeout: 1800000, shell: true }, (err) => {
      global._updating = false;
      const now = new Date().toISOString();
      const meta = { lastUpdate: now, success: !err };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
      if (err) console.error('[update] Error:', err.message);
      else console.log('[update] Done at', now);
    });
    return;
  }

  // API: get update meta
  if (req.method === 'GET' && req.url === '/api/update-meta') {
    const metaPath = path.join(ROOT, 'data', 'update-meta.json');
    try {
      const data = fs.readFileSync(metaPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(data);
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ lastUpdate: null }));
    }
  }

  // Static files
  let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
  filePath = path.normalize(filePath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}/`));
