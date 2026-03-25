import { describe, it, expect } from 'vitest';
import { postmanAdapter } from './index';

describe('Postman Adapter', () => {
  describe('name & supportedFormats', () => {
    it('should have correct name', () => {
      expect(postmanAdapter.name).toBe('postman');
    });

    it('should support postman format', () => {
      expect(postmanAdapter.supportedFormats).toContain('postman');
    });
  });

  describe('detect', () => {
    it('should detect valid postman collection v2.1', () => {
      const data = {
        info: {
          _postman_id: '123',
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      };
      expect(postmanAdapter.detect(data)).toBe(true);
    });

    it('should detect valid postman collection v2.0', () => {
      const data = {
        info: {
          _postman_id: '123',
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json',
        },
        item: [],
      };
      expect(postmanAdapter.detect(data)).toBe(true);
    });

    it('should not detect swagger format', () => {
      const data = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0' },
        paths: {},
      };
      expect(postmanAdapter.detect(data)).toBe(false);
    });

    it('should not detect null', () => {
      expect(postmanAdapter.detect(null)).toBe(false);
    });

    it('should not detect undefined', () => {
      expect(postmanAdapter.detect(undefined)).toBe(false);
    });

    it('should not detect object without info.schema', () => {
      expect(postmanAdapter.detect({ info: {} })).toBe(false);
    });

    it('should not detect object with wrong schema', () => {
      const data = {
        info: {
          name: 'Test',
          schema: 'https://openapi.com/schema',
        },
      };
      expect(postmanAdapter.detect(data)).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse basic collection', () => {
      const data = {
        info: {
          _postman_id: '123',
          name: 'My Collection',
          description: 'Test description',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.name).toBe('My Collection');
      expect(ir.description).toBe('Test description');
      expect(ir.items).toEqual([]);
    });

    it('should parse collection with GET request', () => {
      const data = {
        info: {
          name: 'API',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Get Users',
            request: {
              method: 'GET',
              header: [],
              url: { raw: 'https://api.example.com/users' },
            },
          },
        ],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items).toHaveLength(1);
      expect(ir.items[0]).toMatchObject({
        type: 'request',
        name: 'Get Users',
        method: 'GET',
        url: 'https://api.example.com/users',
      });
    });

    it('should parse POST request with body', () => {
      const data = {
        info: { name: 'API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [
          {
            name: 'Create User',
            request: {
              method: 'POST',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              url: { raw: 'https://api.example.com/users' },
              body: { mode: 'raw', raw: '{"name":"John"}' },
            },
          },
        ],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0]).toMatchObject({
        type: 'request',
        method: 'POST',
        body: { mode: 'json', content: '{"name":"John"}' },
      });
    });

    it('should parse folder with nested requests', () => {
      const data = {
        info: { name: 'API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [
          {
            name: 'Users',
            item: [
              {
                name: 'List',
                request: { method: 'GET', header: [], url: { raw: 'https://api.example.com/users' } },
              },
              {
                name: 'Create',
                request: { method: 'POST', header: [], url: { raw: 'https://api.example.com/users' } },
              },
            ],
          },
        ],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items).toHaveLength(1);
      expect(ir.items[0].type).toBe('folder');
      expect(ir.items[0].name).toBe('Users');
      expect(ir.items[0].children).toHaveLength(2);
    });

    it('should parse url-encoded body', () => {
      const data = {
        info: { name: 'API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [
          {
            name: 'Login',
            request: {
              method: 'POST',
              header: [],
              url: { raw: 'https://api.example.com/login' },
              body: { mode: 'urlencoded', urlencoded: [{ key: 'username', value: 'admin' }, { key: 'password', value: 'secret' }] },
            },
          },
        ],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].body).toMatchObject({
        mode: 'urlencoded',
        content: 'username=admin&password=secret',
      });
    });

    it('should handle missing info gracefully', () => {
      const data = { item: [] };
      const ir = postmanAdapter.parse(data);
      expect(ir.name).toBe('Untitled Collection');
    });

    it('should handle string URL', () => {
      const data = {
        info: { name: 'API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [
          {
            name: 'Test',
            request: { method: 'GET', header: [], url: 'https://api.example.com/test' },
          },
        ],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].url).toBe('https://api.example.com/test');
    });
  });

  describe('export', () => {
    it('should export basic collection', () => {
      const ir = { name: 'Exported', description: 'Test', items: [] };
      const result = postmanAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.info.name).toBe('Exported');
      expect(parsed.info.description).toBe('Test');
      expect(parsed.item).toEqual([]);
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
      const result = postmanAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.item).toHaveLength(1);
      expect(parsed.item[0].name).toBe('Get Users');
      expect(parsed.item[0].request.method).toBe('GET');
    });

    it('should export folder', () => {
      const ir = {
        name: 'API',
        items: [
          {
            id: '123',
            type: 'folder' as const,
            name: 'Users',
            children: [{ id: '124', type: 'request' as const, name: 'List', method: 'GET', url: 'https://api.example.com/users' }],
          },
        ],
      };
      const result = postmanAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.item[0].name).toBe('Users');
      expect(parsed.item[0].item).toHaveLength(1);
    });

    it('should export POST request with body', () => {
      const ir = {
        name: 'API',
        items: [
          {
            id: '123',
            type: 'request' as const,
            name: 'Create User',
            method: 'POST',
            url: 'https://api.example.com/users',
            body: { mode: 'json', content: '{"name":"John"}' },
          },
        ],
      };
      const result = postmanAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.item[0].request.body.mode).toBe('raw');
      expect(parsed.item[0].request.body.raw).toBe('{"name":"John"}');
    });
  });

