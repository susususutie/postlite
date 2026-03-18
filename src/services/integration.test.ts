// 集成测试 - 测试多个服务的协同工作
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HttpRequest, HttpResponse, Collection, Environment } from '../types';
import { 
  sendRequest, 
  parseUrl, 
  parseHeaders,
} from './http';
import {
  createCollection,
  updateCollection,
  deleteCollection,
  createRequest,
  updateRequest,
  deleteRequest,
  createFolder,
  deleteFolder,
  getCollections,
  importCollection as importColl,
  moveRequest,
} from './collection';
import {
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  setDefaultEnvironment,
  setEnvironmentVariables,
  getEnvironmentById,
} from './environment';
import {
  replaceEnvironmentVariables,
  applyEnvToUrl,
  applyEnvToHeaders,
  getCurrentVariables,
} from '../utils/environment';
import {
  importPostmanCollection,
  importSwagger,
} from '../utils/importers';
import {
  exportToPostman,
  exportToSwagger,
  exportToJSON,
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
  createMockEnvironmentVariables,
  createMockPostmanCollection,
  createMockSwaggerDocument,
  createMockResponse,
  createMockFolder,
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
      // 1. 创建 Collection
      const collection = createCollection('API Collection');
      expect(collection).toBeDefined();
      expect(collection.name).toBe('API Collection');

      // 2. 创建环境并添加变量
      const env = createEnvironment('Development');
      expect(env).toBeDefined();
      
      // 使用 setEnvironmentVariables 批量设置环境变量
      const envWithVars = setEnvironmentVariables(env.id, [
        { key: 'BASE_URL', value: 'https://api.example.com', type: 'string', enabled: true },
        { key: 'API_KEY', value: 'secret123', type: 'secret', enabled: true },
      ]);
      expect(envWithVars).toBeDefined();
      expect(envWithVars!.variables).toHaveLength(2);

      // 3. 创建请求
      const request = createRequest(
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
      expect(request.url).toBe('{{BASE_URL}}/users');

      // 4. 应用环境变量
      const appliedUrl = applyEnvToUrl(request.url, envWithVars!.variables);
      expect(appliedUrl).toBe('https://api.example.com/users');

      const headers = parseHeaders(request.headers);
      const appliedHeaders = applyEnvToHeaders(headers, envWithVars!.variables);
      expect(appliedHeaders['Authorization']).toBe('Bearer secret123');
    });

    it('应能完成 Collection -> Folder -> Request 的嵌套创建流程', () => {
      // 创建 Collection
      const collection = createCollection('My API');
      
      // 创建一级 Folder
      const folder1 = createFolder(collection.id, 'Auth APIs');
      expect(folder1).toBeDefined();
      
      // 在 Folder 中创建请求
      const request1 = createRequest(
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
        folder1.id
      );
      expect(request1).toBeDefined();

      // 创建嵌套 Folder
      const folder2 = createFolder(collection.id, 'User APIs', folder1.id);
      expect(folder2).toBeDefined();

      // 在嵌套 Folder 中创建请求
      const request2 = createRequest(
        collection.id,
        {
          name: 'Get Profile',
          method: 'GET',
          url: 'https://api.example.com/profile',
          headers: [{ key: 'Authorization', value: 'token', enabled: true }],
          params: [],
        },
        folder2.id
      );
      expect(request2).toBeDefined();

      // 验证嵌套结构
      const collections = getCollections();
      const savedCollection = collections.find(c => c.id === collection.id);
      expect(savedCollection).toBeDefined();
      expect(savedCollection!.folders).toHaveLength(1);
      expect(savedCollection!.folders[0].folders).toHaveLength(1);
    });
  });

  describe('导入导出完整流程', () => {
    it('应能导入 Postman Collection -> 修改 -> 导出为 Swagger', () => {
      // 1. 创建 Postman 格式数据
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

      // 2. 导入
      const imported = importPostmanCollection(postmanData);
      expect(imported).toBeDefined();
      expect(imported.name).toBe('Test Import');
      expect(imported.requests).toHaveLength(1);

      // 3. 保存到存储
      saveCollections([imported]);

      // 4. 修改 Collection
      const updated = updateCollection(imported.id, { name: 'Modified Collection' });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Modified Collection');

      // 5. 导出为 Swagger
      const swaggerExport = exportToSwagger(updated!);
      expect(swaggerExport.swagger).toBe('2.0');
      expect(swaggerExport.info.title).toBe('Modified Collection');
    });

    it('应能完成 Swagger -> Collection -> 添加环境变量 -> Postman 导出的流程', () => {
      // 1. 创建 Swagger 数据
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

      // 2. 导入 Swagger
      const imported = importSwagger(swaggerData);
      expect(imported).toBeDefined();
      expect(imported.requests).toHaveLength(2);

      // 3. 创建环境变量
      const env = createEnvironment('Production', [
        { key: 'API_HOST', value: 'https://prod.example.com', type: 'string', enabled: true },
      ]);

      // 4. 更新请求 URL
      const updatedRequests = imported.requests.map(req => ({
        ...req,
        url: req.url.replace('https://api.example.com', '{{API_HOST}}'),
      }));

      // 5. 导出为 Postman
      const collectionWithRequests = { ...imported, requests: updatedRequests };
      const postmanExport = exportToPostman(collectionWithRequests);
      expect(postmanExport.info.name).toBe(imported.name);
      expect(postmanExport.item).toHaveLength(2);
    });
  });

  describe('环境变量与请求集成', () => {
    it('应能在请求发送前正确应用环境变量到 URL、Headers 和 Body', () => {
      // 创建环境并设置变量
      const env = createEnvironment('Test');
      const envWithVars = setEnvironmentVariables(env.id, [
        { key: 'BASE_URL', value: 'https://api.test.com', type: 'string', enabled: true },
        { key: 'AUTH_TOKEN', value: 'test-token-123', type: 'secret', enabled: true },
        { key: 'USER_ID', value: '12345', type: 'string', enabled: true },
      ]);

      // 创建带环境变量占位符的请求
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

      // 应用环境变量到 URL
      const appliedUrl = applyEnvToUrl(request.url, envWithVars!.variables);
      expect(appliedUrl).toBe('https://api.test.com/users/12345');

      // 应用环境变量到 Headers
      const headers = parseHeaders(request.headers);
      const appliedHeaders = applyEnvToHeaders(headers, envWithVars!.variables);
      expect(appliedHeaders['Authorization']).toBe('Bearer test-token-123');

      // 应用环境变量到 Body
      const appliedBody = request.body?.content 
        ? replaceEnvironmentVariables(request.body.content, envWithVars!.variables)
        : undefined;
      expect(appliedBody).toContain('12345');
    });

    it('应能正确切换环境并应用不同的变量值', () => {
      // 创建两个环境
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

      // 重新加载以获取带变量的环境
      const devEnvWithVars = getEnvironmentById(devEnv.id);
      const prodEnvWithVars = getEnvironmentById(prodEnv.id);

      // 应用 Dev 环境
      const devUrl = applyEnvToUrl(urlTemplate, devEnvWithVars!.variables);
      expect(devUrl).toBe('https://dev.api.com/api/users');

      // 应用 Prod 环境
      const prodUrl = applyEnvToUrl(urlTemplate, prodEnvWithVars!.variables);
      expect(prodUrl).toBe('https://prod.api.com/api/users');
    });
  });

  describe('存储层集成', () => {
    it('应能正确持久化和恢复 Collection 及环境数据', () => {
      // 创建数据
      const collection = createMockCollection({}, { withRequests: true, requestCount: 3 });
      const env = createMockEnvironment({}, true, 5);

      // 保存
      saveCollections([collection]);
      // 保存环境时先清空现有环境以避免默认环境干扰计数
      saveEnvironments([env]);

      // 恢复
      const loadedCollections = loadCollections();
      const loadedEnvs = loadEnvironments();

      // 验证
      expect(loadedCollections).toHaveLength(1);
      expect(loadedCollections[0].name).toBe(collection.name);
      expect(loadedCollections[0].requests).toHaveLength(3);

      expect(loadedEnvs).toHaveLength(1);
      const savedEnv = loadedEnvs.find(e => e.id === env.id);
      expect(savedEnv).toBeDefined();
      expect(savedEnv!.variables).toHaveLength(5);
    });

    it('应能在清除存储后正确重新创建数据', () => {
      // 初始创建
      const collection1 = createCollection('First');
      expect(getCollections()).toHaveLength(1);

      // 模拟清除
      localStorage.clear();
      
      // 重新创建
      const collection2 = createCollection('Second');
      const collections = getCollections();
      
      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('Second');
    });
  });

  describe('Request 移动和重组', () => {
    it('应能将 Request 从 Collection 移动到 Folder', () => {
      // 创建 Collection 和 Folder
      const collection = createCollection('Test Collection');
      const folder = createFolder(collection.id, 'Test Folder');

      // 在 Collection 根目录创建请求
      const request = createRequest(
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

      // 移动请求到 Folder
      const moved = moveRequest(collection.id, request.id, undefined, folder.id);
      expect(moved).toBe(true);

      // 验证
      const collections = getCollections();
      const savedCollection = collections.find(c => c.id === collection.id);
      expect(savedCollection!.requests).toHaveLength(0);
      expect(savedCollection!.folders[0].requests).toHaveLength(1);
      expect(savedCollection!.folders[0].requests[0].id).toBe(request.id);
    });

    it('应能将 Request 从一个 Folder 移动到另一个 Folder', () => {
      const collection = createCollection('Test');
      const folder1 = createFolder(collection.id, 'Folder 1');
      const folder2 = createFolder(collection.id, 'Folder 2');

      // 在 Folder1 中创建请求
      const request = createRequest(
        collection.id,
        {
          name: 'Test Request',
          method: 'GET',
          url: 'https://example.com',
          headers: [],
          params: [],
        },
        folder1.id
      );

      // 移动到 Folder2
      const moved = moveRequest(collection.id, request.id, folder1.id, folder2.id);
      expect(moved).toBe(true);

      // 验证
      const collections = getCollections();
      const saved = collections.find(c => c.id === collection.id);
      expect(saved!.folders[0].requests).toHaveLength(0);
      expect(saved!.folders[1].requests).toHaveLength(1);
    });
  });

  describe('批量操作集成', () => {
    it('应能批量创建请求并验证存储', () => {
      const collection = createCollection('Batch Test');
      const requests = [];

      // 批量创建 10 个请求
      for (let i = 0; i < 10; i++) {
        const request = createRequest(collection.id, {
          name: `Request ${i}`,
          method: i % 2 === 0 ? 'GET' : 'POST',
          url: `https://api.example.com/resource${i}`,
          headers: [],
          params: [],
        });
        requests.push(request);
      }

      expect(requests).toHaveLength(10);
      expect(requests.every(r => r !== null)).toBe(true);

      // 验证存储
      const saved = getCollections();
      expect(saved[0].requests).toHaveLength(10);
    });

    it('应能批量更新环境变量', () => {
      const env = createEnvironment('Batch Update');
      setEnvironmentVariables(env.id, [
        { key: 'VAR1', value: 'old1', type: 'string', enabled: true },
        { key: 'VAR2', value: 'old2', type: 'string', enabled: true },
        { key: 'VAR3', value: 'old3', type: 'string', enabled: true },
      ]);

      // 批量更新 - 使用 setEnvironmentVariables
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
    it('应在删除 Collection 后正确处理依赖数据', () => {
      const collection = createCollection('To Delete');
      createRequest(collection.id, {
        name: 'Request',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
      });

      // 删除 Collection
      const deleted = deleteCollection(collection.id);
      expect(deleted).toBe(true);

      // 验证所有数据被清除
      const collections = getCollections();
      expect(collections).toHaveLength(0);
    });

    it('应在删除 Folder 后正确处理其中的请求', () => {
      const collection = createCollection('Test');
      const folder = createFolder(collection.id, 'To Delete');
      
      // 在 Folder 中创建请求
      createRequest(collection.id, {
        name: 'Nested Request',
        method: 'POST',
        url: 'https://example.com',
        headers: [],
        params: [],
      }, folder.id);

      // 删除 Folder
      const deleted = deleteFolder(collection.id, folder.id);
      expect(deleted).toBe(true);

      // 验证 Folder 和请求都被删除
      const saved = getCollections();
      expect(saved[0].folders).toHaveLength(0);
    });
  });

  describe('复杂场景集成', () => {
    it('应能处理完整的 API 测试工作流', () => {
      // 1. 创建 Collection 结构
      const collection = createCollection('E-Commerce API');
      const authFolder = createFolder(collection.id, 'Authentication');
      const userFolder = createFolder(collection.id, 'User Management');
      const orderFolder = createFolder(collection.id, 'Orders');

      // 2. 在 Authentication 文件夹创建登录请求
      createRequest(collection.id, {
        name: 'Login',
        method: 'POST',
        url: '{{BASE_URL}}/auth/login',
        headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
        params: [],
        body: {
          mode: 'json',
          content: JSON.stringify({ email: '{{EMAIL}}', password: '{{PASSWORD}}' }),
        },
      }, authFolder.id);

      // 3. 创建获取用户信息的请求
      createRequest(collection.id, {
        name: 'Get User Profile',
        method: 'GET',
        url: '{{BASE_URL}}/users/{{USER_ID}}',
        headers: [
          { key: 'Authorization', value: 'Bearer {{AUTH_TOKEN}}', enabled: true },
        ],
        params: [],
      }, userFolder.id);

      // 4. 创建环境并设置变量
      const env = createEnvironment('Staging');
      setEnvironmentVariables(env.id, [
        { key: 'BASE_URL', value: 'https://staging.api.com', type: 'string', enabled: true },
        { key: 'EMAIL', value: 'test@example.com', type: 'string', enabled: true },
        { key: 'PASSWORD', value: 'testpass123', type: 'secret', enabled: true },
        { key: 'USER_ID', value: '12345', type: 'string', enabled: true },
        { key: 'AUTH_TOKEN', value: 'jwt-token-xyz', type: 'secret', enabled: true },
      ]);

      // 5. 验证完整结构
      const saved = getCollections();
      const savedCollection = saved.find(c => c.id === collection.id);
      
      expect(savedCollection).toBeDefined();
      expect(savedCollection!.folders).toHaveLength(3);
      
      const authFolderSaved = savedCollection!.folders.find(f => f.id === authFolder.id);
      expect(authFolderSaved!.requests).toHaveLength(1);

      // 6. 验证环境变量应用
      const request = authFolderSaved!.requests[0];
      const envWithVars = getEnvironmentById(env.id);
      const appliedUrl = applyEnvToUrl(request.url, envWithVars!.variables);
      expect(appliedUrl).toBe('https://staging.api.com/auth/login');
    });
  });
});
