// Service Worker - 用于代理跨域请求
const CACHE_NAME = 'postlite-v1';

// 安装
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  self.skipWaiting();
});

// 激活
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// 处理 fetch 请求 - 拦截所有请求并代理跨域请求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // 如果是跨域请求，代理它
  if (!isSameOrigin) {
    event.respondWith(handleProxyRequest(event.request));
  }
});

// 处理代理请求
async function handleProxyRequest(request) {
  try {
    // 克隆请求
    const init = {
      method: request.method,
      headers: {},
      mode: 'cors',
      credentials: 'omit',
    };

    // 复制请求头
    request.headers.forEach((value, key) => {
      init.headers[key] = value;
    });

    // 如果是 GET/HEAD 请求，不携带 body
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const body = await request.blob();
      if (body.size > 0) {
        init.body = body;
      }
    }

    // 移除可能导致 CORS 问题的头
    delete init.headers['origin'];
    delete init.headers['referer'];

    // 发送请求
    const response = await fetch(request.url, init);

    // 创建新的响应，添加 CORS 头
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[SW] Proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

// 处理来自主线程的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PROXY_REQUEST') {
    const { request, config } = event.data;
    const port = event.ports[0];

    executeProxyRequest(request, config)
      .then(response => {
        port.postMessage({ response });
      })
      .catch(error => {
        port.postMessage({ error: error.message });
      });
  }
});

// 执行代理请求
async function executeProxyRequest(requestData, config) {
  const { method, url, headers, body, params } = requestData;
  const { timeout = 30000 } = config || {};

  // 构建 URL
  let fullUrl = url;
  if (params && params.length > 0) {
    try {
      const urlObj = new URL(fullUrl);
      params.filter(p => p.enabled && p.key).forEach(param => {
        urlObj.searchParams.set(param.key, param.value);
      });
      fullUrl = urlObj.toString();
    } catch (e) {
      console.error('[SW] URL parsing error:', e);
    }
  }

  // 构建请求头
  const requestHeaders = {};
  if (headers) {
    headers.filter(h => h.enabled && h.key).forEach(header => {
      requestHeaders[header.key] = header.value;
    });
  }

  // 准备请求选项
  const init = {
    method: method || 'GET',
    headers: requestHeaders,
    mode: 'cors',
    credentials: 'omit',
  };

  // 添加请求体
  if (body && body.mode !== 'none' && body.content) {
    init.body = body.content;
    // 自动设置 Content-Type
    if (!requestHeaders['Content-Type']) {
      if (body.mode === 'json') {
        requestHeaders['Content-Type'] = 'application/json';
      } else if (body.mode === 'urlencoded') {
        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }
  }

  // 发送请求
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  init.signal = controller.signal;

  try {
    const response = await fetch(fullUrl, init);
    clearTimeout(timeoutId);

    // 读取响应数据
    let responseData;
    const contentType = response.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
    } catch {
      responseData = await response.text();
    }

    // 转换响应头
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // 计算响应大小
    const size = typeof responseData === 'string'
      ? new Blob([responseData]).size
      : JSON.stringify(responseData).length;

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data: responseData,
      size: size,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
