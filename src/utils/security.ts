/**
 * SSRF 防护模块
 * 提供 URL 验证、IP 规范化、请求头过滤等安全功能
 */

// ============ 错误消息定义 ============

export const SECURITY_ERROR_MESSAGES: Record<string, { title: string; description: string; solutions: string[] }> = {
  INVALID_PROTOCOL: {
    title: '不支持的协议',
    description: '只允许使用 HTTP 或 HTTPS 协议',
    solutions: ['请使用 http:// 或 https:// 开头的 URL', '检查 URL 是否拼写正确'],
  },
  BLACKLISTED_HOST: {
    title: '主机名在黑名单中',
    description: '该主机名已被列入访问黑名单',
    solutions: ['请检查主机名是否正确', '联系管理员确认访问权限'],
  },
  PRIVATE_IP_RANGE: {
    title: '私有 IP 地址',
    description: '不允许访问私有 IP 地址范围',
    solutions: ['请使用公网 IP 或域名', '如需访问内网资源，请联系管理员'],
  },
  URL_PARSE_ERROR: {
    title: 'URL 解析错误',
    description: '无法解析该 URL',
    solutions: ['请检查 URL 格式是否正确', '确保 URL 包含协议和主机名'],
  },
};

// ============ IP 规范化 ============

/**
 * 将各种格式的 IP 地址规范化为标准 IPv4 格式
 * 支持：八进制、十六进制、十进制整数、混合格式
 */
export function normalizeIP(ipString: string): string | null {
  if (!ipString || typeof ipString !== 'string') {
    return null;
  }

  const trimmed = ipString.trim();

  // 如果已经是标准 IPv4 格式，直接验证返回
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
    return isValidIPv4(trimmed) ? trimmed : null;
  }

  // 尝试解析为十进制整数
  if (/^\d+$/.test(trimmed)) {
    return decimalToIPv4(BigInt(trimmed));
  }

  // 尝试解析带点分隔的混合格式（八进制/十六进制/十进制）
  if (trimmed.includes('.')) {
    return parseMixedIPFormat(trimmed);
  }

  // 尝试解析 IPv6
  if (trimmed.includes(':')) {
    return normalizeIPv6(trimmed);
  }

  return null;
}

/**
 * 验证 IPv4 地址是否有效
 */
function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  return parts.every(part => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
  });
}

/**
 * 将十进制整数转换为 IPv4 地址
 * 例如：2130706433 → 127.0.0.1
 */
function decimalToIPv4(decimal: bigint): string | null {
  try {
    const num = BigInt(decimal);
    // 检查是否在有效范围内 (0.0.0.0 到 255.255.255.255)
    if (num < 0n || num > 4294967295n) {
      return null;
    }

    const parts: number[] = [];
    let remaining = num;

    for (let i = 3; i >= 0; i--) {
      const divisor = BigInt(256) ** BigInt(i);
      const part = Number(remaining / divisor);
      parts.push(part);
      remaining = remaining % divisor;
    }

    return parts.join('.');
  } catch {
    return null;
  }
}

/**
 * 解析混合格式的 IP 地址
 * 支持：0177.0.0.1 (八进制), 0x7f.0.0.1 (十六进制), 混合使用
 */
function parseMixedIPFormat(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  const normalizedParts: number[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    let num: number;

    // 十六进制格式：0x7f 或 0X7F
    if (trimmed.toLowerCase().startsWith('0x')) {
      num = parseInt(trimmed, 16);
    }
    // 八进制格式：0177 (以 0 开头且不止一个数字)
    else if (trimmed.length > 1 && trimmed.startsWith('0')) {
      // 检查八进制有效性（数字只能包含 0-7）
      if (!/^[0-7]+$/.test(trimmed)) {
        return null; // 包含 8/9，无效八进制
      }
      num = parseInt(trimmed, 8);
    }
    // 十进制格式
    else {
      num = parseInt(trimmed, 10);
    }

    // 验证转换后的数字
    if (isNaN(num) || num < 0 || num > 255) {
      return null;
    }

    normalizedParts.push(num);
  }

  return normalizedParts.join('.');
}

