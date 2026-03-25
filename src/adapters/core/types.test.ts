import { describe, it, expect } from 'vitest';
import { CollectionIR, ItemIR, isCollectionIR, isItemIR } from './types';

describe('CollectionIR', () => {
  it('should create CollectionIR with name and items', () => {
    const collection: CollectionIR = {
      name: 'Test Collection',
      items: []
    };

    expect(collection.name).toBe('Test Collection');
    expect(collection.items).toEqual([]);
  });

  it('should create CollectionIR with description', () => {
    const collection: CollectionIR = {
      name: 'Test Collection',
      description: 'A test collection',
      items: []
    };

    expect(collection.description).toBe('A test collection');
  });

  it('should contain nested items', () => {
    const folder: ItemIR = {
      id: 'folder-1',
      type: 'folder',
      name: 'Folder 1',
      children: []
    };

    const collection: CollectionIR = {
      name: 'Test Collection',
      items: [folder]
    };

    expect(collection.items).toHaveLength(1);
    expect(collection.items[0].type).toBe('folder');
  });
});

describe('ItemIR', () => {
  it('should create ItemIR with folder type', () => {
    const item: ItemIR = {
      id: 'folder-1',
      type: 'folder',
      name: 'Test Folder',
      children: [
        {
          id: 'request-1',
          type: 'request',
          name: 'Test Request',
          method: 'GET',
          url: 'https://api.example.com/test'
        }
      ]
    };

    expect(item.type).toBe('folder');
    expect(item.children).toHaveLength(1);
    expect(item.children![0].type).toBe('request');
  });

  it('should create ItemIR with request type', () => {
    const item: ItemIR = {
      id: 'request-1',
      type: 'request',
      name: 'GET Users',
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: [
        { key: 'Content-Type', value: 'application/json', enabled: true }
      ],
      params: [
        { key: 'page', value: '1', enabled: true }
      ],
      body: {
        mode: 'none'
      }
    };

    expect(item.type).toBe('request');
    expect(item.method).toBe('GET');
    expect(item.url).toBe('https://api.example.com/users');
    expect(item.headers).toHaveLength(1);
    expect(item.params).toHaveLength(1);
    expect(item.body).toBeDefined();
  });

  it('should create ItemIR with JSON body', () => {
    const item: ItemIR = {
      id: 'request-2',
      type: 'request',
      name: 'POST Create',
      method: 'POST',
      url: 'https://api.example.com/users',
      body: {
        mode: 'json',
        content: '{"name": "test"}'
      }
    };

    expect(item.body?.mode).toBe('json');
    expect(item.body?.content).toBe('{"name": "test"}');
  });
});

describe('IR validation', () => {
  it('should validate CollectionIR structure', () => {
    const collection: CollectionIR = {
      name: 'Valid Collection',
      items: []
    };

    expect(isCollectionIR(collection)).toBe(true);
  });

  it('should validate ItemIR structure', () => {
    const item: ItemIR = {
      id: 'test-id',
      type: 'request',
      name: 'Test'
    };

    expect(isItemIR(item)).toBe(true);
  });

  it('should reject invalid CollectionIR', () => {
    expect(isCollectionIR({ name: 'Test' })).toBe(false);
    expect(isCollectionIR(null)).toBe(false);
    expect(isCollectionIR(undefined)).toBe(false);
  });

  it('should reject invalid ItemIR', () => {
    expect(isItemIR({ type: 'request' })).toBe(false);
    expect(isItemIR({ id: 'test', name: 'Test' })).toBe(false);
    expect(isItemIR(null)).toBe(false);
  });

  it('should validate folder item has children array', () => {
    const folder: ItemIR = {
      id: 'folder-1',
      type: 'folder',
      name: 'Folder',
      children: []
    };

    expect(isItemIR(folder)).toBe(true);
    expect(folder.children).toBeDefined();
  });

  it('should validate request item has no children', () => {
    const request: ItemIR = {
      id: 'request-1',
      type: 'request',
      name: 'Request',
      method: 'GET',
      url: 'https://example.com'
    };

    expect(isItemIR(request)).toBe(true);
    expect('children' in request).toBe(false);
  });
});

