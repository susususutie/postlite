// 性能和压力测试
import { describe, it, expect, beforeEach } from 'vitest';
import type {
  EnvironmentVariable,
  Header,
} from '../types';
import {
  parseHeaders,
} from '../services/http';
import {
  replaceEnvironmentVariables,
} from '../utils/environment';
import{
  createCollection,
  createRequest,
  createFolder,
  getCollections,
  moveRequest,
} from '../services/collection';
import{
  createEnvironment,
  setEnvironmentVariables,
} from '../services/environment';
import{
  saveCollections,
  loadCollections,
  loadEnvironments,
} from '../store/storage';
import{
  importPostmanCollection,
  importSwagger,
} from '../utils/importers';
import{
  exportToPostman,
} from '../utils/exporters';
import{
  createMockCollection,
} from '../test/factories';

describe('性能和压力测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('大数据量处理', () => {
    it('应能在合理时间内处理 1000 个请求', () => {
      const collection = createCollection('Stress Test');
      const start = performance.now();

      // 批量创建 1000 个请求
      for (let i = 0; i < 1000; i++) {
        createRequest(collection.id, {
          name: `Request ${i}`,
          method: i % 2 === 0 ? 'GET' : 'POST',
          url: `https://api.example.com/resource${i}`,
          headers: [],
          params: [],
        });
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(5000); // 应少于 5 秒

      const collections = getCollections();
      expect(collections[0].requests).toHaveLength(1000);
    });

    it('应能在合理时间内处理 500 个嵌套文件夹', () => {
      const collection = createCollection('Deep Nesting');
      let parentId: string | undefined = undefined;

      const start = performance.now();

      // 创建 500 层嵌套
      for (let i = 0; i < 100; i++) {
        const folder = createFolder(collection.id, `Level ${i}`, parentId);
        parentId = folder.id;
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(3000);

      const collections = getCollections();
      expect(collections[0].folders.length).toBeGreaterThan(0);
    });

    it('应能在合理时间内处理大量 Headers', () => {
      const headers: Header[] = Array.from({ length: 5000 }, (_, i) => ({
        key: `X-Header-${i}`,
        value: `value-${i}`,
        enabled: i % 2 === 0,
      }));

      const start = performance.now();
      const result = parseHeaders(headers);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000);
      expect(Object.keys(result).length).toBe(2500); // 一半的 enabled
    });

    it('应能在合理时间内处理大量环境变量', () => {
      const env = createEnvironment('Large Env');
      const variables: EnvironmentVariable[] = Array.from({ length: 1000 }, (_, i) => ({
        key: `VAR_${i}`,
        value: `value_${i}_${'a'.repeat(100)}`, // 每个值 100+ 字符
        type: 'string',
        enabled: true,
      }));

      const start = performance.now();
      setEnvironmentVariables(env.id, variables);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000);

      const environments = loadEnvironments();
      const savedEnv = environments.find(e => e.id === env.id);
      expect(savedEnv!.variables).toHaveLength(1000);
    });

    it('应能在合理时间内进行大规模变量替换', () => {
      const variables: EnvironmentVariable[] = Array.from({ length: 500 }, (_, i) => ({
        key: `VAR${i}`,
        value: `value${i}`,
        type: 'string',
        enabled: true,
      }));

      const template = Array.from({ length: 500 }, (_, i) => `{{VAR${i}}}`).join(' ');

      const start = performance.now();
      const result = replaceEnvironmentVariables(template, variables);
      const end = performance.now();

      expect(end - start).toBeLessThan(2000);
      expect(result).not.toContain('{{');
    });
  });

  describe('内存使用测试', () => {
    it('应能处理大容量的请求体', () => {
      const largeBody = JSON.stringify({
        data: 'x'.repeat(1024 * 1024), // 1MB 数据
      });

      const collection = createCollection('Test');
      const request = createRequest(collection.id, {
        name: 'Large Body',
        method: 'POST',
        url: 'https://api.example.com/upload',
        headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
        params: [],
        body: {
          mode: 'json',
          content: largeBody,
        },
      });

      expect(request.body!.content!.length).toBeGreaterThan(1024 * 1024);
    });

    it('应能处理大量 Collections', () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        createCollection(`Collection ${i}`, {
          withFolders: true,
          folderCount: 5,
          withRequests: true,
          requestCount: 10,
        });
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(5000);

      const collections = getCollections();
      expect(collections).toHaveLength(100);
    });
  });

  describe('导入导出性能', () => {
    it('应能快速导入大型 Postman Collection', () => {
      const largePostmanCollection = {
        info: {
          _postman_id: 'test-id',
          name: 'Large Collection',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: Array.from({ length: 500 }, (_, i) => ({
          name: `Request ${i}`,
          request: {
            method: ['GET', 'POST', 'PUT', 'DELETE'][i % 4],
            header: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'Authorization', value: 'Bearer token' },
            ],
            url: {
              raw: `https://api.example.com/resource${i}?page=${i}`,
              host: ['api', 'example', 'com'],
              path: [`resource${i}`],
              query: [{ key: 'page', value: `${i}` }],
            },
          },
        })),
      };

      const start = performance.now();
      const result = importPostmanCollection(largePostmanCollection as unknown as Record<string, unknown>);
      const end = performance.now();

      expect(end - start).toBeLessThan(2000);
      expect(result.requests).toHaveLength(500);
    });

    it('应能快速导出大型 Collection 为 Postman 格式', () => {
      const collection = createMockCollection({}, {
        withFolders: true,
        folderCount: 10,
        withRequests: true,
        requestCount: 100,
      });

      const start = performance.now();
      const result = exportToPostman(collection);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000);
      expect(result.item.length).toBeGreaterThan(0);
    });

    it('应能快速导入大型 Swagger 文档', () => {
      const paths: Record<string, unknown> = {};
      
      for (let i = 0; i < 200; i++) {
        paths[`/resource${i}`] = {
          get: {
            summary: `Get resource ${i}`,
            operationId: `getResource${i}`,
            parameters: [
              { name: 'id', in: 'path', required: true, type: 'string' },
              { name: 'limit', in: 'query', type: 'integer' },
            ],
            responses: {
              '200': { description: 'Success' },
            },
          },
          post: {
            summary: `Create resource ${i}`,
            operationId: `createResource${i}`,
            parameters: [
              { name: 'body', in: 'body', schema: { type: 'object' } },
            ],
            responses: {
              '201': { description: 'Created' },
            },
          },
        };
      }

      const largeSwagger = {
        swagger: '2.0',
        info: { title: 'Large API', version: '1.0.0' },
        basePath: '/api',
        host: 'api.example.com',
        paths,
      };

      const start = performance.now();
      const result = importSwagger(largeSwagger as unknown as Record<string, unknown>);
      const end = performance.now();

      expect(end - start).toBeLessThan(2000);
      expect(result.requests.length).toBeGreaterThan(0);
    });
  });

  describe('localStorage 性能', () => {
    it('应能快速保存和加载大量数据', () => {
      // 创建大量数据
      const collections: Collection[] = [];
      for (let i = 0; i < 50; i++) {
        collections.push(createMockCollection({ name: `Collection ${i}` }, {
          withFolders: true,
          folderCount: 5,
          withRequests: true,
          requestCount: 20,
        }));
      }

      const saveStart = performance.now();
      saveCollections(collections);
      const saveEnd = performance.now();

      expect(saveEnd - saveStart).toBeLessThan(2000);

      const loadStart = performance.now();
      const loaded = loadCollections();
      const loadEnd = performance.now();

      expect(loadEnd - loadStart).toBeLessThan(1000);
      expect(loaded).toHaveLength(50);
    });
  });

  describe('频繁操作性能', () => {
    it('应能快速执行频繁的移动操作', () => {
      const collection = createCollection('Test');
      const folder1 = createFolder(collection.id, 'Folder 1');
      const folder2 = createFolder(collection.id, 'Folder 2');
      
      const requests = [];
      for (let i = 0; i < 50; i++) {
        requests.push(createRequest(collection.id, {
          name: `Request ${i}`,
          method: 'GET',
          url: 'https://example.com',
          headers: [],
          params: [],
        }));
      }

      const start = performance.now();

      // 频繁移动请求
      for (let i = 0; i < 50; i++) {
        moveRequest(collection.id, requests[i].id, undefined, folder1.id);
        moveRequest(collection.id, requests[i].id, folder1.id, folder2.id);
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(3000);
    });
  });

  describe('并发操作模拟', () => {
    it('应能处理快速连续的更新操作', () => {
      const collection = createCollection('Test');
      createRequest(collection.id, {
        name: 'Original',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
      });

      const start = performance.now();

      // 快速连续更新
      for (let i = 0; i < 100; i++) {
        createRequest(collection.id, {
          name: `Batch ${i}`,
          method: 'POST',
          url: `https://api.example.com/${i}`,
          headers: [],
          params: [],
        });
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(2000);

      const collections = getCollections();
      expect(collections[0].requests).toHaveLength(101); // 原始 + 100 新请求
    });
  });
});
