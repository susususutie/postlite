#!/usr/bin/env node

/**
 * Postlite CLI - 启动本地 API 测试工具服务器
 * Usage: npx postlite [port]
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 禁止的主机和 IP 段
const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '::1', '0.0.0.0',
  '169.254.169.254', '169.254.170.2', '100.100.100.200',
];

// 敏感端口列表
const SENSITIVE_PORTS = [22, 23, 25, 53, 110, 143, 3306, 5432, 6379, 27017];

// 检查 IP 是否在私有地址段
function isPrivateIP(ip) {
  const parts = ip.split('.').map(Number);
  // 检查 10.x.x.x
  if (parts[0] === 10) return true;
  // 检查 172.16-31.x.x
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 检查 192.168.x.x
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 检查 127.x.x.x
  if (parts[0] === 127) return true;
  // 检查 169.254.x.x
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 检查 0.x.x.x
  if (parts[0] === 0) return true;
  return false;
}

// 检查 IPv6 是否为私有地址
function isPrivateIPv6(ip) {
  // 检查 ::1 (loopback)
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
  // 检查 ::ffff:127.0.0.1 (IPv4-mapped IPv6 loopback)
  if (ip === '::ffff:127.0.0.1' || ip === '::ffff:7f00:1') return true;
  // 检查 fe80::/10 (link-local)
  if (ip.toLowerCase().startsWith('fe80:')) return true;
  // 检查 fc00::/7 (unique local)
  const first = ip.toLowerCase().slice(0, 2);
  if (first === 'fc' || first === 'fd') return true;
  return false;
}

// 过滤敏感响应头
function sanitizeResponseHeaders(headers) {
  const sensitive = new Set([
    'set-cookie', 'server', 'x-powered-by',
    'x-amzn-requestid', 'x-amz-cf-id'
  ]);
  const sanitized = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!sensitive.has(key.toLowerCase())) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// 不区分大小写删除 header
function deleteHeader(headers, name) {
  const lowerName = name.toLowerCase();
  Object.keys(headers).forEach(key => {
    if (key.toLowerCase() === lowerName) {
      delete headers[key];
    }
  });
}

// 验证 URL 是否允许
function isUrlAllowed(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    // 只允许 http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    // 检查主机名
    if (BLOCKED_HOSTS.includes(parsed.hostname)) {
      return false;
    }
    // 检查 IPv4
    if (isPrivateIP(parsed.hostname)) {
      return false;
    }
    // 检查 IPv6
    if (isPrivateIPv6(parsed.hostname)) {
      return false;
    }
    // 检查敏感端口
    const port = parseInt(parsed.port, 10);
    if (port && SENSITIVE_PORTS.includes(port)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// 代理请求处理函数
function handleProxyRequest(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // 读取请求体（带大小限制）
  let body = '';
  let bodySize = 0;
  let isAborted = false; // 添加标记防止重复响应
  const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

  req.on('data', chunk => {
    if (isAborted) return; // 已终止则忽略

    bodySize += chunk.length;
    if (bodySize > MAX_BODY_SIZE) {
      isAborted = true;
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body too large' }));
      req.destroy(); // 终止请求
      return;
    }
    body += chunk.toString();
  });

  req.on('end', async () => {
    if (isAborted) return; // 已终止则不处理
    try {
      const config = JSON.parse(body);
      const { url: targetUrl, method, headers, body: reqBody, timeout = 30000 } = config;

      // 验证 URL
      if (!isUrlAllowed(targetUrl)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'URL not allowed' }));
        return;
      }

      // 解析目标 URL
      const parsed = new URL(targetUrl);
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: method || 'GET',
        headers: { ...headers },
        timeout: timeout,
      };

      // 清理请求头
      deleteHeader(options.headers, 'origin');
      deleteHeader(options.headers, 'referer');
      deleteHeader(options.headers, 'cookie');
      deleteHeader(options.headers, 'authorization');

      const startTime = Date.now();
      const protocol = parsed.protocol === 'https:' ? https : http;

      const proxyReq = protocol.request(options, (proxyRes) => {
        // DNS 重绑定防护：验证实际连接的远程地址
        const remoteAddress = proxyReq.socket?.remoteAddress;
        if (remoteAddress) {
          if (isPrivateIP(remoteAddress) || isPrivateIPv6(remoteAddress)) {
            proxyReq.destroy();
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'DNS rebinding detected' }));
            return;
          }
        }

        const chunks = [];
        proxyRes.on('data', chunk => chunks.push(chunk));
        proxyRes.on('end', () => {
          const buffer = Buffer.concat(chunks);

          // 根据 Content-Type 处理响应数据
          const contentType = proxyRes.headers['content-type'] || '';
          let responseData;
          let encoding = 'utf-8';

          if (contentType.includes('image/') ||
              contentType.includes('application/pdf') ||
              contentType.includes('application/octet-stream') ||
              contentType.includes('audio/') ||
              contentType.includes('video/')) {
            // 二进制数据：转为 base64
            responseData = buffer.toString('base64');
            encoding = 'base64';
          } else if (contentType.includes('application/json')) {
            // JSON 数据
            responseData = buffer.toString('utf-8');
            encoding = 'utf-8';
          } else {
            // 文本数据
            responseData = buffer.toString('utf-8');
            encoding = 'utf-8';
          }

          const result = {
            status: proxyRes.statusCode,
            statusText: proxyRes.statusMessage,
            headers: sanitizeResponseHeaders(proxyRes.headers),
            data: responseData,
            encoding: encoding,
            size: buffer.length,
            time: Date.now() - startTime,
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        });
      });

      proxyReq.on('error', (error) => {
        console.error('[Proxy] Request error:', error);

        let statusCode = 500;
        let errorMessage = 'Proxy request failed';

        if (error.code === 'ENOTFOUND') {
          statusCode = 502;
          errorMessage = 'DNS lookup failed - target host not found';
        } else if (error.code === 'ECONNREFUSED') {
          statusCode = 502;
          errorMessage = 'Connection refused - target server rejected the connection';
        } else if (error.code === 'ETIMEDOUT') {
          statusCode = 504;
          errorMessage = 'Connection timed out';
        } else if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
          statusCode = 502;
          errorMessage = 'SSL certificate error';
        }

        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errorMessage, code: error.code }));
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request timeout' }));
      });

      if (reqBody) {
        proxyReq.write(reqBody);
      }
      proxyReq.end();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

const PORT = process.argv[2] || 3456;
const DIST_DIR = path.join(__dirname, '..', 'dist');

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// 获取 MIME 类型
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// 读取文件
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch (e) {
    return null;
  }
}

// 检查文件是否存在
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (e) {
    return false;
  }
}

// 创建服务器
const server = http.createServer((req, res) => {
  // 代理端点
  if (req.url === '/api/proxy' || req.url === '/api/proxy/health') {
    if (req.url === '/api/proxy/health' && req.method === 'GET') {
      // 健康检查端点
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    handleProxyRequest(req, res);
    return;
  }

  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 解析 URL
  let url = req.url;
  if (url === '/') {
    url = '/index.html';
  }

  // 构建文件路径
  const filePath = path.join(DIST_DIR, url);

  // 安全检查：确保文件在 DIST_DIR 内
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // 尝试提供文件
  if (fileExists(filePath)) {
    const content = readFile(filePath);
    const mimeType = getMimeType(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  } else {
    // 对于单页应用，返回 index.html（客户端路由）
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fileExists(indexPath)) {
      const content = readFile(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  }
});

// 检查 dist 目录是否存在
if (!fs.existsSync(DIST_DIR)) {
  console.error(`Error: dist directory not found at ${DIST_DIR}`);
  console.error('Please run "npm run build" first to build the application.');
  process.exit(1);
}

// 启动服务器
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('\n🚀 Postlite server started!');
  console.log(`\n📍 Local:   ${url}`);
  console.log(`\nPress Ctrl+C to stop the server\n`);

  // 自动打开浏览器
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' :
              platform === 'win32' ? 'start' : 'xdg-open';

  exec(`${cmd} ${url}`, (err) => {
    if (err) {
      // 打开浏览器失败不影响服务器运行
      console.log(`Please open ${url} in your browser manually.`);
    }
  });
});

// 处理关闭信号
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down Postlite server...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
