/**
 * 代理检测模块
 * 检测 CLI 代理端点的可用性，带缓存和并发控制
 */

// ============ 常量定义 ============
const PROXY_CACHE_KEY = 'postlite:proxy:available';
const CACHE_TTL_SUCCESS = 5 * 60 * 1000;  // 成功时缓存 5 分钟
const CACHE_TTL_FAILURE = 30 * 1000;      // 失败时缓存 30 秒
const DETECTION_TIMEOUT = 5000;           // 探测超时 5 秒

// ============ 类型定义 ============
interface ProxyCache {
  available: boolean;
  timestamp: number;
  expires: number;
}

// ============ 内部状态 ============
let detectionPromise: Promise<boolean> | null = null;
let memoryCache: ProxyCache | null = null;
let networkListenerInitialized = false;

// ============ 私有函数 ============

/**
 * 探测代理端点健康状态
 */
async function probeProxyEndpoint(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DETECTION_TIMEOUT);

    const response = await fetch('/api/proxy/health', {
      method: 'GET',
      signal: controller.signal,
      // 避免缓存探测请求
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 从 localStorage 读取缓存
 */
function readStorageCache(): ProxyCache | null {
  try {
    const raw = localStorage.getItem(PROXY_CACHE_KEY);
    if (!raw) return null;

    const cache: ProxyCache = JSON.parse(raw);

    // 验证缓存结构
    if (
      typeof cache.available !== 'boolean' ||
      typeof cache.timestamp !== 'number' ||
      typeof cache.expires !== 'number'
    ) {
      return null;
    }

    return cache;
  } catch {
    // localStorage 访问失败或 JSON 解析失败
    return null;
  }
}

/**
 * 写入缓存到 localStorage
 */
function writeStorageCache(cache: ProxyCache): void {
  try {
    localStorage.setItem(PROXY_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage 写入失败静默处理，不中断流程
    // 常见于隐私模式或存储已满
  }
}

/**
 * 清除 localStorage 缓存
 */
function clearStorageCache(): void {
  try {
    localStorage.removeItem(PROXY_CACHE_KEY);
  } catch {
    // 忽略 localStorage 操作失败
  }
}

/**
 * 检查缓存是否过期
 */
function isCacheExpired(cache: ProxyCache): boolean {
  return Date.now() > cache.expires;
}

// ============ 公共 API ============

/**
 * 检测代理可用性（带缓存和去重）
 * - 优先使用内存缓存
 * - 其次检查 localStorage 缓存
 * - 无缓存或过期时发起探测
 * - 并发调用会复用同一个探测 Promise
 */
export async function detectProxyAvailability(): Promise<boolean> {
  // 1. 检查内存缓存
  if (memoryCache && !isCacheExpired(memoryCache)) {
    return memoryCache.available;
  }

  // 2. 检查 localStorage 缓存
  const storageCache = readStorageCache();
  if (storageCache && !isCacheExpired(storageCache)) {
    // 同步到内存缓存
    memoryCache = storageCache;
    return storageCache.available;
  }

  // 3. 检查是否有进行中的探测
  if (detectionPromise) {
    return detectionPromise;
  }

  // 4. 发起新探测（带缓存验证）
  detectionPromise = probeWithCache();

  return detectionPromise;
}

/**
 * 带缓存验证的探测函数
 * 防止竞态条件：在 Promise 完成时重新检查缓存状态
 */
async function probeWithCache(): Promise<boolean> {
  // 再次检查内存缓存（双重检查锁定模式）
  if (memoryCache && Date.now() < memoryCache.expires) {
    detectionPromise = null;
    return memoryCache.available;
  }

  // 再次检查 localStorage 缓存
  const storageCache = readStorageCache();
  if (storageCache && Date.now() < storageCache.expires) {
    memoryCache = storageCache;
    detectionPromise = null;
    return storageCache.available;
  }

  // 发送探测请求
  const available = await probeProxyEndpoint();

  // 再次检查，防止在请求期间缓存被更新
  if (memoryCache && Date.now() < memoryCache.expires) {
    detectionPromise = null;
    return memoryCache.available;
  }

  // 更新缓存
  const now = Date.now();
  const ttl = available ? CACHE_TTL_SUCCESS : CACHE_TTL_FAILURE;

  const newCache: ProxyCache = {
    available,
    timestamp: now,
    expires: now + ttl,
  };

  memoryCache = newCache;
  writeStorageCache(newCache);
  detectionPromise = null;

  return available;
}

/**
 * 清除代理缓存
 * - 清除内存缓存
 * - 清除 localStorage 缓存
 */
export function clearProxyCache(): void {
  memoryCache = null;
  clearStorageCache();
}

/**
 * 初始化网络状态监听
 * - 监听 window 'online' 事件
 * - 网络恢复时自动清除缓存，下次检测会重新探测
 */
export function initNetworkStatusListener(): void {
  if (networkListenerInitialized) {
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('online', () => {
    // 网络恢复时清除缓存，强制下次重新探测
    clearProxyCache();
  });

  networkListenerInitialized = true;
}

/**
 * 获取当前缓存状态（用于调试）
 */
export function getProxyCacheStatus(): {
  memoryCache: ProxyCache | null;
  storageCache: ProxyCache | null;
  hasPendingDetection: boolean;
} {
  return {
    memoryCache,
    storageCache: readStorageCache(),
    hasPendingDetection: detectionPromise !== null,
  };
}