/**
 * 展开压缩格式的 IPv6 地址
 * 处理 :: 压缩格式，返回完整的 8 段 IPv6 地址
 */
function expandIPv6(ip: string): string | null {
  // 去除方括号（如果存在）
  const cleanIp = ip.startsWith('[') && ip.endsWith(']')
    ? ip.slice(1, -1)
    : ip;

  // 验证清理后的 IP 只包含有效的 IPv6 字符
  if (!/^[0-9a-fA-F:]+$/.test(cleanIp)) {
    return null;
  }

  // 处理 :: 压缩格式
  if (cleanIp.includes('::')) {
    const [left, right] = cleanIp.split('::');
    const leftParts = left ? left.split(':') : [];
    const rightParts = right ? right.split(':') : [];
    const missing = 8 - leftParts.length - rightParts.length;
    const middle = Array(missing).fill('0');
    const parts = [...leftParts, ...middle, ...rightParts];
    return parts.map(p => p.padStart(4, '0')).join(':');
  }
  // 正常格式
  const parts = cleanIp.split(':');
  if (parts.length === 8) {
    return parts.map(p => p.padStart(4, '0')).join(':');
  }
  return null;
}

/**
 * 规范化 IPv6 地址（简化版）
 * 主要检测是否为有效的 IPv6 格式，返回原值或 null
 */
function normalizeIPv6(ip: string): string | null {
  // 去除方括号（如果存在）
  const cleanIp = ip.startsWith('[') && ip.endsWith(']')
    ? ip.slice(1, -1)
    : ip;

  // 基本的 IPv6 格式验证
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  if (ipv6Regex.test(cleanIp)) {
    return cleanIp.toLowerCase();
  }

  // 处理压缩格式（包含 ::）
  if (cleanIp.includes('::')) {
    const expanded = expandIPv6(cleanIp);
    if (expanded) {
      return expanded.toLowerCase();
    }
  }

  return null;
}

// ============ 私有 IP 检测 ============

/**
 * 检查 IPv4 地址是否为私有/内网地址
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;

  const [a, b, c, d] = parts;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local/APIPA)
  if (a === 169 && b === 254) return true;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved)
  if (a >= 240 && a <= 255) return true;

  // 255.255.255.255 (Broadcast)
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

/**
 * 检查 IPv6 地址是否为私有/内网地址
 */
function isPrivateIPv6(ip: string): boolean {
  const lowerIP = ip.toLowerCase();

  // ::1 (Loopback)
  if (lowerIP === '::1' || lowerIP === '0:0:0:0:0:0:0:1') return true;

  // :: (Unspecified)
  if (lowerIP === '::' || lowerIP === '0:0:0:0:0:0:0:0') return true;

  // fc00::/7 (Unique Local Address)
  if (lowerIP.startsWith('fc') || lowerIP.startsWith('fd')) return true;

  // fe80::/10 (Link-local)
  if (lowerIP.startsWith('fe8') || lowerIP.startsWith('fe9') ||
      lowerIP.startsWith('fea') || lowerIP.startsWith('feb')) return true;

  // ::ffff:127.0.0.0/104 (IPv4-mapped loopback)
  if (lowerIP.startsWith('::ffff:7f') || lowerIP.startsWith('0:0:0:0:0:ffff:7f')) return true;

  // ::ffff:10.0.0.0/104 (IPv4-mapped private)
  if (lowerIP.startsWith('::ffff:a') || lowerIP.startsWith('0:0:0:0:0:ffff:a')) return true;

  // ::ffff:192.168.0.0/112 (IPv4-mapped private)
  if (lowerIP.includes('ffff:c0a8') || lowerIP.includes('ffff:192.168')) return true;

  return false;
}

/**
 * 检查 IP 地址是否为私有/内网地址
 */
