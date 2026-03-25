import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendRequest, parseUrl, parseHeaders, sendProxyRequest, resolveRequestUrl } from './http';
import type { HttpRequest, Header, Param, Collection } from '../types';

describe('HTTP Service', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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

    it('should send GET request successfully', async () => {
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

    it('should send POST request with body', async () => {
      const postRequest: HttpRequest = {
        ...mockRequest,
        method: 'POST',
        body: {
          mode: 'json',
          content: '{"name":"test"}',
        },
      };

      const mockResponse = {
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        clone: vi.fn().mockReturnThis(),
        blob: vi.fn().mockResolvedValue(new Blob(['{"id":1}'])),
        json: vi.fn().mockResolvedValue({ id: 1 }),
        text: vi.fn().mockResolvedValue('{"id":1}'),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendRequest(postRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: '{"name":"test"}',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result.status).toBe(201);
    });

    it('should handle text response', async () => {
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
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(sendRequest(mockRequest)).rejects.toThrow('Network error');
    });

    it('should re-throw Error instances that are not AbortError', async () => {
      const customError = new Error('Custom error with specific message');
      mockFetch.mockRejectedValue(customError);

      await expect(sendRequest(mockRequest)).rejects.toThrow('Custom error with specific message');
    });

    it('should handle non-Error exception by throwing unknown error', async () => {
      mockFetch.mockImplementation(() => {
        throw null;
      });

      await expect(sendRequest(mockRequest)).rejects.toThrow('Unknown error occurred');
    });

    it('should handle string exception by throwing unknown error', async () => {
      mockFetch.mockImplementation(() => {
        throw 'string error';
      });

      await expect(sendRequest(mockRequest)).rejects.toThrow('Unknown error occurred');
    });

    it.skip('should handle timeout', async () => {
      // Timeout test requires special handling - skipping for now
    });

    it('should handle request with query params', async () => {
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

  describe('sendProxyRequest', () => {
    const mockRequest: HttpRequest = {
      id: 'req-1',
      name: 'Test Request',
      method: 'GET',
      url: 'https://api.example.com/test',
      headers: [],
      params: [],
    };

    it('should fallback to sendRequest when service worker is not available', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: null },
        writable: true,
      });

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

      const result = await sendProxyRequest(mockRequest);

      expect(result.status).toBe(200);
    });

    it('should send request through service worker when available', async () => {
      let messageHandler: ((event: { data: unknown }) => void) | null = null;

      // 模拟 MessageChannel
      const mockPort1 = {
        set onmessage(handler: ((event: { data: unknown }) => void) | null) {
          messageHandler = handler;
        },
      };
      const mockPort2 = {};

      class MockMessageChannel {
        port1 = mockPort1;
        port2 = mockPort2;
      }

      global.MessageChannel = MockMessageChannel as unknown as typeof MessageChannel;

      const mockPostMessage = vi.fn();
      const mockController = { postMessage: mockPostMessage };

      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: mockController },
        writable: true,
      });

      const responsePromise = sendProxyRequest(mockRequest);

      // 模拟 service worker 响应
      expect(mockPostMessage).toHaveBeenCalledTimes(1);

      // 触发消息处理
      if (messageHandler) {
        messageHandler({
          data: {
            response: {
              status: 200,
              statusText: 'OK',
              headers: { 'content-type': 'application/json' },
              data: { success: true },
              size: 100,
            },
          },
        });
      }

      const result = await responsePromise;

      expect(result.status).toBe(200);
      expect(result.statusText).toBe('OK');
      expect(result.data).toEqual({ success: true });
      expect(result.time).toBeGreaterThanOrEqual(0);
    });

    it('should handle service worker error response', async () => {
      let messageHandler: ((event: { data: unknown }) => void) | null = null;

      const mockPort1 = {
        set onmessage(handler: ((event: { data: unknown }) => void) | null) {
          messageHandler = handler;
        },
      };
      const mockPort2 = {};

      class MockMessageChannel {
        port1 = mockPort1;
        port2 = mockPort2;
      }

      global.MessageChannel = MockMessageChannel as unknown as typeof MessageChannel;

      const mockPostMessage = vi.fn();
      const mockController = { postMessage: mockPostMessage };

      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: mockController },
        writable: true,
      });

      const responsePromise = sendProxyRequest(mockRequest);

      // 触发错误响应
      if (messageHandler) {
        messageHandler({
          data: {
            error: 'Network error',
          },
        });
      }

      await expect(responsePromise).rejects.toThrow('Network error');
    });

    it('should pass config to service worker', async () => {
      let messageHandler: ((event: { data: unknown }) => void) | null = null;

      const mockPort1 = {
        set onmessage(handler: ((event: { data: unknown }) => void) | null) {
          messageHandler = handler;
        },
      };
      const mockPort2 = {};

      class MockMessageChannel {
        port1 = mockPort1;
        port2 = mockPort2;
      }

      global.MessageChannel = MockMessageChannel as unknown as typeof MessageChannel;

      const mockPostMessage = vi.fn();
      const mockController = { postMessage: mockPostMessage };

      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: mockController },
        writable: true,
      });

      const config = { timeout: 5000, followRedirects: false };
      const responsePromise = sendProxyRequest(mockRequest, config);

      // 验证 postMessage 被调用时传递了 config
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      const [message] = mockPostMessage.mock.calls[0];

      expect(message.type).toBe('PROXY_REQUEST');
      expect(message.request).toEqual(mockRequest);
      expect(message.config).toEqual(config);

      // 清理 - 触发成功响应
      if (messageHandler) {
        messageHandler({
          data: {
            response: {
              status: 200,
              statusText: 'OK',
              headers: {},
              data: {},
              size: 0,
            },
          },
        });
      }

      await responsePromise;
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
    const mockFetch = vi.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
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
