# Postlite Web 部署跨域问题解决方案

## 问题分析

### 当前架构的局限性

Postlite 目前采用以下架构处理 HTTP 请求：

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   浏览器页面     │────▶│  Service Worker  │────▶│   目标 API 服务器 │
│  (App.tsx)      │     │   (sw.js)        │     │   (第三方)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         │         ┌─────────────┘
         │         ▼
         │    ┌──────────────────┐
         └───▶│  直接 fetch()    │
              │  (受 CORS 限制)   │
              └──────────────────┘
```

### 根本原因

1. **Service Worker 无法突破 CORS 限制**
   - Service Worker 运行在浏览器环境中
   - `sw.js` 中的 `fetch()` 调用仍然受浏览器同源策略约束
   - 只能修改请求/响应头，无法绕过服务器的 CORS 验证

2. **CLI 服务器仅提供静态文件**
   - `bin/postlite.js` 只处理静态资源请求
   - 没有 API 代理端点，无法转发跨域请求

3. **浏览器安全模型**
   - 任何在浏览器中执行的代码（包括 Service Worker）都受 CORS 约束
   - 只有当目标服务器返回 `Access-Control-Allow-Origin` 头时，请求才能成功

### 当前代码问题定位

| 文件 | 问题 |
|------|------|
| `src/services/http.ts:115` | `sendRequest` 直接使用 `fetch(url, fetchOptions)`，没有代理 |
| `src/services/http.ts:158-195` | `sendProxyRequest` 尝试通过 Service Worker 代理，但 SW 仍在浏览器内 |
| `public/sw.js:28-72` | `handleProxyRequest` 和 `executeProxyRequest` 无法突破 CORS |
| `bin/postlite.js` | 缺少 `/proxy` 端点来处理 API 请求转发 |

---

## 解决方案

### 方案一：CLI 服务器代理（推荐）

扩展 `bin/postlite.js`，添加 API 代理端点，将跨域请求转移到服务器端处理。

**优势：**
- 服务器端不受浏览器 CORS 限制
- 实现简单，不需要额外依赖
- 保持现有架构，向后兼容

**实现思路：**

```javascript
// bin/postlite.js 添加代理端点
if (req.url.startsWith('/api/proxy')) {
  // 解析目标 URL
  // 使用 Node.js http/https 模块转发请求
  // 返回响应给前端
}
```

**前端改造：**

```typescript
// src/services/http.ts
export async function sendRequest(...) {
  // 检测是否在 CLI 服务器环境
  const useProxy = window.location.hostname === 'localhost' || 
                   window.location.protocol === 'http:';
  
  if (useProxy) {
    // 通过 /api/proxy 转发
    return fetch('/api/proxy', {
      method: 'POST',
      body: JSON.stringify({ url, method, headers, body })
    });
  } else {
    // 直接使用 fetch（可能受 CORS 限制）
    return fetch(url, fetchOptions);
  }
}
```

---

### 方案二：混合代理策略

根据部署环境自动选择最优的代理方式：

```
部署环境判断：
├─ CLI 模式 (localhost/postlite CLI)
│   └─ 使用本地服务器代理 (/api/proxy)
├─ 静态部署 (GitHub Pages/Vercel/Netlify)
│   ├─ 配置代理规则 (vercel.json/_redirects)
│   └─ 或提示用户使用 CORS 浏览器插件
└─ Electron 桌面应用
    └─ 使用 Node.js 原生请求 (无 CORS 限制)
```

**各平台代理配置：**

1. **Vercel** - `vercel.json`
```json
{
  "rewrites": [
    {
      "source": "/api/proxy/:path*",
      "destination": ":path*"
    }
  ]
}
```

2. **Netlify** - `_redirects`
```
/api/proxy/*  :splat  200
```

3. **Cloudflare Pages** - `_worker.js`
```javascript
export default {
  async fetch(request, env) {
    if (request.url.includes('/api/proxy')) {
      // 转发请求
    }
  }
}
```

---

### 方案三：Electron 桌面应用（长期方案）

将 Postlite 打包为 Electron 应用，使用 Node.js 原生 HTTP 客户端：

**优势：**
- 完全绕过浏览器 CORS 限制
- 可以访问本地文件系统
- 更好的性能和更多功能（如 WebSocket）

**技术栈：**
- Electron 主进程：Node.js `http`/`https` 模块发送请求
- 渲染进程：保持现有 React 代码
- IPC 通信：`ipcRenderer` / `ipcMain`

---

### 方案四：浏览器插件辅助（临时方案）

对于静态部署场景，指导用户安装 CORS 浏览器插件：

- **Chrome**: CORS Unblock, Allow CORS
- **Firefox**: CORS Everywhere
- **Edge**: CORS Unblock

**注意事项：**
- 仅用于开发测试，生产环境不推荐
- 需要用户手动安装和启用
- 部分企业环境可能限制插件安装

---

### 方案五：第三方 CORS 代理服务

使用公开的 CORS 代理服务（不推荐用于敏感数据）：

```typescript
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest='
];

// 自动切换代理
async function sendWithFallbackProxy(url, options) {
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(proxy + encodeURIComponent(url), options);
      if (response.ok) return response;
    } catch (e) {
      continue;
    }
  }
  throw new Error('All proxies failed');
}
```

**风险：**
- 数据经过第三方服务器
- 代理服务可能不稳定或被限制
- 不适合发送敏感信息

---

## 推荐实施计划

### 第一阶段：CLI 服务器代理（高优先级）

1. **修改 `bin/postlite.js`**
   - 添加 `/api/proxy` POST 端点
   - 使用 Node.js 原生模块转发请求
   - 支持超时、错误处理

2. **修改 `src/services/http.ts`**
   - 检测运行环境（CLI vs 静态部署）
   - CLI 环境下使用 `/api/proxy`
   - 保留现有逻辑作为 fallback

3. **更新部署文档**
   - 说明 CLI 模式支持跨域
   - 静态部署的局限性

### 第二阶段：平台适配（中优先级）

1. 为 Vercel/Netlify/Cloudflare Pages 添加代理配置
2. 创建部署模板和一键部署按钮
3. 编写各平台的部署指南

### 第三阶段：Electron 应用（低优先级）

1. 搭建 Electron 基础架构
2. 实现主进程 HTTP 客户端
3. 打包和自动更新

---

## 技术细节

### CLI 代理端点设计

```typescript
// 请求格式
interface ProxyRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

// 响应格式
interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: string | object;
  time: number;
  size: number;
}
```

### 环境检测逻辑

```typescript
function shouldUseProxy(): boolean {
  // 检测是否在 CLI 服务器环境
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isCliPort = window.location.port === '3456'; // CLI 默认端口
  
  // 检测是否有代理端点可用（发送探测请求）
  return isLocalhost && isCliPort;
}
```

---

## 总结

| 方案 | 复杂度 | 安全性 | 适用场景 |
|------|--------|--------|----------|
| CLI 服务器代理 | 低 | 高 | 本地开发、私有部署 |
| 平台适配代理 | 中 | 高 | 公开部署到 Vercel/Netlify |
| Electron 应用 | 高 | 高 | 桌面应用、高级用户 |
| 浏览器插件 | 低 | 中 | 临时解决方案 |
| 第三方代理 | 低 | 低 | 不推荐 |

**立即行动项：**
1. 实施方案一（CLI 服务器代理）解决当前 CLI 部署的跨域问题
2. 更新文档说明 Web 部署的 CORS 限制
3. 考虑方案三（Electron）作为长期目标
