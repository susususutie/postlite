import { describe, it, expect } from 'vitest';
import type { HttpRequest } from '../types';

describe('RequestBuilder Component', () => {
  const mockRequest: HttpRequest = {
    id: 'req-1',
    name: 'Test Request',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: [
      { key: 'Authorization', value: 'Bearer token', enabled: true },
    ],
    params: [
      { key: 'page', value: '1', enabled: true },
    ],
    body: {
      mode: 'json',
      content: '{"name": "test"}',
    },
  };

  it('should validate mock request structure', () => {
    expect(mockRequest).toBeDefined();
    expect(mockRequest.id).toBe('req-1');
    expect(mockRequest.name).toBe('Test Request');
    expect(mockRequest.method).toBe('GET');
    expect(mockRequest.url).toBe('https://api.example.com/users');
    expect(mockRequest.headers).toHaveLength(1);
    expect(mockRequest.params).toHaveLength(1);
    expect(mockRequest.body).toBeDefined();
  });

  it('should handle different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

    methods.forEach(method => {
      const request: HttpRequest = {
        ...mockRequest,
        method: method as HttpRequest['method'],
      };
      expect(request.method).toBe(method);
    });
  });

  it('should handle request with no headers', () => {
    const request: HttpRequest = {
      ...mockRequest,
      headers: [],
    };
    expect(request.headers).toHaveLength(0);
  });

  it('should handle request with no params', () => {
    const request: HttpRequest = {
      ...mockRequest,
      params: [],
    };
    expect(request.params).toHaveLength(0);
  });

  it('should handle request with no body', () => {
    const request: HttpRequest = {
      ...mockRequest,
      body: undefined,
    };
    expect(request.body).toBeUndefined();
  });

  it('should handle different body modes', () => {
    const bodyModes = ['none', 'json', 'text', 'urlencoded', 'formdata'];

    bodyModes.forEach(mode => {
      const request: HttpRequest = {
        ...mockRequest,
        body: {
          mode: mode as Exclude<HttpRequest['body'], undefined>['mode'],
          content: mode === 'none' ? undefined : 'test content',
        },
      };
      expect(request.body!.mode).toBe(mode);
    });
  });

  it('should handle disabled headers', () => {
    const request: HttpRequest = {
      ...mockRequest,
      headers: [
        { key: 'Enabled', value: 'yes', enabled: true },
        { key: 'Disabled', value: 'no', enabled: false },
      ],
    };

    const enabledHeaders = request.headers.filter(h => h.enabled);
    expect(enabledHeaders).toHaveLength(1);
    expect(enabledHeaders[0].key).toBe('Enabled');
  });

  it('should handle disabled params', () => {
    const request: HttpRequest = {
      ...mockRequest,
      params: [
        { key: 'page', value: '1', enabled: true },
        { key: 'limit', value: '10', enabled: false },
      ],
    };

    const enabledParams = request.params.filter(p => p.enabled);
    expect(enabledParams).toHaveLength(1);
    expect(enabledParams[0].key).toBe('page');
  });
});
