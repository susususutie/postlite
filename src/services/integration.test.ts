// 集成测试 - 测试多个服务的协同工作
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseHeaders,
} from './http';
import{
  createCollection,
  updateCollection,
  deleteCollection,
  createRequest,
  createFolder,
  deleteFolder,
  getCollections,
  moveRequest,
} from './collection';
import{
  createEnvironment,
  setEnvironmentVariables,
  getEnvironmentById,
} from './environment';
import {
  replaceEnvironmentVariables,
  applyEnvToUrl,
  applyEnvToHeaders,
} from '../utils/environment';
import {
  importPostmanCollection,
  importSwagger,
} from '../utils/importers';
import {
  exportToPostman,
  exportToSwagger,
} from '../utils/exporters';
import {
  saveCollections,
  loadCollections,
  saveEnvironments,
  loadEnvironments,
} from '../store/storage';
import {
  createMockRequest,
  createMockCollection,
  createMockEnvironment,
  createMockPostmanCollection,
  createMockSwaggerDocument,
} from '../test/factories';

describe('集成测试 - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('完整的请求生命周期流程', () => {
    it('应能创建 Collection -> 添加环境变量 -> 创建请求 -> 应用环境变量 -> 发送请求', async () => {
      const collection = await createCollection('API Collection');
      expect(collection).toBeDefined();
      expect(collection.name).toBe('API Collection');

      const env = createEnvironment('Development');
      expect(env).toBeDefined();
      
      const envWithVars = setEnvironmentVariables(env.id, [
        { key: 'BASE_URL', value: 'https://api.example.com', type: 'string', enabled: true },
        { key: 'API_KEY', value: 'secret123', type: 'secret', enabled: true },
      ]);
      expect(envWithVars).toBeDefined();
      expect(envWithVars!.variables).toHaveLength(2);

      const request = await createRequest(
        collection.id,
        {
          name: 'Get Users',
          method: 'GET',
          url: '{{BASE_URL}}/users',
          headers: [
            { key: 'Authorization', value: 'Bearer {{API_KEY}}', enabled: true },
          ],
          params: [{ key: 'page', value: '1', enabled: true }],
        }
      );
      expect(request).toBeDefined();
      expect(request!.url).toBe('{{BASE_URL}}/users');

      const appliedUrl = applyEnvToUrl(request!.url, envWithVars!.variables);
      expect(appliedUrl).toBe('https://api.example.com/users');

      const headers = parseHeaders(request!.headers);
      const appliedHeaders = applyEnvToHeaders(headers, envWithVars!.variables);
      expect(appliedHeaders['Authorization']).toBe('Bearer secret123');
    });

    it('应能完成 Collection -> Folder -> Request 的嵌套创建流程', async () => {
      const collection = await createCollection('My API');
      
      const folder1 = await createFolder(collection.id, 'Auth APIs');
      expect(folder1).toBeDefined();
      
      const request1 = await createRequest(
        collection.id,
        {
          name: 'Login',
          method: 'POST',
          url: 'https://api.example.com/login',
          headers: [],
          params: [],
          body: {
            mode: 'json',
            content: JSON.stringify({ username: 'test', password: 'pass' }),
          },
        },
        folder1!.id
      );
      expect(request1).toBeDefined();

      const folder2 = await createFolder(collection.id, 'User APIs', folder1!.id);
      expect(folder2).toBeDefined();

      const request2 = await createRequest(
        collection.id,
        {
          name: 'Get Profile',
          method: 'GET',
          url: 'https://api.example.com/profile',
          headers: [{ key: 'Authorization', value: 'token', enabled: true }],
          params: [],
        },
        folder2!.id
      );
      expect(request2).toBeDefined();

      const collections = await getCollections();
      const savedCollection = collections.find(c => c.id === collection.id);
      expect(savedCollection).toBeDefined();
      expect(savedCollection!.folders).toHaveLength(1);
      expect(savedCollection!.folders[0].folders).toHaveLength(1);
    });
  });

  describe('导入导出完整流程', () => {
    it('应能导入 Postman Collection -> 修改 -> 导出为 Swagger', async () => {
      const postmanData = createMockPostmanCollection({
        info: {
          _postman_id: 'test-id',
          name: 'Test Import',
          description: 'Import test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Get Users',
            request: {
              method: 'GET',
              header: [],
              url: {
                raw: 'https://api.example.com/users',
                protocol: 'https',
                host: ['api', 'example', 'com'],
                path: ['users'],
              },
            },
          },
        ],
      });

      const imported = importPostmanCollection(postmanData);
      expect(imported).toBeDefined();
      expect(imported.name).toBe('Test Import');
      expect(imported.requests).toHaveLength(1);

      const importedCollection = await createCollection(imported.name, imported.description);
      for (const req of imported.requests) {
        await createRequest(importedCollection.id, req);
      }

      const updated = await updateCollection(importedCollection.id, { name: 'Modified Collection' });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Modified Collection');

      const swaggerExport = exportToSwagger(updated!);
      expect(swaggerExport.swagger).toBe('2.0');
      expect(swaggerExport.info.title).toBe('Modified Collection');
    });

    it('应能完成 Swagger -> Collection -> 添加环境变量 -> Postman 导出的流程', () => {
      const swaggerData = createMockSwaggerDocument({
        paths: {
          '/api/users': {
            get: {
              summary: 'List users',
              operationId: 'listUsers',
              parameters: [
                { name: 'page', in: 'query', type: 'integer' },
                { name: 'limit', in: 'query', type: 'integer' },
              ],
            },
            post: {
              summary: 'Create user',
              operationId: 'createUser',
              parameters: [
                { name: 'body', in: 'body', schema: { type: 'object' } },
              ],
            },
          },
        },
      });

      const imported = importSwagger(swaggerData);
      expect(imported).toBeDefined();
      expect(imported.requests).toHaveLength(2);

      createEnvironment('Production', true);

      const updatedRequests = imported.requests.map(req => ({
        ...req,
        url: req.url.replace('https://api.example.com', '{{API_HOST}}'),
      }));

      const collectionWithRequests = { ...imported, requests: updatedRequests };
      const postmanExport = exportToPostman(collectionWithRequests);
      expect(postmanExport.info.name).toBe(imported.name);
      expect(postmanExport.item).toHaveLength(2);
    });
  });

  describe('环境变量与请求集成', () => {
    it('应能在请求发送前正确应用环境变量到 URL、Headers 和 Body', () => {
      const env = createEnvironment('Test');
      const envWithVars = setEnvironmentVariables(env.id, [
        { key: 'BASE_URL', value: 'https://api.test.com', type: 'string', enabled: true },
        { key: 'AUTH_TOKEN', value: 'test-token-123', type: 'secret', enabled: true },
        { key: 'USER_ID', value: '12345', type: 'string', enabled: true },
      ]);

      const request = createMockRequest({
        url: '{{BASE_URL}}/users/{{USER_ID}}',
        headers: [
          { key: 'Authorization', value: 'Bearer {{AUTH_TOKEN}}', enabled: true },
          { key: 'Content-Type', value: 'application/json', enabled: true },
        ],
        body: {
          mode: 'json',
          content: JSON.stringify({ userId: '{{USER_ID}}', name: 'Test' }),
        },
      });

      const appliedUrl = applyEnvToUrl(request.url, envWithVars!.variables);
      expect(appliedUrl).toBe('https://api.test.com/users/12345');

      const headers = parseHeaders(request.headers);
      const appliedHeaders = applyEnvToHeaders(headers, envWithVars!.variables);
      expect(appliedHeaders['Authorization']).toBe('Bearer test-token-123');

      const appliedBody = request.body?.content 
        ? replaceEnvironmentVariables(request.body.content, envWithVars!.variables)
        : undefined;
      expect(appliedBody).toContain('12345');
    });

    it('应能正确切换环境并应用不同的变量值', () => {
      const devEnv = createEnvironment('Development');
      setEnvironmentVariables(devEnv.id, [
        { key: 'API_URL', value: 'https://dev.api.com', type: 'string', enabled: true },
        { key: 'DEBUG', value: 'true', type: 'string', enabled: true },
      ]);

      const prodEnv = createEnvironment('Production');
      setEnvironmentVariables(prodEnv.id, [
        { key: 'API_URL', value: 'https://prod.api.com', type: 'string', enabled: true },
        { key: 'DEBUG', value: 'false', type: 'string', enabled: true },
      ]);

      const urlTemplate = '{{API_URL}}/api/users';

      const devEnvWithVars = getEnvironmentById(devEnv.id);
      const prodEnvWithVars = getEnvironmentById(prodEnv.id);

      const devUrl = applyEnvToUrl(urlTemplate, devEnvWithVars!.variables);
      expect(devUrl).toBe('https://dev.api.com/api/users');

      const prodUrl = applyEnvToUrl(urlTemplate, prodEnvWithVars!.variables);
      expect(prodUrl).toBe('https://prod.api.com/api/users');
    });
  });

  describe('存储层集成', () => {
    it('应能正确持久化和恢复 Collection 及环境数据', () => {
      const collection = createMockCollection({}, { withRequests: true, requestCount: 3 });
      const env = createMockEnvironment({}, true, 5);

      saveCollections([collection]);
      saveEnvironments([env]);

      const loadedCollections = loadCollections();
      const loadedEnvs = loadEnvironments();

      expect(loadedCollections).toHaveLength(1);
      expect(loadedCollections[0].name).toBe(collection.name);
      expect(loadedCollections[0].requests).toHaveLength(3);

      expect(loadedEnvs).toHaveLength(1);
      const savedEnv = loadedEnvs.find(e => e.id === env.id);
      expect(savedEnv).toBeDefined();
      expect(savedEnv!.variables).toHaveLength(5);
    });

    it('应能在清除存储后正确重新创建数据', async () => {
      await createCollection('First');
      
      localStorage.clear();
      
      const secondCollection = await createCollection('Second');
      const collections = await getCollections();
      
      const found = collections.find(c => c.id === secondCollection.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('Second');
    });
  });

  describe('Request 移动和重组', () => {
    it('应能将 Request 从 Collection 移动到 Folder', async () => {
      const collection = await createCollection('Test Collection');
      const folder = await createFolder(collection.id, 'Test Folder');

      const request = await createRequest(
        collection.id,
        {
          name: 'Move Test',
          method: 'GET',
          url: 'https://example.com',
          headers: [],
          params: [],
        }
      );
      expect(request).toBeDefined();

      const moved = await moveRequest(collection.id, request!.id, undefined, folder!.id);
      expect(moved).toBe(true);

      const collections = await getCollections();
      const savedCollection = collections.find(c => c.id === collection.id);
      expect(savedCollection!.folders[0].folders.length).toBeGreaterThan(0);
      const targetFolder = savedCollection!.folders[0].folders.find(f => f.id === folder!.id);
      expect(targetFolder?.requests).toHaveLength(1);
      expect(targetFolder?.requests[0].id).toBe(request!.id);
    });

    it('应能将 Request 从一个 Folder 移动到另一个 Folder', async () => {
      const collection = await createCollection('Test');
      const folder1 = await createFolder(collection.id, 'Folder 1');
      const folder2 = await createFolder(collection.id, 'Folder 2');

      const request = await createRequest(
        collection.id,
        {
          name: 'Test Request',
          method: 'GET',
          url: 'https://example.com',
          headers: [],
          params: [],
        },
        folder1!.id
      );

      const moved = await moveRequest(collection.id, request!.id, folder1!.id, folder2!.id);
      expect(moved).toBe(true);

      const collections = await getCollections();
      const saved = collections.find(c => c.id === collection.id);
      const folder1Data = saved!.folders[0].folders.find(f => f.id === folder1!.id);
      const folder2Data = saved!.folders[0].folders.find(f => f.id === folder2!.id);
      expect(folder1Data?.requests).toHaveLength(0);
      expect(folder2Data?.requests).toHaveLength(1);
    });
  });

  describe('批量操作集成', () => {
    it('应能批量创建请求并验证存储', async () => {
      const collection = await createCollection('Batch Test');
      const requests = [];

      for (let i = 0; i < 10; i++) {
        const request = await createRequest(collection.id, {
          name: `Request ${i}`,
          method: i % 2 === 0 ? 'GET' : 'POST',
          url: `https://api.example.com/resource${i}`,
          headers: [],
          params: [],
        });
        requests.push(request!);
      }

      expect(requests).toHaveLength(10);
      expect(requests.every(r => r !== null)).toBe(true);

      const saved = await getCollections();
      expect(saved[0].requests).toHaveLength(10);
    });

    it('应能批量更新环境变量', () => {
      const env = createEnvironment('Batch Update');
      setEnvironmentVariables(env.id, [
        { key: 'VAR1', value: 'old1', type: 'string', enabled: true },
        { key: 'VAR2', value: 'old2', type: 'string', enabled: true },
        { key: 'VAR3', value: 'old3', type: 'string', enabled: true },
      ]);

      const updated = setEnvironmentVariables(env.id, [
        { key: 'VAR1', value: 'new1', type: 'string', enabled: true },
        { key: 'VAR2', value: 'new2', type: 'string', enabled: true },
        { key: 'VAR3', value: 'new3', type: 'string', enabled: true },
      ]);

      expect(updated).toBeDefined();
      expect(updated!.variables[0].value).toBe('new1');
      expect(updated!.variables[1].value).toBe('new2');
      expect(updated!.variables[2].value).toBe('new3');
    });
  });

  describe('错误处理和恢复', () => {
    it('应在删除 Collection 后正确处理依赖数据', async () => {
      const collection = await createCollection('To Delete');
      await createRequest(collection.id, {
        name: 'Request',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
      });

      const deleted = await deleteCollection(collection.id);
      expect(deleted).toBe(true);

      const collections = await getCollections();
      expect(collections).toHaveLength(0);
    });

    it('应在删除 Folder 后正确处理其中的请求', async () => {
      const collection = await createCollection('Test');
      const folder = await createFolder(collection.id, 'To Delete');
      
      await createRequest(collection.id, {
        name: 'Nested Request',
        method: 'POST',
        url: 'https://example.com',
        headers: [],
        params: [],
      }, folder!.id);

      const deleted = await deleteFolder(collection.id, folder!.id);
      expect(deleted).toBe(true);

      const saved = await getCollections();
      expect(saved[0].folders[0].folders).toHaveLength(0);
    });
  });

  describe('复杂场景集成', () => {
    it('应能处理完整的 API 测试工作流', async () => {
      const collection = await createCollection('E-Commerce API');
      const authFolder = await createFolder(collection.id, 'Authentication');
      const userFolder = await createFolder(collection.id, 'User Management');
      await createFolder(collection.id, 'Orders');

      await createRequest(collection.id, {
        name: 'Login',
        method: 'POST',
        url: '{{BASE_URL}}/auth/login',
        headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
        params: [],
        body: {
          mode: 'json',
          content: JSON.stringify({ email: '{{EMAIL}}', password: '{{PASSWORD}}' }),
        },
      }, authFolder!.id);

      await createRequest(collection.id, {
        name: 'Get User Profile',
        method: 'GET',
        url: '{{BASE_URL}}/users/{{USER_ID}}',
        headers: [
          { key: 'Authorization', value: 'Bearer {{AUTH_TOKEN}}', enabled: true },
        ],
        params: [],
      }, userFolder!.id);

      const env = await createEnvironment('Staging');
      setEnvironmentVariables(env.id, [
        { key: 'BASE_URL', value: 'https://staging.api.com', type: 'string', enabled: true },
        { key: 'EMAIL', value: 'test@example.com', type: 'string', enabled: true },
        { key: 'PASSWORD', value: 'testpass123', type: 'secret', enabled: true },
        { key: 'USER_ID', value: '12345', type: 'string', enabled: true },
        { key: 'AUTH_TOKEN', value: 'jwt-token-xyz', type: 'secret', enabled: true },
      ]);

      const saved = await getCollections();
      const savedCollection = saved.find(c => c.id === collection.id);
      
      expect(savedCollection).toBeDefined();
      expect(savedCollection!.folders[0].folders).toHaveLength(3);
      
      const authFolderSaved = savedCollection!.folders[0].folders.find(f => f.id === authFolder!.id);
      expect(authFolderSaved!.requests).toHaveLength(1);

      const request = authFolderSaved!.requests[0];
      const envWithVars = getEnvironmentById(env.id);
      const appliedUrl = applyEnvToUrl(request.url, envWithVars!.variables);
      expect(appliedUrl).toBe('https://staging.api.com/auth/login');
    });
  });
});
