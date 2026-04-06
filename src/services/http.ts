// HTTP 请求服务 - 使用 Service Worker 代理实现跨域
import type { HttpRequest, HttpResponse, Header, Param, Collection, EnvironmentVariable } from '../types';
import { StaticVariableResolver, resolveVariables, extractUnresolvedVariables } from '../utils/variables';
import { normalizeUrl, isValidUrl, weakConcatenateBaseUrl } from '../utils/url';
import { getCurrentEnvironment } from './environment';
import { isUrlAllowed, sanitizeRequestHeaders } from '../utils/security';
import { detectProxyAvailability } from './proxyDetector';

export interface RequestConfig {
  timeout?: number;
  followRedirects?: boolean;
  validateSSL?: boolean;
}

export interface RequestContext {
  collection?: Collection;
  localVars?: EnvironmentVariable[];
}

interface SendResult {
  success: boolean;
  response?: HttpResponse;
  error?: string;
  strategy?: 'direct' | 'proxy' | 'none';
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

// 通过代理发送请求
async function sendViaProxy(
  request: HttpRequest,
  resolvedUrl: string,
  config: RequestConfig
): Promise<HttpResponse> {
  const startTime = Date.now();

  // 1. SSRF 检查
  if (!isUrlAllowed(resolvedUrl)) {
    throw new Error('目标 URL 不在允许范围内（禁止访问内网地址）');
  }

  // 2. 准备请求数据
  const url = parseUrl(resolvedUrl, request.params);
  const headers = sanitizeRequestHeaders(parseHeaders(request.headers));

  const proxyRequest = {
    url,
    method: request.method,
    headers,
    body: request.body?.mode !== 'none' ? request.body?.content : undefined,
    timeout: config.timeout || 30000,
  };

  // 3. 发送代理请求
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);

  try {
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Proxy request failed' }));
      throw new Error(error.error || `Proxy error: ${response.status}`);
    }

