import { describe, it, expect } from 'vitest';
import { swaggerAdapter } from './index';

describe('Swagger Adapter', () => {
  describe('name & supportedFormats', () => {
    it('should have correct name', () => {
      expect(swaggerAdapter.name).toBe('swagger');
    });

    it('should support swagger and openapi formats', () => {
      expect(swaggerAdapter.supportedFormats).toContain('swagger');
      expect(swaggerAdapter.supportedFormats).toContain('openapi');
    });
  });

  describe('detect', () => {
    it('should detect swagger 2.0', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {},
      };
      expect(swaggerAdapter.detect(data)).toBe(true);
    });

    it('should detect swagger 2.0 with string', () => {
      const data = { swagger: '2.0', info: { title: 'T', version: '1' }, paths: {} };
      expect(swaggerAdapter.detect(data)).toBe(true);
    });

    it('should detect OpenAPI 3.0', () => {
      const data = { openapi: '3.0.0', info: { title: 'Test', version: '1.0' }, paths: {} };
      expect(swaggerAdapter.detect(data)).toBe(true);
    });

    it('should detect OpenAPI 3.1', () => {
      const data = { openapi: '3.1.0', info: { title: 'Test', version: '1.0' }, paths: {} };
      expect(swaggerAdapter.detect(data)).toBe(true);
    });

    it('should not detect null', () => {
      expect(swaggerAdapter.detect(null)).toBe(false);
    });

    it('should not detect undefined', () => {
      expect(swaggerAdapter.detect(undefined)).toBe(false);
    });

    it('should not detect swagger 3.x as swagger', () => {
      const data = { swagger: '3.0', info: { title: 'Test', version: '1.0' }, paths: {} };
      expect(swaggerAdapter.detect(data)).toBe(false);
    });

    it('should not detect empty object', () => {
      expect(swaggerAdapter.detect({})).toBe(false);
    });

    it('should not detect postman format', () => {
      const data = {
        info: {
          name: 'Postman',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      };
      expect(swaggerAdapter.detect(data)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse basic swagger document', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'My API', version: '1.0.0', description: 'API description' },
        basePath: '/api',
        host: 'api.example.com',
        schemes: ['https'],
        paths: {},
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.name).toBe('My API');
      expect(ir.description).toBe('API description');
      expect(ir.items).toEqual([]);
    });

    it('should parse GET endpoint', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'API', version: '1.0' },
        basePath: '/api',
        host: 'api.example.com',
        paths: {
          '/users': {
            get: {
              summary: 'Get users',
              operationId: 'getUsers',
              parameters: [{ name: 'page', in: 'query', type: 'integer' }],
              responses: { '200': { description: 'Success' } },
            },
          },
        },
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items).toHaveLength(1);
      expect(ir.items[0]).toMatchObject({
        type: 'request',
        name: 'Get users',
        method: 'GET',
        url: expect.stringContaining('/users'),
      });
    });

    it('should parse POST endpoint', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'API', version: '1.0' },
        basePath: '/api',
        host: 'api.example.com',
        paths: {
          '/users': {
            post: {
              summary: 'Create user',
              responses: { '201': { description: 'Created' } },
            },
          },
        },
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].method).toBe('POST');
      expect(ir.items[0].url).toContain('/api/users');
    });

    it('should group by tags', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'API', version: '1.0' },
        basePath: '/',
        paths: {
          '/users': {
            get: { summary: 'Get users', tags: ['users'], responses: {} },
          },
          '/posts': {
            get: { summary: 'Get posts', tags: ['posts'], responses: {} },
          },
        },
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items).toHaveLength(2);
      expect(ir.items[0].type).toBe('folder');
      expect(ir.items[0].name).toBe('users');
      expect(ir.items[0].children).toHaveLength(1);
      expect(ir.items[1].name).toBe('posts');
    });

    it('should handle path parameters', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'API', version: '1.0' },
        basePath: '/api',
        host: 'api.example.com',
        paths: {
          '/users/{id}': {
            get: {
              summary: 'Get user',
              parameters: [{ name: 'id', in: 'path', required: true, type: 'string' }],
              responses: {},
            },
          },
        },
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].url).toContain('{{id}}');
    });

    it('should handle header parameters', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'API', version: '1.0' },
        basePath: '/',
        paths: {
          '/users': {
            get: {
              summary: 'Get users',
              parameters: [{ name: 'Authorization', in: 'header', required: true }],
              responses: {},
            },
          },
        },
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].headers).toContainEqual({ key: 'Authorization', value: '{{Authorization}}', enabled: true });
    });

    it('should parse all HTTP methods', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'API', version: '1.0' },
        basePath: '/',
        paths: {
          '/test': {
            get: { summary: 'Get', responses: {} },
            post: { summary: 'Post', responses: {} },
            put: { summary: 'Put', responses: {} },
            delete: { summary: 'Delete', responses: {} },
            patch: { summary: 'Patch', responses: {} },
            head: { summary: 'Head', responses: {} },
            options: { summary: 'Options', responses: {} },
          },
        },
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items).toHaveLength(7);
      const methods = ir.items.map(i => i.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('PATCH');
      expect(methods).toContain('HEAD');
      expect(methods).toContain('OPTIONS');
    });

    it('should handle missing info gracefully', () => {
      const data = { swagger: '2.0', paths: {} };
      const ir = swaggerAdapter.parse(data);
      expect(ir.name).toBe('Swagger Collection');
    });
  });

  describe('export', () => {
    it('should export basic collection', () => {
      const ir = { name: 'Exported', description: 'Test', items: [] };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.info.title).toBe('Exported');
      expect(parsed.info.description).toBe('Test');
      expect(parsed.paths).toEqual({});
    });

    it('should export request', () => {
      const ir = {
        name: 'API',
        items: [
          {
            id: '123',
            type: 'request' as const,
            name: 'Get Users',
            method: 'GET',
            url: 'https://api.example.com/users',
          },
        ],
      };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.paths['/users'].get.summary).toBe('Get Users');
    });

    it('should export with parameters', () => {
      const ir = {
        name: 'API',
        items: [
          {
            id: '123',
            type: 'request' as const,
            name: 'List',
            method: 'GET',
            url: 'https://api.example.com/users',
            params: [{ key: 'page', value: '1', enabled: true }],
            headers: [{ key: 'X-API-Key', value: 'secret', enabled: true }],
          },
        ],
      };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.paths['/users'].get.parameters).toContainEqual({ name: 'page', in: 'query', type: 'string' });
      expect(parsed.paths['/users'].get.parameters).toContainEqual({ name: 'X-API-Key', in: 'header', type: 'string' });
    });

    it('should export folder as tag', () => {
      const ir = {
        name: 'API',
        items: [
          {
            id: '123',
            type: 'folder' as const,
            name: 'Users',
            children: [
              { id: '124', type: 'request' as const, name: 'List', method: 'GET', url: 'https://api.example.com/users' },
            ],
          },
        ],
      };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.paths['/users'].get.tags).toContain('Users');
    });
  });