export function isPrivateIP(ip: string): boolean {
  const normalized = normalizeIP(ip);
  if (!normalized) return true; // 如果无法解析，视为私有以安全起见

  if (normalized.includes(':')) {
    return isPrivateIPv6(normalized);
  }

  return isPrivateIPv4(normalized);
}

// ============ 黑名单主机名 ============

// 默认黑名单主机名列表（小写）
const DEFAULT_BLACKLISTED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'loopback',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '::',
  '0000::1',
  '0000:0000:0000:0000:0000:0000:0000:0001',
]);

/**
 * 检查主机名是否在黑名单中
 */
function isBlacklistedHost(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase().trim();

  // 直接匹配黑名单
  if (DEFAULT_BLACKLISTED_HOSTS.has(lowerHostname)) {
    return true;
  }

  // 检查是否为纯 IP 地址且为私有地址
  const normalizedIP = normalizeIP(lowerHostname);
  if (normalizedIP && isPrivateIP(normalizedIP)) {
    return true;
  }

  // 检查是否是黑名单主机的子域名
  // 例如：localhost.example.com 应该被阻止
  for (const blocked of DEFAULT_BLACKLISTED_HOSTS) {
    // 跳过 IP 地址，因为已经在上面处理过了
    if (normalizeIP(blocked)) {
      continue;
    }
    // 检查子域名（确保 blocked 不是其他域名的子字符串）
    if (lowerHostname.endsWith(`.${blocked}`)) {
      return true;
    }
  }

  return false;
}

// ============ URL 验证 ============

/**
 * URL 验证结果
 */
export interface URLValidationResult {
  allowed: boolean;
  error?: keyof typeof SECURITY_ERROR_MESSAGES;
  details?: string;
}

/**
 * 验证 URL 是否允许访问（SSRF 防护）
 * @param urlString 要验证的 URL 字符串
 * @returns 是否允许访问
 */
export function isUrlAllowed(urlString: string): boolean {
  const result = validateUrl(urlString);
  return result.allowed;
}

/**
 * 详细验证 URL（返回详细信息）
 */
export function validateUrl(urlString: string): URLValidationResult {
  if (!urlString || typeof urlString !== 'string') {
    return {
      allowed: false,
      error: 'URL_PARSE_ERROR',
      details: 'URL 为空或格式无效',
    };
  }

  let url: URL;

  try {
    url = new URL(urlString);
  } catch {
    return {
      allowed: false,
      error: 'URL_PARSE_ERROR',
      details: '无法解析 URL 格式',
    };
  }

  // 检查协议
  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return {
      allowed: false,
      error: 'INVALID_PROTOCOL',
      details: `不支持的协议: ${protocol}`,
    };
  }

  // 获取主机名（去除端口）
  const hostname = url.hostname;

  if (!hostname) {
    return {
      allowed: false,
      error: 'URL_PARSE_ERROR',
      details: '无法提取主机名',
    };
  }

  const lowerHostname = hostname.toLowerCase();

  // 检查 IPv4-mapped IPv6 地址（如 ::ffff:127.0.0.1）
  if (lowerHostname.startsWith('::ffff:')) {
    const ipv4Part = lowerHostname.slice(7); // 移除 ::ffff:
    if (isPrivateIP(ipv4Part)) {
      return {
        allowed: false,
        error: 'PRIVATE_IP_RANGE',
        details: `IPv4-mapped IPv6 私有地址: ${hostname}`,
      };
    }
  }

  // 检查黑名单
  if (isBlacklistedHost(hostname)) {
    return {
      allowed: false,
      error: 'BLACKLISTED_HOST',
      details: `主机名在黑名单中: ${hostname}`,
    };
  }

  // 如果是 IP 地址，检查是否为私有地址
  const normalizedIP = normalizeIP(hostname);
  if (normalizedIP) {
    if (isPrivateIP(normalizedIP)) {
      return {
        allowed: false,
        error: 'PRIVATE_IP_RANGE',
        details: `私有 IP 地址: ${hostname}`,
      };
    }
  }

  // 注意：这里不进行 DNS 解析检查，因为：
  // 1. DNS 解析是异步操作，而我们需要同步返回结果
  // 2. 实际请求时会再次检查解析后的 IP
  // 3. 对于需要严格防护的场景，应结合代理层的检查

  return { allowed: true };
}

