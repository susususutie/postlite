// URL normalization utilities

/**
 * Check if URL has a protocol (including protocol-relative URLs starting with //)
 * Supports standard URI schemes (http, https, ws, ftp, etc.)
 */
export function hasProtocol(url: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url) || url.startsWith('//');
}

/**
 * Check if URL is protocol-relative (starts with // but has no protocol)
 */
export function isProtocolRelative(url: string): boolean {
  return url.startsWith('//') && !url.match(/^\/\/[a-zA-Z][a-zA-Z\d+\-.]*:/);
}

/**
 * Normalize URL by fixing double slashes without hurting query params
 * Only normalizes pathname, preserves query string and hash
 */
export function normalizeUrl(url: string): string {
  // Handle empty string
  if (!url) {
    return url;
  }

  try {
    // Check if it's a protocol-relative URL (starts with // but not protocol://)
    const protocolRelative = isProtocolRelative(url);

    let urlObj: URL;

    // For protocol-relative URLs or URLs without standard protocol, use dummy base
    if (protocolRelative || !hasProtocol(url)) {
      urlObj = new URL(url, 'http://dummy');
    } else {
      urlObj = new URL(url);
    }

    // Only normalize pathname: https://api.com//v1//users -> https://api.com/v1/users
    urlObj.pathname = urlObj.pathname.replace(/\/+/g, '/');

    // For protocol-relative URLs, manually construct the result
    if (protocolRelative) {
      return '//' + urlObj.host + urlObj.pathname + urlObj.search + urlObj.hash;
    }

    // If using dummy base (no protocol), return pathname + search + hash only
    if (!hasProtocol(url)) {
      return urlObj.pathname + urlObj.search + urlObj.hash;
    }

    return urlObj.toString();
  } catch {
    // Return original URL if parsing fails - let validation layer handle errors
    return url;
  }
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if URL is an absolute path (starts with /)
 */
export function isAbsolutePath(url: string): boolean {
  return url.startsWith('/');
}

/**
 * Weakly concatenate baseUrl with requestUrl
 * Only concatenates when:
 * 1. No protocol in requestUrl
 * 2. No template variables in requestUrl
 * 3. Not an absolute path (not starts with /)
 * 4. baseUrl exists
 */
export function weakConcatenateBaseUrl(
  requestUrl: string,
  baseUrl?: string
): string {
  if (!baseUrl) {
    return requestUrl;
  }

  // Only concatenate when all conditions are met
  if (
    hasProtocol(requestUrl) ||
    requestUrl.includes('{{') ||
    isAbsolutePath(requestUrl)
  ) {
    return requestUrl;
  }

  return `${baseUrl}${requestUrl}`;
}