describe('full flow', () => {
  it('should round-trip swagger document', () => {
    const original = {
      swagger: '2.0',
      info: { title: 'Users API', version: '1.0.0', description: 'User management' },
      basePath: '/api',
      host: 'api.example.com',
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            parameters: [{ name: 'page', in: 'query', type: 'integer' }],
            responses: { '200': { description: 'Success' } },
          },
          post: {
            summary: 'Create user',
            responses: { '201': { description: 'Created' } },
          },
        },
      },
    };

    const ir = swaggerAdapter.parse(original);
    expect(ir.name).toBe('Users API');
    expect(ir.items).toHaveLength(2);
  });
});

describe('Swagger Adapter boundary cases', () => {
  describe('detect boundary', () => {
    it('should not detect empty object', () => {
      expect(swaggerAdapter.detect({})).toBe(false);
    });

    it('should not detect object with only info', () => {
      expect(swaggerAdapter.detect({ info: { title: 'Test', version: '1.0' } })).toBe(false);
    });

    it('should not detect swagger 1.x', () => {
      expect(swaggerAdapter.detect({ swagger: '1.0', info: { title: 'Test', version: '1.0' }, paths: {} })).toBe(false);
      expect(swaggerAdapter.detect({ swagger: '1.2', info: { title: 'Test', version: '1.0' }, paths: {} })).toBe(false);
    });

    it('should not detect swagger as number', () => {
      expect(swaggerAdapter.detect({ swagger: 2, info: { title: 'Test', version: '1.0' }, paths: {} })).toBe(false);
    });

    it('should not detect swagger as null', () => {
      expect(swaggerAdapter.detect({ swagger: null, info: { title: 'Test', version: '1.0' }, paths: {} })).toBe(false);
    });

    it('should not detect openapi as empty string', () => {
      expect(swaggerAdapter.detect({ openapi: '', info: { title: 'Test', version: '1.0' }, paths: {} })).toBe(false);
    });

    it('should detect swagger 2.0.0 exactly', () => {
      expect(swaggerAdapter.detect({ swagger: '2.0.0', info: { title: 'Test', version: '1.0' }, paths: {} })).toBe(true);
    });

    it('should not detect with only paths', () => {
      expect(swaggerAdapter.detect({ paths: {} })).toBe(false);
    });
  });

  describe('parse boundary', () => {
    it('should handle empty swagger document', () => {
      const data = { swagger: '2.0', info: { title: 'Test', version: '1.0' }, paths: {} };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items).toHaveLength(0);
    });

    it('should handle missing paths', () => {
      const data = { swagger: '2.0', info: { title: 'Test', version: '1.0' } };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items).toHaveLength(0);
    });

    it('should handle path without operation', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: { '/users': {} }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items).toHaveLength(0);
    });

    it('should handle path with parameters only', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/users': {
            parameters: [{ name: 'version', in: 'header', type: 'string' }]
          }
        }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items).toHaveLength(0);
    });

    it('should handle invalid method', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/test': {
            custom: { summary: 'Custom method' }
          }
        }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items).toHaveLength(0);
    });

    it('should handle missing parameters', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/users': {
            get: { summary: 'Get users', responses: {} }
          }
        }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].params).toEqual([]);
    });

    it('should handle parameters in body', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/users': {
            post: {
              summary: 'Create user',
              parameters: [{ name: 'body', in: 'body', schema: { type: 'object' } }],
              responses: {}
            }
          }
        }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].params).toEqual([]);
      expect(ir.items[0].headers).toEqual([]);
    });

    it('should handle parameters in formData', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/upload': {
            post: {
              summary: 'Upload',
              parameters: [{ name: 'file', in: 'formData', type: 'file' }],
              responses: {}
            }
          }
        }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].params).toEqual([]);
    });

    it('should handle missing responses', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/users': {
            get: { summary: 'Get users' }
          }
        }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0]).toBeDefined();
    });

    it('should handle empty responses', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/users': {
            get: { summary: 'Get users', responses: {} }
          }
        }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0]).toBeDefined();
    });

    it('should handle various swagger 2.x versions', () => {
      ['2.0', '2.0.0', '2.0.1', '2.1'].forEach(version => {
        const data = { swagger: version, info: { title: 'Test', version: '1.0' }, paths: {} };
        expect(swaggerAdapter.detect(data)).toBe(true);
      });
    });

    it('should handle openapi 3.0.x versions', () => {
      ['3.0.0', '3.0.1', '3.0.2', '3.0'].forEach(version => {
        const data = { openapi: version, info: { title: 'Test', version: '1.0' }, paths: {} };
        expect(swaggerAdapter.detect(data)).toBe(true);
      });
    });

    it('should handle openapi 3.1.x versions', () => {
      ['3.1.0', '3.1'].forEach(version => {
        const data = { openapi: version, info: { title: 'Test', version: '1.0' }, paths: {} };
        expect(swaggerAdapter.detect(data)).toBe(true);
      });
    });

    it('should handle basePath without host', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        basePath: '/api',
        paths: { '/users': { get: { summary: 'Get', responses: {} } } }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].url).toBe('/api/users');
    });

    it('should handle host without basePath', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        host: 'api.example.com',
        schemes: ['https'],
        paths: { '/users': { get: { summary: 'Get', responses: {} } } }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].url).toBe('https://api.example.com/users');
    });

    it('should handle both basePath and host', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        basePath: '/api/v1',
        host: 'api.example.com',
        schemes: ['http', 'https'],
        paths: { '/users': { get: { summary: 'Get', responses: {} } } }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].url).toBe('http://api.example.com/api/v1/users');
    });

    it('should handle empty host and basePath', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        basePath: '',
        host: '',
        paths: { '/users': { get: { summary: 'Get', responses: {} } } }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].url).toBe('/users');
    });

    it('should handle many operations in one path', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/crud': Array.from({ length: 10 }, (_, i) => ({ [`method${i}`]: { summary: `Method ${i}`, responses: {} } }))
        }
      };
      // This is just to test that it doesn't crash
      expect(() => swaggerAdapter.parse(data)).not.toThrow();
    });

    it('should handle operation with only description', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/test': {
            get: { description: 'Just a description', responses: {} }
          }
        }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].name).toBe('GET /test');
    });

    it('should handle operation without summary and description', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/test': {
            get: { responses: { '200': { description: 'OK' } } }
          }
        }
      };
      const ir = swaggerAdapter.parse(data);
      expect(ir.items[0].name).toBe('GET /test');
    });
  });

  describe('export boundary', () => {
    it('should export with only name', () => {
      const ir = { name: 'Test', items: [] };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.info.title).toBe('Test');
      expect(parsed.info.version).toBe('1.0.0');
    });

    it('should export request without method', () => {
      const ir = {
        name: 'Test',
        items: [{ id: '1', type: 'request' as const, name: 'Test', url: 'https://api.example.com' }]
      };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.paths['/'].get).toBeDefined();
    });

    it('should export request without url', () => {
      const ir = {
        name: 'Test',
        items: [{ id: '1', type: 'request' as const, name: 'Test' }]
      };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.paths).toEqual({});
    });

    it('should export folder without children', () => {
      const ir = {
        name: 'Test',
        items: [{ id: '1', type: 'folder' as const, name: 'Empty', children: [] }]
      };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.paths).toEqual({});
    });

    it('should export with disabled params', () => {
      const ir = {
        name: 'Test',
        items: [{
          id: '1',
          type: 'request' as const,
          name: 'Test',
          method: 'GET',
          url: 'https://api.example.com',
          params: [{ key: 'page', value: '1', enabled: false }]
        }]
      };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.paths['/'].get.parameters).toEqual([]);
    });

    it('should export with disabled headers', () => {
      const ir = {
        name: 'Test',
        items: [{
          id: '1',
          type: 'request' as const,
          name: 'Test',
          method: 'GET',
          url: 'https://api.example.com',
          headers: [{ key: 'X-API-Key', value: 'secret', enabled: false }]
        }]
      };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.paths['/'].get.parameters).toEqual([]);
    });

    it('should handle invalid URL for export', () => {
      const ir = {
        name: 'Test',
        items: [{
          id: '1',
          type: 'request' as const,
          name: 'Test',
          method: 'GET',
          url: 'not-a-valid-url'
        }]
      };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.paths).toEqual({});
    });

    it('should export with many params', () => {
      const params = Array.from({ length: 20 }, (_, i) => ({ key: `param${i}`, value: `value${i}`, enabled: true }));
      const ir = {
        name: 'Test',
        items: [{
          id: '1',
          type: 'request' as const,
          name: 'Test',
          method: 'GET',
          url: 'https://api.example.com',
          params
        }]
      };
      const result = swaggerAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.paths['/'].get.parameters).toHaveLength(20);
    });
  });
});
});