describe('full flow', () => {
  it('should round-trip collection', () => {
    const original = {
      info: {
        _postman_id: '123',
        name: 'Original',
        description: 'Original desc',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        {
          name: 'Users',
          item: [
            {
              name: 'Get All',
              request: {
                method: 'GET',
                header: [{ key: 'Authorization', value: 'Bearer token' }],
                url: { raw: 'https://api.example.com/users?page=1' },
              },
            },
          ],
        },
      ],
    };

    const ir = postmanAdapter.parse(original);
    expect(ir.name).toBe('Original');
    expect(ir.items[0].type).toBe('folder');
    expect(ir.items[0].children![0].method).toBe('GET');
  });
});

describe('Postman Adapter boundary cases', () => {
  describe('detect boundary', () => {
    it('should not detect empty object', () => {
      expect(postmanAdapter.detect({})).toBe(false);
    });

    it('should not detect object with empty info', () => {
      expect(postmanAdapter.detect({ info: {} })).toBe(false);
    });

    it('should not detect object with info but no schema', () => {
      expect(postmanAdapter.detect({ info: { name: 'Test' } })).toBe(false);
    });

    it('should not detect object with null info', () => {
      expect(postmanAdapter.detect({ info: null })).toBe(false);
    });

    it('should not detect object with undefined info', () => {
      expect(postmanAdapter.detect({ info: undefined })).toBe(false);
    });

    it('should not detect number', () => {
      expect(postmanAdapter.detect(123)).toBe(false);
    });

    it('should not detect string', () => {
      expect(postmanAdapter.detect('not a postman collection')).toBe(false);
    });

    it('should not detect array', () => {
      expect(postmanAdapter.detect([])).toBe(false);
    });

    it('should not detect boolean', () => {
      expect(postmanAdapter.detect(true)).toBe(false);
    });
  });

  describe('parse boundary', () => {
    it('should handle empty collection', () => {
      const data = {
        info: { name: 'Empty', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items).toHaveLength(0);
    });

    it('should handle missing info field', () => {
      const data = { item: [] };
      const ir = postmanAdapter.parse(data);
      expect(ir.name).toBe('Untitled Collection');
    });

    it('should handle missing item array', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items).toHaveLength(0);
    });

    it('should handle item with empty request', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Empty Request', request: null }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].type).toBe('folder');
    });

    it('should handle item with undefined request', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Empty Request', request: undefined }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].type).toBe('folder');
    });

    it('should handle empty url', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Test', request: { method: 'GET', header: [], url: { raw: '' } } }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].url).toBe('');
    });

    it('should handle missing url object', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Test', request: { method: 'GET', header: [], url: { raw: undefined } } }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].url).toBeUndefined();
    });

    it('should handle deeply nested folders', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{
          name: 'Level 1',
          item: [{
            name: 'Level 2',
            item: [{
              name: 'Level 3',
              request: { method: 'GET', header: [], url: { raw: 'https://api.example.com' } }
            }]
          }]
        }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].type).toBe('folder');
      expect(ir.items[0].children![0].type).toBe('folder');
      expect(ir.items[0].children![0].children![0].type).toBe('request');
      expect(ir.items[0].children![0].children![0]).toMatchObject({
        type: 'request',
        method: 'GET'
      });
    });

    it('should handle invalid method', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Test', request: { method: 'INVALID', header: [], url: { raw: 'https://api.example.com' } } }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].method).toBe('INVALID');
    });

    it('should handle missing method', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Test', request: { header: [], url: { raw: 'https://api.example.com' } } }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].method).toBeUndefined();
    });

    it('should handle deeply nested folders', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{
          name: 'Level 1',
          item: [{
            name: 'Level 2',
            item: [{
              name: 'Level 3',
              item: [{
                name: 'Level 4',
                item: [{
                  name: 'Level 5',
                  request: { method: 'GET', header: [], url: { raw: 'https://api.example.com' } }
                }]
              }]
            }]
          }]
        }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].type).toBe('folder');
      expect(ir.items[0].children![0].type).toBe('folder');
      expect(ir.items[0].children![0].children![0].type).toBe('folder');
      expect(ir.items[0].children![0].children![0].children![0].type).toBe('folder');
      expect(ir.items[0].children![0].children![0].children![0].children![0].type).toBe('request');
    });

    it('should handle many requests (50+)', () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        name: `Request ${i}`,
        request: {
          method: i % 2 === 0 ? 'GET' : 'POST',
          header: [],
          url: { raw: `https://api.example.com/${i}` }
        }
      }));
      const data = {
        info: { name: 'Large Collection', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: items,
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items).toHaveLength(50);
    });

    it('should handle folder with no nested items', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Empty Folder' }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].type).toBe('folder');
      expect(ir.items[0].children).toHaveLength(0);
    });

    it('should handle missing header array', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Test', request: { method: 'GET', url: { raw: 'https://api.example.com' } } }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].headers).toEqual([]);
    });

    it('should handle null header array', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Test', request: { method: 'GET', header: null, url: { raw: 'https://api.example.com' } } }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].headers).toEqual([]);
    });

    it('should handle undefined header', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Test', request: { method: 'GET', url: { raw: 'https://api.example.com' }, body: undefined } }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].body).toBeUndefined();
    });

    it('should handle formdata body mode', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{
          name: 'Upload',
          request: {
            method: 'POST',
            header: [],
            url: { raw: 'https://api.example.com/upload' },
            body: { mode: 'formdata', formdata: [{ key: 'file', value: 'test.txt', type: 'file' }] }
          }
        }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].body?.mode).toBe('formdata');
    });

    it('should handle request with special characters in name', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Request <>&"\'{}[]', request: { method: 'GET', header: [], url: { raw: 'https://api.example.com' } } }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].name).toBe('Request <>&"\'{}[]');
    });
  });

  describe('export boundary', () => {
    it('should export empty items', () => {
      const ir = { name: 'Empty', items: [] };
      const result = postmanAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.item).toEqual([]);
    });

    it('should export folder without children', () => {
      const ir = { name: 'Test', items: [{ id: '1', type: 'folder' as const, name: 'Empty Folder', children: [] }] };
      const result = postmanAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.item[0].item).toEqual([]);
    });

    it('should export request without body', () => {
      const ir = {
        name: 'Test',
        items: [{ id: '1', type: 'request' as const, name: 'No Body', method: 'GET', url: 'https://api.example.com' }]
      };
      const result = postmanAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.item[0].request.body).toBeUndefined();
    });

    it('should export request without headers', () => {
      const ir = {
        name: 'Test',
        items: [{ id: '1', type: 'request' as const, name: 'No Headers', method: 'POST', url: 'https://api.example.com' }]
      };
      const result = postmanAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.item[0].request.header).toEqual([]);
    });

    it('should export urlencoded body with special chars', () => {
      const ir = {
        name: 'Test',
        items: [{
          id: '1',
          type: 'request' as const,
          name: 'Special',
          method: 'POST',
          url: 'https://api.example.com',
          body: { mode: 'urlencoded', content: 'key=value&special=%26%3D' }
        }]
      };
      const result = postmanAdapter.export(ir);
      const parsed = JSON.parse(result);
      expect(parsed.item[0].request.body.mode).toBe('urlencoded');
    });
  });

  describe('parse URL edge cases', () => {
    it('should handle malformed URL', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{ name: 'Test', request: { method: 'GET', header: [], url: { raw: 'not-a-valid-url' } } }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].url).toBe('not-a-valid-url');
    });

    it('should handle URL with query params', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{
          name: 'Test',
          request: {
            method: 'GET',
            header: [],
            url: { raw: 'https://api.example.com?a=1&b=2', query: [{ key: 'a', value: '1' }, { key: 'b', value: '2' }] }
          }
        }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].params).toHaveLength(2);
    });

    it('should handle URL with port', () => {
      const data = {
        info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: [{
          name: 'Test',
          request: {
            method: 'GET',
            header: [],
            url: { raw: 'https://api.example.com:8080/path', protocol: 'https', host: ['example', 'com'], port: '8080', path: ['path'] }
          }
        }],
      };
      const ir = postmanAdapter.parse(data);
      expect(ir.items[0].url).toBe('https://api.example.com:8080/path');
    });
  });
});
});