describe('CollectionIR boundary cases', () => {
  it('should handle empty name', () => {
    const collection: CollectionIR = {
      name: '',
      items: []
    };
    expect(isCollectionIR(collection)).toBe(true);
    expect(collection.name).toBe('');
  });

  it('should handle very long name', () => {
    const longName = 'A'.repeat(10000);
    const collection: CollectionIR = {
      name: longName,
      items: []
    };
    expect(isCollectionIR(collection)).toBe(true);
    expect(collection.name).toHaveLength(10000);
  });

  it('should handle missing items property', () => {
    const collection = { name: 'Test' };
    expect(isCollectionIR(collection)).toBe(false);
  });

  it('should handle empty items array', () => {
    const collection: CollectionIR = {
      name: 'Test',
      items: []
    };
    expect(isCollectionIR(collection)).toBe(true);
    expect(collection.items).toHaveLength(0);
  });

  it('should handle items as non-array', () => {
    const collection = { name: 'Test', items: 'not-an-array' };
    expect(isCollectionIR(collection)).toBe(false);
  });

  it('should handle description', () => {
    const collection: CollectionIR = {
      name: 'Test',
      description: 'A very long description '.repeat(100),
      items: []
    };
    expect(isCollectionIR(collection)).toBe(true);
  });
});

describe('ItemIR folder type boundary', () => {
  it('should handle folder without children', () => {
    const folder: ItemIR = {
      id: 'folder-1',
      type: 'folder',
      name: 'Empty Folder'
    };
    expect(isItemIR(folder)).toBe(false);
  });

  it('should handle folder with many children', () => {
    const children = Array.from({ length: 100 }, (_, i) => ({
      id: `req-${i}`,
      type: 'request' as const,
      name: `Request ${i}`,
      method: 'GET',
      url: `https://api.example.com/${i}`
    }));
    const folder: ItemIR = {
      id: 'folder-1',
      type: 'folder',
      name: 'Large Folder',
      children
    };
    expect(isItemIR(folder)).toBe(true);
    expect(folder.children).toHaveLength(100);
  });

  it('should handle deeply nested folders', () => {
    let current: ItemIR = {
      id: 'depth-10',
      type: 'folder',
      name: 'Depth 10',
      children: []
    };
    for (let i = 9; i >= 0; i--) {
      current = {
        id: `depth-${i}`,
        type: 'folder',
        name: `Depth ${i}`,
        children: [current]
      };
    }
    expect(isItemIR(current)).toBe(true);
  });

  it('should handle folder with mixed children types', () => {
    const folder: ItemIR = {
      id: 'folder-1',
      type: 'folder',
      name: 'Mixed',
      children: [
        { id: 'sub-folder', type: 'folder', name: 'Sub Folder', children: [] },
        { id: 'req-1', type: 'request', name: 'Req 1', method: 'GET', url: 'https://api.example.com' }
      ]
    };
    expect(isItemIR(folder)).toBe(true);
  });
});