// ============ 请求头过滤 ============

// Hop-by-Hop 头（根据 RFC 2616）
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'proxy-connection',
]);

// 敏感请求头（不应由客户端发送）
const SENSITIVE_REQUEST_HEADERS = new Set([
  'cookie',
  'cookie2',
  'authorization',
  'www-authenticate',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-port',
  'x-forwarded-server',
  'x-real-ip',
  'x-remote-ip',
  'x-remote-addr',
  'x-originating-ip',
  'x-client-ip',
  'x-cluster-client-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'x-proxyuser-ip',
  'x-http-host-override',
  'forwarded',
  'via',
  'x-http-method-override',
  'x-http-method',
  'x-method-override',
]);

// 敏感响应头（不应传递给客户端）
const SENSITIVE_RESPONSE_HEADERS = new Set([
  'set-cookie',
  'set-cookie2',
  'www-authenticate',
  'proxy-authenticate',
  'x-internal-server',
  'x-backend-server',
  'x-powered-by',
  'server',
  'x-debug',
  'x-trace-id',
  'x-request-id',
  'x-correlation-id',
]);

/**
 * 过滤请求头
 * 移除 Hop-by-Hop 头和敏感头
 */
export function sanitizeRequestHeaders(
  headers: Record<string, string>
): Record<string, string> {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // 跳过 Hop-by-Hop 头
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) {
      continue;
    }

    // 跳过敏感请求头
    if (SENSITIVE_REQUEST_HEADERS.has(lowerKey)) {
      continue;
    }

    // 跳过以 x-forwarded- 开头的自定义头
    if (lowerKey.startsWith('x-forwarded-')) {
      continue;
    }

    // 跳过以 x-real- 开头的自定义头
    if (lowerKey.startsWith('x-real-')) {
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * 过滤响应头
 * 移除敏感响应头
 */
export function sanitizeResponseHeaders(
  headers: Record<string, string>
): Record<string, string> {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // 跳过 Hop-by-Hop 头
    if (HOP_BY_HOP_HEADERS.has(lowerKey)) {
      continue;
    }

    // 跳过敏感响应头
    if (SENSITIVE_RESPONSE_HEADERS.has(lowerKey)) {
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

// ============ 高级功能 ============

/**
 * 检查 URL 是否使用默认端口
 * 用于检测可能的端口混淆攻击
 */
export function isDefaultPort(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const protocol = url.protocol.toLowerCase();
    const port = url.port;

    if (protocol === 'http:' && (port === '' || port === '80')) {
      return true;
    }

    if (protocol === 'https:' && (port === '' || port === '443')) {
      return true;
    }

    return port === '';
  } catch {
    return false;
  }
}

/**
 * 提取 URL 中的主机信息
 */
export function extractHostInfo(urlString: string): {
  hostname: string;
  port: string;
  isIP: boolean;
  normalizedIP: string | null;
} | null {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    const normalizedIP = normalizeIP(hostname);

    return {
      hostname,
      port,
      isIP: normalizedIP !== null,
      normalizedIP,
    };
  } catch {
    return null;
  }
}

/**
 * 添加自定义黑名单主机名
 */
export function addToBlacklist(hostname: string): void {
  if (hostname && typeof hostname === 'string') {
    DEFAULT_BLACKLISTED_HOSTS.add(hostname.toLowerCase().trim());
  }
}

/**
 * 从黑名单中移除主机名
 */
export function removeFromBlacklist(hostname: string): void {
  if (hostname && typeof hostname === 'string') {
    DEFAULT_BLACKLISTED_HOSTS.delete(hostname.toLowerCase().trim());
  }
}

/**
 * 获取当前黑名单列表
 */
export function getBlacklist(): string[] {
  return Array.from(DEFAULT_BLACKLISTED_HOSTS);
}