    const result = await response.json();
    return {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
      data: result.data,
      time: result.time ?? Date.now() - startTime,
      size: result.size,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 直接发送请求
async function sendDirect(
  request: HttpRequest,
  resolvedUrl: string,
  config: RequestConfig
): Promise<HttpResponse> {
  // 添加 SSRF 检查（即使在浏览器中也可能被利用）
  if (!isUrlAllowed(resolvedUrl)) {
    throw new Error('目标 URL 不在允许范围内（禁止访问内网地址）');
  }

  const startTime = Date.now();
  const { timeout = 30000 } = config;

  // 添加查询参数
  const url = parseUrl(resolvedUrl, request.params);

  // 构建请求头
  const headers = parseHeaders(request.headers);

  // 准备请求体
  let body: string | undefined;
  if (request.body && request.body.mode !== 'none') {
    body = request.body.content;
    if (!headers['Content-Type']) {
      if (request.body.mode === 'json') {
        headers['Content-Type'] = 'application/json';
      } else if (request.body.mode === 'urlencoded') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }
  }

  // 发送请求
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: body || undefined,
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 解析响应
    const responseClone = response.clone();
    const blob = await responseClone.blob();
    const size = blob.size;

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

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      time: Date.now() - startTime,
      size,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 构建用户友好的错误信息
function buildUserFriendlyError(errors: string[], proxyAvailable: boolean): Error {
  const errorMessages = errors.join('; ').toLowerCase();

  // DNS 错误 - 使用多种可能的特征
  if (errorMessages.includes('enotfound') ||
      errorMessages.includes('getaddrinfo') ||
      errorMessages.includes('name not resolved') ||
      errorMessages.includes('dns')) {
    return new Error('无法解析目标服务器地址，请检查 URL 是否正确');
  }

  // 连接被拒绝
  if (errorMessages.includes('econnrefused') ||
      errorMessages.includes('connection refused')) {
    return new Error('目标服务器拒绝连接，请检查服务器是否运行');
  }

  // 超时
  if (errorMessages.includes('timeout') ||
      errorMessages.includes('etimedout') ||
      errorMessages.includes('time out')) {
    return new Error('请求超时，请检查网络连接或增加超时时间');
  }

  // SSL 错误
  if (errorMessages.includes('ssl') ||
      errorMessages.includes('certificate') ||
      errorMessages.includes('cert ') ||
      errorMessages.includes('tls')) {
    return new Error('SSL 证书验证失败，请检查目标服务器的 HTTPS 配置');
  }

  // 网络错误 / 连接中断
  if (errorMessages.includes('network') ||
      errorMessages.includes('networkerror') ||
      errorMessages.includes('failed to fetch') ||
      errorMessages.includes('fetch failed') ||
      errorMessages.includes('abort')) {
    if (proxyAvailable) {
      return new Error(
        '请求失败：代理服务也无法访问目标服务器。\n' +
        '可能原因：\n' +
        '1. 目标服务器无法访问\n' +
        '2. 网络连接问题\n' +
        '3. 目标 URL 不正确'
      );
    } else {
      return new Error(
        '请求被浏览器跨域策略阻止（CORS）或网络错误。\n\n' +
        '解决方案：\n' +
        '1. 使用 CLI 模式启动：npx postlite\n' +
        '2. 联系 API 提供者开启 CORS 支持\n' +
        '3. 安装浏览器 CORS 插件（仅用于开发测试）'
      );
    }
  }

  return new Error(`请求失败：${errorMessages}`);
}

// 发送 HTTP 请求（支持自动降级策略）
export async function sendRequest(
  request: HttpRequest,
  config: RequestConfig = {},
  context?: RequestContext
): Promise<HttpResponse> {
  try {
    // 1. 解析 URL
    const { url: resolvedUrl, unresolvedVars } = resolveRequestUrl(request, context);

    if (unresolvedVars.length > 0) {
      throw new Error(`Unresolved variables: ${[...new Set(unresolvedVars)].join(', ')}`);
    }

    // 2. 验证 URL 是否有效
    if (!isValidUrl(resolvedUrl)) {
      throw new Error(`Invalid URL after variable resolution: ${resolvedUrl}`);
    }

    // 3. 检测代理可用性
    const proxyAvailable = await detectProxyAvailability();

    // 4. 构建策略列表
    const strategies: Array<() => Promise<SendResult>> = [];

    // 策略 1：如果代理可用，优先使用代理
    if (proxyAvailable) {
      strategies.push(async () => {
        try {
          const response = await sendViaProxy(request, resolvedUrl, config);
          return { success: true, response, strategy: 'proxy' };
        } catch (error) {
          if (error instanceof Error) {
            return { success: false, error: error.message, strategy: 'proxy' };
          }
          // 非 Error 异常，重新抛出以便外层捕获
          throw new Error('Unknown error occurred');
        }
      });
    }

    // 策略 2：直接请求
    strategies.push(async () => {
      try {
        const response = await sendDirect(request, resolvedUrl, config);
        return { success: true, response, strategy: 'direct' };
      } catch (error) {
        if (error instanceof Error) {
          return { success: false, error: error.message, strategy: 'direct' };
        }
        // 非 Error 异常，重新抛出以便外层捕获
        throw new Error('Unknown error occurred');
      }
    });

    // 5. 执行降级策略
    const errors: string[] = [];

    for (const strategy of strategies) {
      const result = await strategy();
      if (result.success && result.response) {
        return result.response;
      }
      if (result.error) {
        errors.push(result.error);
      }
    }

    // 6. 所有策略都失败
    throw buildUserFriendlyError(errors, proxyAvailable);

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

/** @deprecated 使用 sendRequest 替代 */
export async function sendProxyRequest(
  request: HttpRequest,
  config: RequestConfig = {},
  context?: RequestContext
): Promise<HttpResponse> {
  return sendRequest(request, config, context);
}