describe('ItemIR request type boundary', () => {
  it('should handle request without method', () => {
    const request: ItemIR = {
      id: 'req-1',
      type: 'request',
      name: 'Test',
      url: 'https://api.example.com'
    };
    expect(isItemIR(request)).toBe(true);
    expect(request.method).toBeUndefined();
  });

  it('should handle request without url', () => {
    const request: ItemIR = {
      id: 'req-1',
      type: 'request',
      name: 'Test',
      method: 'GET'
    };
    expect(isItemIR(request)).toBe(true);
    expect(request.url).toBeUndefined();
  });

  it('should handle request with various body modes', () => {
    const bodyModes = ['none', 'json', 'text', 'formdata', 'urlencoded', 'binary'];
    bodyModes.forEach(mode => {
      const request: ItemIR = {
        id: 'req-1',
        type: 'request',
        name: 'Test',
        method: 'POST',
        url: 'https://api.example.com',
        body: { mode, content: mode === 'none' ? undefined : 'test content' }
      };
      expect(isItemIR(request)).toBe(true);
      expect(request.body?.mode).toBe(mode);
    });
  });

  it('should handle request without headers', () => {
    const request: ItemIR = {
      id: 'req-1',
      type: 'request',
      name: 'Test',
      method: 'GET',
      url: 'https://api.example.com'
    };
    expect(isItemIR(request)).toBe(true);
    expect(request.headers).toBeUndefined();
  });

  it('should handle request without params', () => {
    const request: ItemIR = {
      id: 'req-1',
      type: 'request',
      name: 'Test',
      method: 'GET',
      url: 'https://api.example.com'
    };
    expect(isItemIR(request)).toBe(true);
    expect(request.params).toBeUndefined();
  });

  it('should handle request with empty headers', () => {
    const request: ItemIR = {
      id: 'req-1',
      type: 'request',
      name: 'Test',
      method: 'GET',
      url: 'https://api.example.com',
      headers: []
    };
    expect(isItemIR(request)).toBe(true);
    expect(request.headers).toEqual([]);
  });

  it('should handle request with empty params', () => {
    const request: ItemIR = {
      id: 'req-1',
      type: 'request',
      name: 'Test',
      method: 'GET',
      url: 'https://api.example.com',
      params: []
    };
    expect(isItemIR(request)).toBe(true);
    expect(request.params).toEqual([]);
  });

  it('should handle disabled headers', () => {
    const request: ItemIR = {
      id: 'req-1',
      type: 'request',
      name: 'Test',
      method: 'GET',
      url: 'https://api.example.com',
      headers: [
        { key: 'Authorization', value: 'Bearer token', enabled: false }
      ]
    };
    expect(isItemIR(request)).toBe(true);
    expect(request.headers?.[0].enabled).toBe(false);
  });

  it('should handle disabled params', () => {
    const request: ItemIR = {
      id: 'req-1',
      type: 'request',
      name: 'Test',
      method: 'GET',
      url: 'https://api.example.com',
      params: [
        { key: 'page', value: '1', enabled: false }
      ]
    };
    expect(isItemIR(request)).toBe(true);
    expect(request.params?.[0].enabled).toBe(false);
  });
});

describe('ItemIR type validation', () => {
  it('should reject invalid type', () => {
    const item = { id: '1', type: 'invalid', name: 'Test' };
    expect(isItemIR(item)).toBe(false);
  });

  it('should reject type as number', () => {
    const item = { id: '1', type: 123, name: 'Test' };
    expect(isItemIR(item)).toBe(false);
  });

  it('should reject type as null', () => {
    const item = { id: '1', type: null, name: 'Test' };
    expect(isItemIR(item)).toBe(false);
  });

  it('should reject id as number', () => {
    const item = { id: 123, type: 'request', name: 'Test' };
    expect(isItemIR(item)).toBe(false);
  });

  it('should reject name as number', () => {
    const item = { id: '1', type: 'request', name: 123 };
    expect(isItemIR(item)).toBe(false);
  });
});

describe('Mixed folder and request', () => {
  it('should handle collection with mixed folder and request', () => {
    const collection: CollectionIR = {
      name: 'Mixed Collection',
      items: [
        {
          id: 'folder-1',
          type: 'folder',
          name: 'Folder 1',
          children: [
            { id: 'req-1', type: 'request', name: 'Req 1', method: 'GET', url: 'https://api.example.com/1' }
          ]
        },
        { id: 'req-2', type: 'request', name: 'Req 2', method: 'POST', url: 'https://api.example.com/2' },
        {
          id: 'folder-2',
          type: 'folder',
          name: 'Folder 2',
          children: [
            { id: 'req-3', type: 'request', name: 'Req 3', method: 'PUT', url: 'https://api.example.com/3' },
            { id: 'req-4', type: 'request', name: 'Req 4', method: 'DELETE', url: 'https://api.example.com/4' }
          ]
        }
      ]
    };
    expect(isCollectionIR(collection)).toBe(true);
    expect(collection.items).toHaveLength(3);
    expect(collection.items[0].type).toBe('folder');
    expect(collection.items[1].type).toBe('request');
    expect(collection.items[2].type).toBe('folder');
  });

  it('should handle collection with description', () => {
    const collection: CollectionIR = {
      name: 'Test',
      description: 'Description with special chars: <>&"\'{}',
      items: []
    };
    expect(isCollectionIR(collection)).toBe(true);
  });
});
