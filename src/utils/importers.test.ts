import { describe, it, expect, vi } from 'vitest';
import {
  importPostmanCollection,
  importSwagger,
  importYApi,
  importCollection,
  autoImport,
} from './importers';
import type {
  PostmanCollection,
  SwaggerDocument,
  YApiProject,
  YApiCategory,
  YApiInterface,
} from '../types';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));

describe('Importers', () => {
  describe('importPostmanCollection', () => {
    const mockPostmanCollection: PostmanCollection = {
      info: {
        _postman_id: 'postman-id-123',
        name: 'Test Collection',
        description: 'A test collection',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        {
          name: 'Get Users',
          request: {
            method: 'GET',
            header: [
              { key: 'Authorization', value: 'Bearer token', type: 'text' },
            ],
            url: {
              raw: 'https://api.example.com/users?page=1',
              protocol: 'https',
              host: ['api', 'example', 'com'],
              path: ['users'],
              query: [{ key: 'page', value: '1' }],
            },
          },
        },
        {
          name: 'Create User',
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type', value: 'application/json', type: 'text' },
            ],
            url: {
              raw: 'https://api.example.com/users',
              protocol: 'https',
              host: ['api', 'example', 'com'],
              path: ['users'],
            },
            body: {
              mode: 'raw',
              raw: '{"name": "John"}',
            },
          },
        },
      ],
    };

    it('should import Postman collection', () => {
      const result = importPostmanCollection(mockPostmanCollection);

      expect(result.name).toBe('Test Collection');
      expect(result.description).toBe('A test collection');
      expect(result.requests).toHaveLength(2);
    });

    it('should convert GET request correctly', () => {
      const result = importPostmanCollection(mockPostmanCollection);
      const getRequest = result.requests[0];

      expect(getRequest.name).toBe('Get Users');
      expect(getRequest.method).toBe('GET');
      expect(getRequest.url).toBe('https://api.example.com/users?page=1');
      expect(getRequest.headers).toHaveLength(1);
      expect(getRequest.headers[0]).toMatchObject({
        key: 'Authorization',
        value: 'Bearer token',
        enabled: true,
      });
    });

    it('should convert query params', () => {
      const result = importPostmanCollection(mockPostmanCollection);
      const getRequest = result.requests[0];

      expect(getRequest.params).toHaveLength(1);
      expect(getRequest.params[0]).toMatchObject({
        key: 'page',
        value: '1',
        enabled: true,
      });
    });

    it('should convert POST request with body', () => {
      const result = importPostmanCollection(mockPostmanCollection);
      const postRequest = result.requests[1];

      expect(postRequest.method).toBe('POST');
      expect(postRequest.body).toMatchObject({
        mode: 'json',
        content: '{"name": "John"}',
      });
    });

    it('should handle string URL', () => {
      const collectionWithStringUrl: PostmanCollection = {
        ...mockPostmanCollection,
        item: [
          {
            name: 'Simple Request',
            request: {
              method: 'GET',
              header: [],
              url: 'https://api.example.com/simple',
            },
          },
        ],
      };

      const result = importPostmanCollection(collectionWithStringUrl);
      expect(result.requests[0].url).toBe('https://api.example.com/simple');
    });

    it('should handle nested folders', () => {
      const collectionWithFolders: PostmanCollection = {
        info: {
          _postman_id: 'id',
          name: 'Collection',
          schema: '',
        },
        item: [
          {
            name: 'Folder 1',
            item: [
              {
                name: 'Subfolder',
                item: [
                  {
                    name: 'Nested Request',
                    request: {
                      method: 'GET',
                      header: [],
                      url: { raw: 'https://api.example.com/nested', host: ['api', 'example', 'com'], path: ['nested'] },
                    },
                  },
                ],
              },
              {
                name: 'Direct Request',
                request: {
                  method: 'GET',
                  header: [],
                  url: { raw: 'https://api.example.com/direct', host: ['api', 'example', 'com'], path: ['direct'] },
                },
              },
            ],
          },
        ],
      };

      const result = importPostmanCollection(collectionWithFolders);
      expect(result.folders).toHaveLength(1);
      expect(result.folders[0].folders).toHaveLength(1);
      expect(result.folders[0].requests).toHaveLength(1);
    });

    it('should handle urlencoded body', () => {
      const collectionWithUrlEncoded: PostmanCollection = {
        info: {
          _postman_id: 'id',
          name: 'Collection',
          schema: '',
        },
        item: [
          {
            name: 'Form Request',
            request: {
              method: 'POST',
              header: [],
              url: { raw: 'https://api.example.com/form', host: ['api', 'example', 'com'], path: ['form'] },
              body: {
                mode: 'urlencoded',
                urlencoded: [
                  { key: 'name', value: 'John', type: 'text' },
                  { key: 'email', value: 'john@example.com', type: 'text' },
                ],
              },
            },
          },
        ],
      };

      const result = importPostmanCollection(collectionWithUrlEncoded);
      expect(result.requests[0].body!.mode).toBe('urlencoded');
      expect(result.requests[0].body!.content).toContain('name=John');
      expect(result.requests[0].body!.content).toContain('email=john%40example.com');
    });

    it('should handle formdata body', () => {
      const collectionWithFormData: PostmanCollection = {
        info: {
          _postman_id: 'id',
          name: 'Collection',
          schema: '',
        },
        item: [
          {
            name: 'Upload Request',
            request: {
              method: 'POST',
              header: [],
              url: { raw: 'https://api.example.com/upload', host: ['api', 'example', 'com'], path: ['upload'] },
              body: {
                mode: 'formdata',
                formdata: [
                  { key: 'file', src: ['/path/to/file'], type: 'file' },
                ],
              },
            },
          },
        ],
      };

      const result = importPostmanCollection(collectionWithFormData);
      expect(result.requests[0].body!.mode).toBe('formdata');
    });

    it('should handle empty collection', () => {
      const emptyCollection: PostmanCollection = {
        info: {
          _postman_id: 'id',
          name: 'Empty Collection',
          schema: '',
        },
        item: [],
      };

      const result = importPostmanCollection(emptyCollection);
      expect(result.requests).toHaveLength(0);
      expect(result.folders).toHaveLength(0);
    });
  });

  describe('importSwagger', () => {
    const mockSwaggerDoc: SwaggerDocument = {
      swagger: '2.0',
      info: {
        title: 'Pet Store API',
        version: '1.0.0',
        description: 'A sample API',
      },
      basePath: '/v1',
      host: 'api.example.com',
      schemes: ['https'],
      paths: {
        '/pets': {
          get: {
            summary: 'List pets',
            operationId: 'listPets',
            parameters: [
              { name: 'limit', in: 'query', type: 'integer' },
            ],
            tags: ['pets'],
          },
          post: {
            summary: 'Create pet',
            operationId: 'createPet',
            parameters: [
              { name: 'name', in: 'body', required: true, schema: {} },
            ],
            tags: ['pets'],
          },
        },
        '/pets/{id}': {
          get: {
            summary: 'Get pet by ID',
            operationId: 'getPet',
            parameters: [
              { name: 'id', in: 'path', required: true, type: 'string' },
            ],
          },
        },
      },
    };

    it('should import Swagger document', () => {
      const result = importSwagger(mockSwaggerDoc);

      expect(result.name).toBe('Pet Store API');
      expect(result.description).toBe('A sample API');
    });

    it('should convert GET request', () => {
      const result = importSwagger(mockSwaggerDoc);
      const petFolder = result.folders.find(f => f.name === 'pets');

      expect(petFolder).toBeDefined();
      expect(petFolder!.requests).toHaveLength(2);
    });

    it('should convert query parameters', () => {
      const result = importSwagger(mockSwaggerDoc);
      const petFolder = result.folders.find(f => f.name === 'pets');
      const listRequest = petFolder!.requests.find(r => r.method === 'GET');

      expect(listRequest!.params).toHaveLength(1);
      expect(listRequest!.params[0].key).toBe('limit');
    });

    it('should convert path parameters', () => {
      const result = importSwagger(mockSwaggerDoc);
      const getByIdRequest = result.requests.find(r => r.url.includes('{{id}}'));

      expect(getByIdRequest).toBeDefined();
      expect(getByIdRequest!.url).toContain('{{id}}');
    });

    it('should handle OpenAPI 3.0 format', () => {
      const openApiDoc: SwaggerDocument = {
        openapi: '3.0.0',
        info: {
          title: 'OpenAPI 3 API',
          version: '1.0.0',
        },
        paths: {
          '/test': {
            get: {
              summary: 'Test endpoint',
            },
          },
        },
      };

      const result = importSwagger(openApiDoc);
      expect(result.name).toBe('OpenAPI 3 API');
    });

    it('should handle paths without tags', () => {
      const swaggerWithoutTags: SwaggerDocument = {
        swagger: '2.0',
        info: { title: 'No Tags API', version: '1.0.0' },
        paths: {
          '/orphan': {
            get: {
              summary: 'Orphan endpoint',
            },
          },
        },
      };

      const result = importSwagger(swaggerWithoutTags);
      expect(result.requests).toHaveLength(1);
      expect(result.folders).toHaveLength(0);
    });

    it('should handle missing basePath', () => {
      const swaggerNoBasePath: SwaggerDocument = {
        swagger: '2.0',
        info: { title: 'No BasePath', version: '1.0.0' },
        paths: {
          '/test': {
            get: {},
          },
        },
      };

      const result = importSwagger(swaggerNoBasePath);
      expect(result.requests[0].url).toBe('/test');
    });
  });

  describe('importYApi', () => {
    const mockYApiProject: YApiProject = {
      _id: 1,
      name: 'YApi Project',
      desc: 'A YApi project',
      basepath: '/api',
      env: [{ name: 'Production', domain: 'https://api.example.com' }],
    };

    const mockCategories: YApiCategory[] = [
      { _id: 100, name: 'User', desc: 'User related APIs' },
      { _id: 200, name: 'Order', desc: 'Order related APIs' },
    ];

    const mockInterfaces: YApiInterface[] = [
      {
        _id: 1001,
        title: 'Get User',
        path: '/user/{id}',
        method: 'get',
        desc: 'Get user by ID',
        catid: 100,
        req_headers: [{ name: 'Authorization', value: 'Bearer token' }],
        req_query: [{ name: 'fields', desc: 'Fields to return' }],
        req_body_other: '{"name": "string"}',
      },
      {
        _id: 2001,
        title: 'Create Order',
        path: '/order',
        method: 'post',
        desc: 'Create new order',
        catid: 200,
      },
    ];

    it('should import YApi project', () => {
      const result = importYApi(mockYApiProject, mockCategories, mockInterfaces);

      expect(result.name).toBe('YApi Project');
      expect(result.description).toBe('A YApi project');
      expect(result.folders).toHaveLength(2);
    });

    it('should categorize requests by category', () => {
      const result = importYApi(mockYApiProject, mockCategories, mockInterfaces);

      const userFolder = result.folders.find(f => f.name === 'User');
      const orderFolder = result.folders.find(f => f.name === 'Order');

      expect(userFolder!.requests).toHaveLength(1);
      expect(orderFolder!.requests).toHaveLength(1);
    });

    it('should convert request details', () => {
      const result = importYApi(mockYApiProject, mockCategories, mockInterfaces);
      const userFolder = result.folders.find(f => f.name === 'User');
      const request = userFolder!.requests[0];

      expect(request.name).toBe('Get User');
      expect(request.method).toBe('GET');
      expect(request.url).toBe('https://api.example.com/api/user/{id}');
      expect(request.description).toBe('Get user by ID');
    });

    it('should convert headers', () => {
      const result = importYApi(mockYApiProject, mockCategories, mockInterfaces);
      const userFolder = result.folders.find(f => f.name === 'User');
      const request = userFolder!.requests[0];

      expect(request.headers).toHaveLength(1);
      expect(request.headers[0]).toMatchObject({
        key: 'Authorization',
        value: 'Bearer token',
        enabled: true,
      });
    });

    it('should convert body', () => {
      const result = importYApi(mockYApiProject, mockCategories, mockInterfaces);
      const userFolder = result.folders.find(f => f.name === 'User');
      const request = userFolder!.requests[0];

      expect(request.body).toBeDefined();
      expect(request.body!.mode).toBe('json');
      expect(request.body!.content).toContain('name');
    });

    it('should handle interface without category', () => {
      const orphanInterface: YApiInterface = {
        _id: 3001,
        title: 'Orphan',
        path: '/orphan',
        method: 'get',
      };

      const result = importYApi(mockYApiProject, mockCategories, [orphanInterface]);
      expect(result.requests).toHaveLength(1);
    });

    it('should handle missing env', () => {
      const projectNoEnv: YApiProject = {
        _id: 1,
        name: 'No Env',
      };

      const result = importYApi(projectNoEnv, mockCategories, mockInterfaces);
      // URL should contain the path even without domain
      expect(result.folders[0].requests[0].url).toContain('/user');
    });

    it('should handle invalid JSON in req_body_other', () => {
      const interfaceWithInvalidJson: YApiInterface = {
        _id: 1001,
        title: 'Invalid JSON',
        path: '/test',
        method: 'post',
        catid: 100,
        req_body_other: 'not valid json',
      };

      const result = importYApi(mockYApiProject, mockCategories, [interfaceWithInvalidJson]);
      const request = result.folders[0].requests[0];

      expect(request.body!.mode).toBe('text');
      expect(request.body!.content).toBe('not valid json');
    });
  });

  describe('importCollection', () => {
    it('should import Postman format', () => {
      const postmanData: PostmanCollection = {
        info: {
          _postman_id: 'id',
          name: 'Postman',
          schema: 'https://schema.getpostman.com',
        },
        item: [],
      };

      const result = importCollection(postmanData, 'postman');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Postman');
    });

    it('should import Swagger format', () => {
      const swaggerData: SwaggerDocument = {
        swagger: '2.0',
        info: { title: 'Swagger', version: '1.0.0' },
        paths: {},
      };

      const result = importCollection(swaggerData, 'swagger');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Swagger');
    });

    it('should import YApi format', () => {
      const yapiData = {
        project: { _id: 1, name: 'YApi' },
        categories: [],
        interfaces: [],
      };

      const result = importCollection(yapiData, 'yapi');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('YApi');
    });

    it('should return null for invalid format', () => {
      const result = importCollection({}, 'invalid' as unknown as 'postman');
      expect(result).toBeNull();
    });

    it('should return null for YApi without required fields', () => {
      const result = importCollection({ project: {} }, 'yapi');
      expect(result).toBeNull();
    });

    it('should handle import errors gracefully', () => {
      const result = importCollection(null, 'postman');
      expect(result).toBeNull();
    });
  });

  describe('autoImport', () => {
    it('should auto-detect Postman format', () => {
      const postmanJson = JSON.stringify({
        info: {
          name: 'Auto Postman',
          schema: 'https://schema.getpostman.com',
        },
        item: [],
      });

      const result = autoImport(postmanJson);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Auto Postman');
    });

    it('should auto-detect Swagger 2.0 format', () => {
      const swaggerJson = JSON.stringify({
        swagger: '2.0',
        info: { title: 'Auto Swagger', version: '1.0.0' },
        paths: {},
      });

      const result = autoImport(swaggerJson);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Auto Swagger');
    });

    it('should auto-detect OpenAPI 3.0 format', () => {
      const openApiJson = JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Auto OpenAPI', version: '1.0.0' },
        paths: {},
      });

      const result = autoImport(openApiJson);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Auto OpenAPI');
    });

    it('should auto-detect YApi format', () => {
      const yapiJson = JSON.stringify({
        project: { _id: 1, name: 'Auto YApi' },
        interfaces: [],
      });

      const result = autoImport(yapiJson);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Auto YApi');
    });

    it('should return null for unknown format', () => {
      const unknownJson = JSON.stringify({ foo: 'bar' });
      const result = autoImport(unknownJson);
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = autoImport('not valid json');
      expect(result).toBeNull();
    });
  });
});
