import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendRequest, parseUrl, parseHeaders, sendProxyRequest } from './http';
import type { HttpRequest, Header, Param } from '../types';

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
  });
});
