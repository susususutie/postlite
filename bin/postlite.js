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
