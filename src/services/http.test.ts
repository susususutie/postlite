import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendRequest, parseUrl, parseHeaders, resolveRequestUrl } from './http';
import type { HttpRequest, Header, Param, Collection } from '../types';
import * as proxyDetector from './proxyDetector';

// Mock proxyDetector
vi.mock('./proxyDetector', () => ({
  detectProxyAvailability: vi.fn(),
  clearProxyCache: vi.fn(),
  initNetworkStatusListener: vi.fn(),
}));

describe('HTTP Service', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.useFakeTimers();
    vi.clearAllMocks();
    // 重置 proxyDetector mock 的默认行为
    vi.mocked(proxyDetector.detectProxyAvailability).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    // 确保 global.fetch 在每次测试后被重置
    mockFetch.mockReset();
  });

  describe('parseUrl', () => {
    it('should return url without params', () => {
      const url = 'https://api.example.com/test';
      const result = parseUrl(url, []);
      expect(result).toBe(url);
    });

    it('should append query params to URL', () => {
      const url = 'https://api.example.com/test';
      const params: Param[] = [
        { key: 'page', value: '1', enabled: true },
        { key: 'limit', value: '10', enabled: true },
      ];
      const result = parseUrl(url, params);
      expect(result).toBe('https://api.example.com/test?page=1&limit=10');
    });

    it('should skip disabled params', () => {
      const url = 'https://api.example.com/test';
      const params: Param[] = [
        { key: 'page', value: '1', enabled: true },
        { key: 'limit', value: '10', enabled: false },
      ];
      const result = parseUrl(url, params);
      expect(result).toBe('https://api.example.com/test?page=1');
    });

    it('should skip empty key params', () => {
      const url = 'https://api.example.com/test';
      const params: Param[] = [
        { key: '', value: 'value', enabled: true },
        { key: 'valid', value: 'value', enabled: true },
      ];
      const result = parseUrl(url, params);
      expect(result).toBe('https://api.example.com/test?valid=value');
    });

    it('should handle URL with existing query params', () => {
      const url = 'https://api.example.com/test?existing=param';
      const params: Param[] = [
        { key: 'new', value: 'value', enabled: true },
      ];
      const result = parseUrl(url, params);
      expect(result).toBe('https://api.example.com/test?existing=param&new=value');
    });

    it('should handle special characters in params', () => {
      const url = 'https://api.example.com/test';
      const params: Param[] = [
        { key: 'search', value: 'hello world', enabled: true },
        { key: 'special', value: 'a&b=c', enabled: true },
      ];
      const result = parseUrl(url, params);
      expect(result).toContain('search=hello+world');
      expect(result).toContain('special=a%26b%3Dc');
    });

    it('should handle invalid URL gracefully', () => {
      const url = 'not-a-valid-url';
      const params: Param[] = [{ key: 'test', value: 'value', enabled: true }];
      expect(() => parseUrl(url, params)).toThrow();
    });
  });

  describe('parseHeaders', () => {
    it('should parse enabled headers', () => {
      const headers: Header[] = [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'Authorization', value: 'Bearer token', enabled: true },
      ];
      const result = parseHeaders(headers);
      expect(result).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
      });
    });

    it('should skip disabled headers', () => {
      const headers: Header[] = [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'X-Disabled', value: 'value', enabled: false },
      ];
      const result = parseHeaders(headers);
      expect(result).toEqual({
        'Content-Type': 'application/json',
      });
    });

    it('should skip empty key headers', () => {
      const headers: Header[] = [
        { key: '', value: 'value', enabled: true },
        { key: 'Valid', value: 'value', enabled: true },
      ];
      const result = parseHeaders(headers);
      expect(result).toEqual({
        'Valid': 'value',
      });
    });

    it('should handle empty headers array', () => {
      const result = parseHeaders([]);
      expect(result).toEqual({});
    });

    it('should handle headers with same key (last wins)', () => {
      const headers: Header[] = [
        { key: 'X-Custom', value: 'first', enabled: true },
        { key: 'X-Custom', value: 'second', enabled: true },
      ];
      const result = parseHeaders(headers);
      expect(result['X-Custom']).toBe('second');
    });
  });

  describe('sendRequest', () => {
    const mockRequest: HttpRequest = {
      id: 'req-1',
      name: 'Test Request',
      method: 'GET',
      url: 'https://api.example.com/test',
      headers: [],
      params: [],
    };

    it('should send direct request when proxy is unavailable', async () => {
      // Mock proxy unavailable
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['{"success":true}'])),
        json: vi.fn().mockResolvedValue({ success: true }),
        text: vi.fn().mockResolvedValue('{"success":true}'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendRequest(mockRequest);

      expect(result.status).toBe(200);
      expect(result.statusText).toBe('OK');
      expect(result.data).toEqual({ success: true });
      expect(result.time).toBeGreaterThanOrEqual(0);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should send request via proxy when proxy is available', async () => {
      // Mock proxy available
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(true);

      // Mock proxy response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          data: { success: true },
          size: 100,
          time: 50,
        }),
      });

      const result = await sendRequest(mockRequest);

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ success: true });
      // Verify proxy endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/proxy',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      );
    });

    it('should fallback to direct request when proxy fails', async () => {
      // Mock proxy available but fails
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(true);

      // First call (proxy) fails
      mockFetch.mockRejectedValueOnce(new Error('Proxy error'));

      // Second call (direct) succeeds
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['{"success":true}'])),
        json: vi.fn().mockResolvedValue({ success: true }),
        text: vi.fn().mockResolvedValue('{"success":true}'),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await sendRequest(mockRequest);

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should send POST request with body via proxy', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(true);

      const postRequest: HttpRequest = {
        ...mockRequest,
        method: 'POST',
        body: {
          mode: 'json',
          content: '{"name":"test"}',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 201,
          statusText: 'Created',
          headers: {},
          data: { id: 1 },
          size: 50,
          time: 30,
        }),
      });

      const result = await sendRequest(postRequest);

      expect(result.status).toBe(201);
      // Verify proxy was called with correct body
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.method).toBe('POST');
      expect(body.body).toBe('{"name":"test"}');
    });

    it('should block SSRF attacks via proxy', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(true);

      const maliciousRequest: HttpRequest = {
        ...mockRequest,
        url: 'http://127.0.0.1:3000/admin',
      };

      // 由于 http.ts 中的 sendViaProxy 会检查 isUrlAllowed
      // 且本地地址会被阻止，我们应该看到错误
      // 模拟代理响应返回 SSRF 错误
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({ error: 'URL not allowed: SSRF protection' }),
      });

      await expect(sendRequest(maliciousRequest)).rejects.toThrow();
    });

    it('should handle proxy error response', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(true);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: vi.fn().mockResolvedValue({ error: 'Target server unavailable' }),
      });

      // Fallback direct request also fails
      mockFetch.mockRejectedValueOnce(new Error('CORS error'));

      await expect(sendRequest(mockRequest)).rejects.toThrow();
    });

    it('should handle text response', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['Hello World'])),
        text: vi.fn().mockResolvedValue('Hello World'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendRequest(mockRequest);

      expect(result.data).toBe('Hello World');
    });

    it('should handle 404 error response', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);

      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['{"error":"Not found"}'])),
        json: vi.fn().mockResolvedValue({ error: 'Not found' }),
        text: vi.fn().mockResolvedValue('{"error":"Not found"}'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendRequest(mockRequest);

      expect(result.status).toBe(404);
      expect(result.statusText).toBe('Not Found');
    });

    it('should handle network error', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(sendRequest(mockRequest)).rejects.toThrow();
    });

    it('should handle request with query params', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);

      const requestWithParams: HttpRequest = {
        ...mockRequest,
        params: [
          { key: 'page', value: '1', enabled: true },
        ],
      };

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['{}'])),
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue('{}'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await sendRequest(requestWithParams);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test?page=1',
        expect.any(Object)
      );
    });

    it('should handle request with custom headers', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);

      const requestWithHeaders: HttpRequest = {
        ...mockRequest,
        headers: [
          { key: 'Authorization', value: 'Bearer token123', enabled: true },
          { key: 'X-Custom', value: 'value', enabled: true },
        ],
      };

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['{}'])),
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue('{}'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await sendRequest(requestWithHeaders);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
            'X-Custom': 'value',
          }),
        })
      );
    });

    it('should handle urlencoded body', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);

      const requestWithUrlEncoded: HttpRequest = {
        ...mockRequest,
        method: 'POST',
        body: {
          mode: 'urlencoded',
          content: 'name=test&value=123',
        },
      };

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['{}'])),
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue('{}'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await sendRequest(requestWithUrlEncoded);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: 'name=test&value=123',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should handle empty body mode', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);

      const requestWithNoneBody: HttpRequest = {
        ...mockRequest,
        method: 'GET',
        body: {
          mode: 'none',
          content: '',
        },
      };

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['{}'])),
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue('{}'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await sendRequest(requestWithNoneBody);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: undefined,
        })
      );
    });

    it('should handle malformed JSON response gracefully', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['invalid json'])),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
        text: vi.fn().mockResolvedValue('invalid json'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendRequest(mockRequest);

      expect(result.data).toBe('invalid json');
    });

    it('should calculate response size correctly', async () => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);

      const responseData = JSON.stringify({ key: 'value'.repeat(100) });
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob([responseData])),
        json: vi.fn().mockResolvedValue(JSON.parse(responseData)),
        text: vi.fn().mockResolvedValue(responseData),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendRequest(mockRequest);

      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('resolveRequestUrl', () => {
    const mockCollection: Collection = {
      id: 'col-1',
      name: 'Test Collection',
      defaultBaseUrl: 'https://default.example.com/api',
      folders: [],
      requests: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should resolve variables in URL using localVars', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: '{{baseUrl}}/users',
        headers: [],
        params: [],
      };

      const localVars = [
        { key: 'baseUrl', value: 'https://api.example.com', type: 'string' as const, enabled: true },
      ];

      const { url, unresolvedVars } = resolveRequestUrl(request, { localVars });
      expect(url).toBe('https://api.example.com/users');
      expect(unresolvedVars).toEqual([]);
    });

    it('should resolve multiple variables', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: '{{baseUrl}}/api/{{version}}/users',
        headers: [],
        params: [],
      };

      const localVars = [
        { key: 'baseUrl', value: 'https://api.example.com', type: 'string' as const, enabled: true },
        { key: 'version', value: 'v2', type: 'string' as const, enabled: true },
      ];

      const { url, unresolvedVars } = resolveRequestUrl(request, { localVars });
      expect(url).toBe('https://api.example.com/api/v2/users');
      expect(unresolvedVars).toEqual([]);
    });

    it('should report unresolved variables', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: '{{baseUrl}}/{{unknownVar}}/users',
        headers: [],
        params: [],
      };

      const localVars = [
        { key: 'baseUrl', value: 'https://api.example.com', type: 'string' as const, enabled: true },
      ];

      const { url, unresolvedVars } = resolveRequestUrl(request, { localVars });
      expect(url).toBe('https://api.example.com/{{unknownVar}}/users');
      expect(unresolvedVars).toContain('unknownVar');
    });

    it('should apply defaultBaseUrl when conditions met', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: 'users',  // No protocol, no template, not absolute path
        headers: [],
        params: [],
      };

      const { url } = resolveRequestUrl(request, { collection: mockCollection });
      expect(url).toBe('https://default.example.com/apiusers');  // Note: no trailing slash in base
    });

    it('should apply defaultBaseUrl with proper trailing slash', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: 'users',
        headers: [],
        params: [],
      };

      const collectionWithSlash: Collection = {
        ...mockCollection,
        defaultBaseUrl: 'https://default.example.com/api/',
      };

      const { url } = resolveRequestUrl(request, { collection: collectionWithSlash });
      expect(url).toBe('https://default.example.com/api/users');
    });

    it('should NOT apply defaultBaseUrl when URL has protocol', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: 'https://other.com/users',
        headers: [],
        params: [],
      };

      const { url } = resolveRequestUrl(request, { collection: mockCollection });
      expect(url).toBe('https://other.com/users');
    });

    it('should NOT apply defaultBaseUrl when URL has template variables', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: '{{baseUrl}}/users',
        headers: [],
        params: [],
      };

      const { url } = resolveRequestUrl(request, { collection: mockCollection });
      // Should NOT concatenate, but also won't resolve since no localVars provided
      expect(url).toBe('{{baseUrl}}/users');
    });

    it('should NOT apply defaultBaseUrl when URL is absolute path', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: '/api/users',
        headers: [],
        params: [],
      };

      const { url } = resolveRequestUrl(request, { collection: mockCollection });
      expect(url).toBe('/api/users');
    });

    it('should normalize double slashes in URL', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com//api//users',
        headers: [],
        params: [],
      };

      const { url } = resolveRequestUrl(request);
      expect(url).toBe('https://api.example.com/api/users');
    });

    it('should preserve query parameters during normalization', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com//api?foo=bar',
        headers: [],
        params: [],
      };

      const { url } = resolveRequestUrl(request);
      expect(url).toBe('https://api.example.com/api?foo=bar');
    });

    it('should handle localVars overriding envVars priority', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: '{{baseUrl}}/users',
        headers: [],
        params: [],
      };

      const localVars = [
        { key: 'baseUrl', value: 'https://local.example.com', type: 'string' as const, enabled: true },
      ];

      const { url } = resolveRequestUrl(request, { localVars });
      expect(url).toBe('https://local.example.com/users');
    });

    it('should skip disabled variables', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: '{{enabledVar}}/{{disabledVar}}',
        headers: [],
        params: [],
      };

      const localVars = [
        { key: 'enabledVar', value: 'active', type: 'string' as const, enabled: true },
        { key: 'disabledVar', value: 'inactive', type: 'string' as const, enabled: false },
      ];

      const { url, unresolvedVars } = resolveRequestUrl(request, { localVars });
      expect(url).toBe('active/{{disabledVar}}');
      expect(unresolvedVars).toContain('disabledVar');
    });
  });

  describe('sendRequest with variable resolution', () => {
    beforeEach(() => {
      vi.mocked(proxyDetector.detectProxyAvailability).mockResolvedValue(false);
    });

    it('should throw error for unresolved variables', async () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: '{{unknownVar}}/users',
        headers: [],
        params: [],
      };

      mockFetch.mockRejectedValue(new Error('Should not be called'));

      await expect(sendRequest(request)).rejects.toThrow(/Unresolved variables/);
    });

    it('should throw error for invalid URL after resolution', async () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: '   ',  // Only whitespace is invalid
        headers: [],
        params: [],
      };

      mockFetch.mockRejectedValue(new Error('Should not be called'));

      await expect(sendRequest(request)).rejects.toThrow(/Invalid URL/);
    });

    it('should successfully send request with valid URL', async () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        params: [],
      };

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['{}'])),
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue('{}'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendRequest(request);
      expect(result.status).toBe(200);
    });
  });
});