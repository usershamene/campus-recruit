const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// 加载 .env 文件
try {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !process.env[key.trim()]) process.env[key.trim()] = vals.join('=').trim();
  });
} catch {}

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const UPDATE_SECRET = process.env.UPDATE_SECRET || ''; // 为空时允许本地访问
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE || ''; // 管理后台用
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:8080'];
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// 安全响应头
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

// 判断请求是否来自本机回环地址（基于 TCP 层 remoteAddress，而非可伪造的 Host 头）
function isLocalRequest(req) {
  const addr = req.socket.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

const server = http.createServer((req, res) => {
  setSecurityHeaders(res);

  // CORS - 限制来源
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // API: trigger update
  if (req.method === 'POST' && req.url === '/api/update') {
    // 认证检查：优先 Token；无 Token 时仅允许本机回环地址（防止 Host 头伪造越权）
    const isLocal = isLocalRequest(req);
    const token = req.headers['x-update-token'] || new URL(req.url, 'http://localhost').searchParams.get('token');
    if (UPDATE_SECRET && token !== UPDATE_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, msg: '未授权' }));
    }
    if (!UPDATE_SECRET && !isLocal) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, msg: '远程更新需要配置 UPDATE_SECRET' }));
    }

    const metaPath = path.join(ROOT, 'data', 'update-meta.json');
    // Check if already running
    if (global._updating) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, msg: '更新进行中，请稍候' }));
    }
    global._updating = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, msg: '开始更新' }));

    // 使用 execFile 替代 exec，避免 shell 注入
    execFile('node', ['fetch-data.js'], { cwd: ROOT, timeout: 1800000 }, (err) => {
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

  // API: admin key (only loopback)
  if (req.method === 'GET' && req.url === '/api/admin-key') {
    if (!isLocalRequest(req)) { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: false })); }
    if (!ADMIN_KEY) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: false, msg: '未配置 SUPABASE_SERVICE_ROLE' })); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, key: ADMIN_KEY }));
  }

  // Static files
  let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
  filePath = path.normalize(filePath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // JSON 文件不缓存，HTML 加 no-cache
    if (ext === '.json' || ext === '.html') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
});

// 仅监听回环地址：管理接口（admin-key）与数据更新接口只允许本机访问
server.listen(PORT, '127.0.0.1', () => console.log(`Server running at http://localhost:${PORT}/`));
