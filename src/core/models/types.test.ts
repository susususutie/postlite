import { describe, it, expect } from 'vitest';
import type { StorageCollection, StorageItem, HttpMethod, BodyMode, KeyValue, BodyContent } from './types';

describe('StorageCollection', () => {
  it('should have correct structure', () => {
    const collection: StorageCollection = {
      id: 'col-1',
      name: 'Test Collection',
      description: 'A test collection',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(collection.id).toBe('col-1');
    expect(collection.name).toBe('Test Collection');
    expect(collection.description).toBe('A test collection');
    expect(typeof collection.createdAt).toBe('number');
    expect(typeof collection.updatedAt).toBe('number');
  });

  it('should allow optional description', () => {
    const collection: StorageCollection = {
      id: 'col-1',
      name: 'Test Collection',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(collection.description).toBeUndefined();
  });

  describe('StorageCollection boundary tests', () => {
    it('should handle empty name', () => {
      const collection: StorageCollection = {
        id: 'col-1',
        name: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(collection.name).toBe('');
    });

    it('should handle very long name (>1000 characters)', () => {
      const longName = 'a'.repeat(2000);
      const collection: StorageCollection = {
        id: 'col-1',
        name: longName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(collection.name).toHaveLength(2000);
    });

    it('should handle special characters in name - emoji', () => {
      const collection: StorageCollection = {
        id: 'col-1',
        name: '🎉🚀✨',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(collection.name).toBe('🎉🚀✨');
    });

    it('should handle special characters in name - unicode', () => {
      const collection: StorageCollection = {
        id: 'col-1',
        name: '中文日本語한국어',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(collection.name).toBe('中文日本語한국어');
    });

    it('should handle special characters in name - HTML', () => {
      const collection: StorageCollection = {
        id: 'col-1',
        name: '<script>alert("xss")</script>',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(collection.name).toBe('<script>alert("xss")</script>');
    });

    it('should handle empty description', () => {
      const collection: StorageCollection = {
        id: 'col-1',
        name: 'Test',
        description: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(collection.description).toBe('');
    });

    it('should handle very long description', () => {
      const longDesc = 'b'.repeat(10000);
      const collection: StorageCollection = {
        id: 'col-1',
        name: 'Test',
        description: longDesc,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(collection.description).toHaveLength(10000);
    });

    it('should handle undefined description', () => {
      const collection: StorageCollection = {
        id: 'col-1',
        name: 'Test',
        description: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(collection.description).toBeUndefined();
    });

    it('should handle createdAt = 0', () => {
      const collection: StorageCollection = {
        id: 'col-1',
        name: 'Test',
        createdAt: 0,
        updatedAt: Date.now(),
      };
      expect(collection.createdAt).toBe(0);
    });

    it('should handle negative createdAt', () => {
      const collection: StorageCollection = {
        id: 'col-1',
        name: 'Test',
        createdAt: -1000,
        updatedAt: Date.now(),
      };
      expect(collection.createdAt).toBe(-1000);
    });

    it('should handle very large timestamp', () => {
      const collection: StorageCollection = {
        id: 'col-1',
        name: 'Test',
        createdAt: Number.MAX_SAFE_INTEGER,
        updatedAt: Date.now(),
      };
      expect(collection.createdAt).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle updatedAt less than createdAt', () => {
      const now = Date.now();
      const collection: StorageCollection = {
        id: 'col-1',
        name: 'Test',
        createdAt: now,
        updatedAt: now - 100000,
      };
      expect(collection.updatedAt).toBeLessThan(collection.createdAt);
    });

    it('should create complete collection with all fields', () => {
      const collection: StorageCollection = {
        id: 'col-complete',
        name: 'Complete Collection',
        description: 'Full featured collection',
        createdAt: 1700000000000,
        updatedAt: 1700000001000,
      };
      expect(collection.id).toBe('col-complete');
      expect(collection.name).toBe('Complete Collection');
      expect(collection.description).toBe('Full featured collection');
      expect(collection.createdAt).toBe(1700000000000);
      expect(collection.updatedAt).toBe(1700000001000);
    });
  });
});

describe('StorageItem', () => {
  it('should support folder type', () => {
    const folder: StorageItem = {
      id: 'folder-1',
      type: 'folder',
      name: 'Test Folder',
      description: 'A test folder',
      parentId: 'col-1',
      collectionId: 'col-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(folder.type).toBe('folder');
    expect(folder.name).toBe('Test Folder');
    expect(folder.parentId).toBe('col-1');
    expect(folder.collectionId).toBe('col-1');
  });

  it('should support request type', () => {
    const request: StorageItem = {
      id: 'req-1',
      type: 'request',
      name: 'Test Request',
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: [
        { key: 'Content-Type', value: 'application/json', enabled: true },
      ],
      params: [
        { key: 'page', value: '1', enabled: true },
      ],
      body: {
        mode: 'json',
        content: '{"name": "test"}',
      },
      parentId: 'folder-1',
      collectionId: 'col-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(request.type).toBe('request');
    expect(request.method).toBe('GET');
    expect(request.url).toBe('https://api.example.com/users');
    expect(request.headers).toHaveLength(1);
    expect(request.params).toHaveLength(1);
    expect(request.body?.mode).toBe('json');
  });

  it('should support all HTTP methods', () => {
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

    methods.forEach((method) => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method,
        url: 'https://api.example.com',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(request.method).toBe(method);
    });
  });

  it('should allow root level items without parentId', () => {
    const request: StorageItem = {
      id: 'req-1',
      type: 'request',
      name: 'Root Request',
      method: 'POST',
      url: 'https://api.example.com',
      parentId: 'col-1',
      collectionId: 'col-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(request.parentId).toBe('col-1');
  });

  it('should support optional body', () => {
    const request: StorageItem = {
      id: 'req-1',
      type: 'request',
      name: 'Test',
      method: 'GET',
      url: 'https://api.example.com',
      parentId: 'col-1',
      collectionId: 'col-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(request.body).toBeUndefined();
  });

  describe('StorageItem boundary tests', () => {
    it('should handle empty name', () => {
      const item: StorageItem = {
        id: 'item-1',
        type: 'folder',
        name: '',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(item.name).toBe('');
    });

    it('should handle very long name', () => {
      const longName = 'x'.repeat(5000);
      const item: StorageItem = {
        id: 'item-1',
        type: 'folder',
        name: longName,
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(item.name).toHaveLength(5000);
    });

    it('should create complete folder with all fields', () => {
      const folder: StorageItem = {
        id: 'folder-complete',
        type: 'folder',
        name: 'Complete Folder',
        description: 'Full featured folder',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: 1700000000000,
        updatedAt: 1700000001000,
      };
      expect(folder.type).toBe('folder');
      expect(folder.name).toBe('Complete Folder');
      expect(folder.description).toBe('Full featured folder');
      expect(folder.method).toBeUndefined();
      expect(folder.url).toBeUndefined();
    });

    it('should create complete request with all fields', () => {
      const request: StorageItem = {
        id: 'req-complete',
        type: 'request',
        name: 'Complete Request',
        description: 'Full featured request',
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [
          { key: 'Authorization', value: 'Bearer token', enabled: true },
          { key: 'Content-Type', value: 'application/json', enabled: false },
        ],
        params: [
          { key: 'limit', value: '10', enabled: true },
        ],
        body: {
          mode: 'json',
          content: '{"name": "test"}',
        },
        parentId: 'folder-1',
        collectionId: 'col-1',
        createdAt: 1700000000000,
        updatedAt: 1700000001000,
      };
      expect(request.type).toBe('request');
      expect(request.method).toBe('POST');
      expect(request.url).toBe('https://api.example.com/users');
      expect(request.headers).toHaveLength(2);
      expect(request.params).toHaveLength(1);
      expect(request.body?.mode).toBe('json');
    });

    it('should default method to undefined when missing for request type', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test Request',
        url: 'https://api.example.com',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.method).toBeUndefined();
    });

    it('should handle optional url when method is present', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test Request',
        method: 'GET',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.url).toBeUndefined();
    });

    it('should handle empty url', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test Request',
        method: 'GET',
        url: '',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.url).toBe('');
    });

    it('should handle very long url', () => {
      const longUrl = 'https://api.example.com/' + 'path'.repeat(500);
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test Request',
        method: 'GET',
        url: longUrl,
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.url).toHaveLength(longUrl.length);
    });

    it('should handle body mode = none', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        body: { mode: 'none' },
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.body?.mode).toBe('none');
      expect(request.body?.content).toBeUndefined();
    });

    it('should handle body mode = text', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'POST',
        url: 'https://api.example.com',
        body: { mode: 'text', content: 'plain text content' },
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.body?.mode).toBe('text');
      expect(request.body?.content).toBe('plain text content');
    });

    it('should handle body mode = formdata', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'POST',
        url: 'https://api.example.com',
        body: { mode: 'formdata', content: 'field1=value1&field2=value2' },
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.body?.mode).toBe('formdata');
    });

    it('should handle body mode = urlencoded', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'POST',
        url: 'https://api.example.com',
        body: { mode: 'urlencoded', content: 'name=test&age=30' },
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.body?.mode).toBe('urlencoded');
    });

    it('should handle body without content for json mode', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'POST',
        url: 'https://api.example.com',
        body: { mode: 'json' },
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.body?.mode).toBe('json');
      expect(request.body?.content).toBeUndefined();
    });

    it('should handle parentId = null as string', () => {
      const item: StorageItem = {
        id: 'item-1',
        type: 'folder',
        name: 'Root Item',
        parentId: '',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(item.parentId).toBe('');
    });

    it('should handle parentId = undefined', () => {
      const item: StorageItem = {
        id: 'item-1',
        type: 'folder',
        name: 'Test',
        parentId: undefined as unknown as string,
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(item.parentId).toBeUndefined();
    });

    it('should handle collectionId = undefined', () => {
      const item: StorageItem = {
        id: 'item-1',
        type: 'folder',
        name: 'Test',
        parentId: 'col-1',
        collectionId: undefined as unknown as string,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(item.collectionId).toBeUndefined();
    });

    it('should handle empty headers array', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        headers: [],
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.headers).toEqual([]);
    });

    it('should handle undefined headers', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.headers).toBeUndefined();
    });

    it('should handle empty params array', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        params: [],
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.params).toEqual([]);
    });

    it('should handle undefined params', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.params).toBeUndefined();
    });

    it('should handle headers with disabled items', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        headers: [
          { key: 'Active-Header', value: 'value1', enabled: true },
          { key: 'Disabled-Header', value: 'value2', enabled: false },
        ],
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.headers).toHaveLength(2);
      expect(request.headers?.[0].enabled).toBe(true);
      expect(request.headers?.[1].enabled).toBe(false);
    });

    it('should handle params with disabled items', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        params: [
          { key: 'active', value: '1', enabled: true },
          { key: 'disabled', value: '0', enabled: false },
        ],
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.params).toHaveLength(2);
      expect(request.params?.[0].enabled).toBe(true);
      expect(request.params?.[1].enabled).toBe(false);
    });

    it('should handle timestamps at boundaries', () => {
      const item: StorageItem = {
        id: 'item-1',
        type: 'folder',
        name: 'Test',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: 0,
        updatedAt: Number.MAX_SAFE_INTEGER,
      };
      expect(item.createdAt).toBe(0);
      expect(item.updatedAt).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle negative timestamps', () => {
      const item: StorageItem = {
        id: 'item-1',
        type: 'folder',
        name: 'Test',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: -1000,
        updatedAt: -500,
      };
      expect(item.createdAt).toBe(-1000);
      expect(item.updatedAt).toBe(-500);
    });

    it('should handle updatedAt before createdAt', () => {
      const item: StorageItem = {
        id: 'item-1',
        type: 'folder',
        name: 'Test',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now() - 100000,
      };
      expect(item.updatedAt).toBeLessThan(item.createdAt);
    });
  });

  describe('StorageItem exception tests', () => {
    it('should handle missing required fields - id', () => {
      const item = {
        type: 'folder' as const,
        name: 'Test',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect((item as StorageItem).id).toBeUndefined();
    });

    it('should handle missing required fields - type', () => {
      const item = {
        id: 'item-1',
        name: 'Test',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect((item as StorageItem).type).toBeUndefined();
    });

    it('should handle missing required fields - name', () => {
      const item = {
        id: 'item-1',
        type: 'folder' as const,
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect((item as StorageItem).name).toBeUndefined();
    });

    it('should handle missing required fields - parentId', () => {
      const item = {
        id: 'item-1',
        type: 'folder' as const,
        name: 'Test',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect((item as StorageItem).parentId).toBeUndefined();
    });

    it('should handle missing required fields - collectionId', () => {
      const item = {
        id: 'item-1',
        type: 'folder' as const,
        name: 'Test',
        parentId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect((item as StorageItem).collectionId).toBeUndefined();
    });

    it('should handle invalid type value', () => {
      const item: StorageItem = {
        id: 'item-1',
        type: 'invalid' as 'folder' | 'request',
        name: 'Test',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(item.type).toBe('invalid');
    });

    it('should handle invalid HTTP method value', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'INVALID' as HttpMethod,
        url: 'https://api.example.com',
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.method).toBe('INVALID');
    });

    it('should handle invalid body mode value', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        body: { mode: 'invalid' as BodyMode, content: 'test' },
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.body?.mode).toBe('invalid');
    });

    it('should handle data field type error - headers as string', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        headers: 'not an array' as unknown as KeyValue[],
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.headers).toBe('not an array');
    });

    it('should handle data field type error - params as number', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        params: 123 as unknown as KeyValue[],
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.params).toBe(123);
    });

    it('should handle data field type error - body as string', () => {
      const request: StorageItem = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'GET',
        url: 'https://api.example.com',
        body: 'not an object' as unknown as BodyContent,
        parentId: 'col-1',
        collectionId: 'col-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(request.body).toBe('not an object');
    });
  });
});