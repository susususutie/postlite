import { describe, it, expect, vi } from 'vitest';
import {
  exportToPostman,
  exportToSwagger,
  exportToJSON,
  exportCollection,
  downloadFile,
} from './exporters';
import type { Collection, HttpRequest } from '../types';

describe('Exporters', () => {
  const mockRequest: HttpRequest = {
    id: 'req-1',
    name: 'Get Users',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: [
      { key: 'Authorization', value: 'Bearer token', enabled: true },
      { key: 'X-Custom', value: 'custom-value', enabled: false },
    ],
    params: [
      { key: 'page', value: '1', enabled: true },
      { key: 'limit', value: '10', enabled: false },
    ],
    body: {
      mode: 'json',
      content: '{"name": "test"}',
    },
    description: 'Get all users',
  };

  const mockCollection: Collection = {
    id: 'col-1',
    name: 'Test Collection',
    description: 'A test collection',
    folders: [],
    requests: [mockRequest],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  describe('exportToPostman', () => {
    it('should export collection to Postman format', () => {
      const result = exportToPostman(mockCollection);

      expect(result.info).toMatchObject({
        _postman_id: 'col-1',
        name: 'Test Collection',
        description: 'A test collection',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      });
    });

    it('should export requests correctly', () => {
      const result = exportToPostman(mockCollection);

      expect(result.item).toHaveLength(1);
      expect(result.item[0].name).toBe('Get Users');
      expect(result.item[0].request.method).toBe('GET');
    });

    it('should convert headers', () => {
      const result = exportToPostman(mockCollection);
      const request = result.item[0].request;

      expect(request.header).toHaveLength(2);
      expect(request.header[0]).toMatchObject({
        key: 'Authorization',
        value: 'Bearer token',
        type: 'text',
      });
    });

    it('should convert query params', () => {
      const result = exportToPostman(mockCollection);
      const url = result.item[0].request.url;

      // Only enabled params are exported
      expect(url.query).toHaveLength(1);
      expect(url.query![0]).toMatchObject({
        key: 'page',
        value: '1',
      });
    });

    it('should convert URL components', () => {
      const result = exportToPostman(mockCollection);
      const url = result.item[0].request.url;

      expect(url.protocol).toBe('https');
      expect(url.host).toEqual(['api', 'example', 'com']);
      expect(url.path).toEqual(['users']);
    });

    it('should convert JSON body', () => {
      const result = exportToPostman(mockCollection);
      const body = result.item[0].request.body;

      expect(body).toMatchObject({
        mode: 'raw',
        raw: '{"name": "test"}',
      });
    });

    it('should convert urlencoded body', () => {
      const collectionWithUrlEncoded: Collection = {
        ...mockCollection,
        requests: [
          {
            ...mockRequest,
            body: {
              mode: 'urlencoded',
              content: 'name=John&email=john%40example.com',
            },
          },
        ],
      };

      const result = exportToPostman(collectionWithUrlEncoded);
      const body = result.item[0].request.body;

      expect(body!.mode).toBe('urlencoded');
      expect(body!.urlencoded).toHaveLength(2);
    });

    it('should handle formdata body', () => {
      const collectionWithFormData: Collection = {
        ...mockCollection,
        requests: [
          {
            ...mockRequest,
            body: {
              mode: 'formdata',
              content: JSON.stringify([{ key: 'file', src: ['/path/to/file'] }]),
            },
          },
        ],
      };

      const result = exportToPostman(collectionWithFormData);
      const body = result.item[0].request.body;

      expect(body!.mode).toBe('formdata');
    });

    it('should export nested folders', () => {
      const collectionWithFolders: Collection = {
        ...mockCollection,
        folders: [
          {
            id: 'folder-1',
            name: 'Folder 1',
            folders: [
              {
                id: 'folder-2',
                name: 'Nested Folder',
                folders: [],
                requests: [
                  {
                    ...mockRequest,
                    id: 'req-nested',
                    name: 'Nested Request',
                  },
                ],
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
            requests: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      };

      const result = exportToPostman(collectionWithFolders);

      expect(result.item).toHaveLength(2); // Root request + folder
      expect(result.item[1].item![0].name).toBe('Nested Folder');
      expect(result.item[1].item![0].item![0].name).toBe('Nested Request');
    });

    it('should handle invalid URL gracefully', () => {
      const collectionWithInvalidUrl: Collection = {
        ...mockCollection,
        requests: [
          {
            ...mockRequest,
            url: 'not-a-valid-url',
          },
        ],
      };

      const result = exportToPostman(collectionWithInvalidUrl);
      expect(result.item[0].request.url.raw).toBe('not-a-valid-url');
    });

    it('should include empty response array', () => {
      const result = exportToPostman(mockCollection);
      expect(result.item[0].response).toEqual([]);
    });
  });

  describe('exportToSwagger', () => {
    it('should export collection to Swagger 2.0 format', () => {
      const result = exportToSwagger(mockCollection);

      expect(result.swagger).toBe('2.0');
      expect(result.info).toMatchObject({
        title: 'Test Collection',
        description: 'A test collection',
        version: '1.0.0',
      });
    });

    it('should convert requests to paths', () => {
      const result = exportToSwagger(mockCollection);

      expect(result.paths['/users']).toBeDefined();
      expect(result.paths['/users'].get).toBeDefined();
    });

    it('should convert query parameters', () => {
      const result = exportToSwagger(mockCollection);
      const operation = result.paths['/users'].get;

      // Only enabled params are exported
      expect(operation!.parameters).toHaveLength(2); // 1 enabled param + 1 enabled header
      const queryParams = operation!.parameters!.filter(p => p.in === 'query');
      expect(queryParams).toHaveLength(1);
    });

    it('should convert header parameters', () => {
      const result = exportToSwagger(mockCollection);
      const operation = result.paths['/users'].get;

      const headerParams = operation!.parameters!.filter(p => p.in === 'header');
      expect(headerParams).toHaveLength(1); // Only enabled headers
    });

    it('should include operation details', () => {
      const result = exportToSwagger(mockCollection);
      const operation = result.paths['/users'].get;

      expect(operation!.summary).toBe('Get Users');
      expect(operation!.description).toBe('Get all users');
      expect(operation!.operationId).toBe('get__users');
    });

    it('should include default response', () => {
      const result = exportToSwagger(mockCollection);
      const operation = result.paths['/users'].get;

      expect(operation!.responses!['200']).toEqual({
        description: 'Successful response',
      });
    });

    it('should add folder name as tag', () => {
      const collectionWithFolders: Collection = {
        ...mockCollection,
        requests: [],
        folders: [
          {
            id: 'folder-1',
            name: 'Users',
            folders: [],
            requests: [mockRequest],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      };

      const result = exportToSwagger(collectionWithFolders);
      const operation = result.paths['/users'].get;

      expect(operation!.tags).toContain('Users');
    });

    it('should handle requests without leading slash', () => {
      const collectionWithoutLeadingSlash: Collection = {
        ...mockCollection,
        requests: [
          {
            ...mockRequest,
            url: 'https://api.example.comusers', // Malformed URL
          },
        ],
      };

      exportToSwagger(collectionWithoutLeadingSlash);
      // Should skip this request due to invalid URL parsing
    });

    it('should process nested folders recursively', () => {
      const collectionWithNestedFolders: Collection = {
        ...mockCollection,
        requests: [],
        folders: [
          {
            id: 'folder-1',
            name: 'Level 1',
            folders: [
              {
                id: 'folder-2',
                name: 'Level 2',
                folders: [],
                requests: [mockRequest],
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
            requests: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      };

      const result = exportToSwagger(collectionWithNestedFolders);
      expect(result.paths['/users']).toBeDefined();
    });

    it('should skip requests with invalid URLs', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const collectionWithInvalidUrl: Collection = {
        ...mockCollection,
        requests: [
          {
            ...mockRequest,
            url: 'not-a-valid-url',
          },
        ],
      };

      const result = exportToSwagger(collectionWithInvalidUrl);
      expect(Object.keys(result.paths)).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('exportToJSON', () => {
    it('should export collection as JSON string', () => {
      const result = exportToJSON(mockCollection);
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe('col-1');
      expect(parsed.name).toBe('Test Collection');
      expect(parsed.requests).toHaveLength(1);
    });

    it('should be valid JSON', () => {
      const result = exportToJSON(mockCollection);
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should preserve all collection properties', () => {
      const result = exportToJSON(mockCollection);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('description');
      expect(parsed).toHaveProperty('folders');
      expect(parsed).toHaveProperty('requests');
      expect(parsed).toHaveProperty('createdAt');
      expect(parsed).toHaveProperty('updatedAt');
    });
  });

  describe('exportCollection', () => {
    it('should export to Postman format', () => {
      const result = exportCollection(mockCollection, 'postman');
      const parsed = JSON.parse(result);

      expect(parsed.info).toBeDefined();
      expect(parsed.info.schema).toContain('postman');
    });

    it('should export to Swagger format', () => {
      const result = exportCollection(mockCollection, 'swagger');
      const parsed = JSON.parse(result);

      expect(parsed.swagger).toBe('2.0');
    });

    it('should export to JSON format', () => {
      const result = exportCollection(mockCollection, 'json');
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe('col-1');
      expect(parsed.info).toBeUndefined();
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        exportCollection(mockCollection, 'xml' as unknown as 'postman' | 'swagger' | 'json');
      }).toThrow('Unsupported export format: xml');
    });
  });

  describe('downloadFile', () => {
    it('should create blob and download link', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      downloadFile('{"test": "data"}', 'test.json');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });

    it('should set correct download attributes', () => {
      const linkElement = {
        href: '',
        download: '',
        style: {},
        click: vi.fn(),
        setAttribute: vi.fn(),
      };

      vi.spyOn(document, 'createElement').mockReturnValue(linkElement as unknown as HTMLAnchorElement);

      downloadFile('content', 'my-file.json', 'application/json');

      expect(linkElement.download).toBe('my-file.json');
      expect(linkElement.href).toBe('blob:mock-url');
    });

    it('should use default MIME type', () => {
      const blobSpy = vi.spyOn(global, 'Blob');

      downloadFile('content', 'test.json');

      expect(blobSpy).toHaveBeenCalledWith(['content'], { type: 'application/json' });
    });

    it('should clean up object URL', () => {
      downloadFile('content', 'test.json');

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
