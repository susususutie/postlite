// HTTP 请求服务 - 使用 Service Worker 代理实现跨域
import type { HttpRequest, HttpResponse, Header, Param, Collection, EnvironmentVariable } from '../types';
import { StaticVariableResolver, resolveVariables, extractUnresolvedVariables } from '../utils/variables';
import { normalizeUrl, isValidUrl, weakConcatenateBaseUrl } from '../utils/url';
import { getCurrentEnvironment } from './environment';

export interface RequestConfig {
  timeout?: number;
  followRedirects?: boolean;
  validateSSL?: boolean;
}

export interface RequestContext {
  collection?: Collection;
  localVars?: EnvironmentVariable[];
}

/**
 * Resolve request URL with variable substitution, base URL concatenation, and normalization
 */
export function resolveRequestUrl(
  request: HttpRequest,
  context?: RequestContext
): { url: string; unresolvedVars: string[] } {
  const environment = getCurrentEnvironment();
  const envVars = environment?.variables || [];
  const localVars = context?.localVars || [];

  // 1. Determine raw URL (weak concatenation with defaultBaseUrl)
  let rawUrl = request.url;
  const collectionBaseUrl = context?.collection?.defaultBaseUrl;

  // Weak concatenation: only when no protocol, no template, not absolute path, and baseUrl exists
  if (rawUrl && collectionBaseUrl) {
    rawUrl = weakConcatenateBaseUrl(rawUrl, collectionBaseUrl);
  }

  // 2. Create variable resolver
  const resolver = new StaticVariableResolver(envVars, localVars);

  // 3. Recursively resolve variables
  let resolvedUrl: string;
  try {
    resolvedUrl = resolveVariables(rawUrl, resolver);
  } catch (error) {
    // Re-throw circular reference or depth limit errors with context
    throw new Error(`Variable resolution failed: ${(error as Error).message}`);
  }

  // 4. Check for unresolved variables
  const unresolvedVars = extractUnresolvedVariables(resolvedUrl);

  // 5. Normalize URL only if there are no unresolved variables
  // (to avoid encoding template syntax like {{variable}})
  const normalizedUrl = unresolvedVars.length === 0
    ? normalizeUrl(resolvedUrl)
    : resolvedUrl;

  return { url: normalizedUrl, unresolvedVars };
}

// 解析 URL 并应用环境变量 (legacy version for backward compatibility)
export function parseUrl(url: string, params: Param[]): string {
  let parsedUrl = url;

  // 添加查询参数
  const enabledParams = params.filter(p => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const urlObj = new URL(parsedUrl);
    enabledParams.forEach(param => {
      urlObj.searchParams.set(param.key, param.value);
    });
    parsedUrl = urlObj.toString();
  }

  return parsedUrl;
}

// 解析请求头
export function parseHeaders(headers: Header[]): Record<string, string> {
  const result: Record<string, string> = {};
  headers.filter(h => h.enabled && h.key).forEach(header => {
    result[header.key] = header.value;
  });
  return result;
}

// 发送 HTTP 请求（通过 Service Worker 代理）
export async function sendRequest(
  request: HttpRequest,
  config: RequestConfig = {},
  context?: RequestContext
): Promise<HttpResponse> {
  const startTime = Date.now();
  const { timeout = 30000 } = config;

  try {
    // 1. Resolve URL with variable substitution and normalization
    const { url: resolvedUrl, unresolvedVars } = resolveRequestUrl(request, context);

    // 2. Check for unresolved variables (strict validation in HTTP layer)
    if (unresolvedVars.length > 0) {
      throw new Error(`Unresolved variables: ${[...new Set(unresolvedVars)].join(', ')}`);
    }

    // 3. Validate final URL
    if (!isValidUrl(resolvedUrl)) {
      throw new Error(`Invalid URL after variable resolution: ${resolvedUrl}`);
    }

    // 4. Add query parameters
    const url = parseUrl(resolvedUrl, request.params);
    
    // 构建请求头
    const headers = parseHeaders(request.headers);
    
    // 准备请求体
    let body: string | undefined;
    if (request.body && request.body.mode !== 'none') {
      body = request.body.content;
      
      // 自动设置 Content-Type
      if (!headers['Content-Type']) {
        if (request.body.mode === 'json') {
          headers['Content-Type'] = 'application/json';
        } else if (request.body.mode === 'urlencoded') {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }
    }
    
    // 使用 fetch API 发送请求
    // 在生产环境中，请求会被 Service Worker 拦截并代理
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      body: body || undefined,
      mode: 'cors',
      credentials: 'omit',
    };
    
    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;
    
    // 发送请求
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    
    // 计算响应大小
    const responseClone = response.clone();
    const blob = await responseClone.blob();
    const size = blob.size;
    
    // 解析响应数据
    let data: unknown;
    const contentType = response.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch {
      data = await response.text();
    }
    
    // 转换响应头
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    const endTime = Date.now();
    
    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      time: endTime - startTime,
      size,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
    
    throw new Error('Unknown error occurred');
  }
}

// 通过 Service Worker 代理发送请求（用于处理 CORS）
export async function sendProxyRequest(
  request: HttpRequest,
  config: RequestConfig = {},
  context?: RequestContext
): Promise<HttpResponse> {
  // 检查 Service Worker 是否可用
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        const endTime = Date.now();
        const { response, error } = event.data;
        
        if (error) {
          reject(new Error(error));
        } else {
          resolve({
            ...response,
            time: endTime - startTime,
          });
        }
      };
      
      // 发送消息给 Service Worker
      navigator.serviceWorker.controller!.postMessage(
        {
          type: 'PROXY_REQUEST',
          request,
          config,
        },
        [messageChannel.port2]
      );
    });
  }
  
  // 如果 Service Worker 不可用，直接发送请求
  return sendRequest(request, config, context);
}
