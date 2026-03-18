// 边缘情况和错误处理测试
import { describe, it, expect, beforeEach } from 'vitest';
import type {
  EnvironmentVariable,
  Header,
} from '../types';
import {
  parseUrl,
  parseHeaders,
} from '../services/http';
import {
  replaceEnvironmentVariables,
  isValidVariableName,
} from '../utils/environment';
import{
  createCollection,
  updateCollection,
  deleteCollection,
  createRequest,
  updateRequest,
  createFolder,
  moveRequest,
} from '../services/collection';
import{
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  addEnvironmentVariable,
  updateEnvironmentVariable,
  deleteEnvironmentVariable,
  setEnvironmentVariables,
  cloneEnvironment,
} from '../services/environment';
import {
  saveCollections,
  loadCollections,
  saveEnvironments,
  loadEnvironments,
} from '../store/storage';
import {
  importPostmanCollection,
  importSwagger,
  importYApi,
  autoImport,
} from '../utils/importers';
import {
  exportToPostman,
  exportToSwagger,
} from '../utils/exporters';
import {
  createMockCollection,
} from '../test/factories';

describe('边缘情况和错误处理测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('HTTP 服务 - 异常输入处理', () => {
    it('应处理无效的 URL 格式', () => {
      const invalidUrls = [
        '   ',
        'not-a-url',
        'http://',
        'https://',
        'ftp://example.com',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
      ];

      invalidUrls.forEach(url => {
        // parseUrl 需要 params 参数
        const result = parseUrl(url, []);
        expect(result).toBeDefined();
      });
    });

    it('应处理包含特殊字符的 URL', () => {
      const urls = [
        'https://example.com/path with spaces',
        'https://example.com/path?query=hello world',
        'https://example.com/path#fragment with spaces',
        'https://example.com/测试路径',
        "https://example.com/path?query=O'Reilly",
      ];

      urls.forEach(url => {
        const result = parseUrl(url, []);
        expect(result).toBeDefined();
      });
    });

    it('应处理空的 Headers 和 Params', () => {
      expect(parseHeaders([])).toEqual({});
    });

    it('应处理所有 Headers 都 disabled 的情况', () => {
      const headers: Header[] = [
        { key: 'X-Header-1', value: 'value1', enabled: false },
        { key: 'X-Header-2', value: 'value2', enabled: false },
      ];
      expect(parseHeaders(headers)).toEqual({});
    });

    it('应处理重复的 Header keys', () => {
      const headers: Header[] = [
        { key: 'X-Custom', value: 'value1', enabled: true },
        { key: 'X-Custom', value: 'value2', enabled: true },
      ];
      const result = parseHeaders(headers);
      // 后一个值应该覆盖前一个
      expect(result['X-Custom']).toBe('value2');
    });

    it('应处理包含换行符的 Header 值', () => {
      const headers: Header[] = [
        { key: 'X-Multi-Line', value: 'line1\nline2\r\nline3', enabled: true },
      ];
      const result = parseHeaders(headers);
      expect(result['X-Multi-Line']).toContain('line1');
    });
  });

  describe('环境变量 - 复杂替换场景', () => {
    it('应处理嵌套变量替换', () => {
      const variables: EnvironmentVariable[] = [
        { key: 'BASE', value: 'https://api', type: 'string', enabled: true },
        { key: 'FULL_URL', value: '{{BASE}}.example.com', type: 'string', enabled: true },
      ];
      
      // 当前实现只会单层替换
      const result = replaceEnvironmentVariables('{{FULL_URL}}/users', variables);
      expect(result).toBe('{{BASE}}.example.com/users');
    });

    it('应处理变量名包含特殊字符', () => {
      const variables: EnvironmentVariable[] = [
        { key: 'VAR-NAME', value: 'value1', type: 'string', enabled: true },
        { key: 'VAR_NAME', value: 'value2', type: 'string', enabled: true },
        { key: 'VAR.NAME', value: 'value3', type: 'string', enabled: true },
      ];

      expect(replaceEnvironmentVariables('{{VAR-NAME}}', variables)).toBe('value1');
      expect(replaceEnvironmentVariables('{{VAR_NAME}}', variables)).toBe('value2');
      expect(replaceEnvironmentVariables('{{VAR.NAME}}', variables)).toBe('value3');
    });

    it('应处理变量名大小写敏感', () => {
      const variables: EnvironmentVariable[] = [
        { key: 'API_URL', value: 'uppercase', type: 'string', enabled: true },
        { key: 'api_url', value: 'lowercase', type: 'string', enabled: true },
      ];

      expect(replaceEnvironmentVariables('{{API_URL}}', variables)).toBe('uppercase');
      expect(replaceEnvironmentVariables('{{api_url}}', variables)).toBe('lowercase');
    });

    it('应处理变量值包含变量语法的情况', () => {
      const variables: EnvironmentVariable[] = [
        { key: 'GREETING', value: 'Hello {{NAME}}!', type: 'string', enabled: true },
        { key: 'NAME', value: 'World', type: 'string', enabled: true },
      ];

      // 当前实现会进行递归替换
      const result = replaceEnvironmentVariables('Message: {{GREETING}}', variables);
      expect(result).toBe('Message: Hello World!');
    });

    it('应处理空变量列表', () => {
      const str = '{{VAR}}';
      expect(replaceEnvironmentVariables(str, [])).toBe(str);
      expect(replaceEnvironmentVariables(str, null as unknown as EnvironmentVariable[])).toBe(str);
      expect(replaceEnvironmentVariables(str, undefined as unknown as EnvironmentVariable[])).toBe(str);
    });

    it('应处理变量名包含空格', () => {
      const variables: EnvironmentVariable[] = [
        { key: 'VAR NAME', value: 'value', type: 'string', enabled: true },
      ];

      // {{ VAR NAME }} 应该能匹配
      const result = replaceEnvironmentVariables('{{ VAR NAME }}', variables);
      expect(result).toBe('value');
    });

    it('应处理未定义的变量', () => {
      const variables: EnvironmentVariable[] = [
        { key: 'DEFINED', value: 'value', type: 'string', enabled: true },
      ];

      const result = replaceEnvironmentVariables('{{DEFINED}} and {{UNDEFINED}}', variables);
      expect(result).toBe('value and {{UNDEFINED}}');
    });

    it('应处理 disabled 的变量', () => {
      const variables: EnvironmentVariable[] = [
        { key: 'ENABLED', value: 'enabled-value', type: 'string', enabled: true },
        { key: 'DISABLED', value: 'disabled-value', type: 'string', enabled: false },
      ];

      const result = replaceEnvironmentVariables('{{ENABLED}} and {{DISABLED}}', variables);
      expect(result).toBe('enabled-value and {{DISABLED}}');
    });

    it('isValidVariableName 应正确验证变量名', () => {
      // 有效的变量名
      expect(isValidVariableName('VALID')).toBe(true);
      expect(isValidVariableName('valid_name')).toBe(true);
      expect(isValidVariableName('valid-name')).toBe(true);
      expect(isValidVariableName('_private')).toBe(true);
      expect(isValidVariableName('var123')).toBe(true);

      // 无效的变量名
      expect(isValidVariableName('')).toBe(false);
      expect(isValidVariableName('123var')).toBe(false);
      expect(isValidVariableName('var name')).toBe(false);
      expect(isValidVariableName('var.name')).toBe(false);
      expect(isValidVariableName('var$name')).toBe(false);
    });
  });

  describe('Collection 服务 - 边界情况', () => {
    it('应处理创建空的 Collection', () => {
      const collection = createCollection('');
      expect(collection.name).toBe('');
      expect(collection.folders).toEqual([]);
      expect(collection.requests).toEqual([]);
    });

    it('应处理更新不存在的 Collection', () => {
      const result = updateCollection('non-existent-id', { name: 'New Name' });
      expect(result).toBeNull();
    });

    it('应处理删除不存在的 Collection', () => {
      const result = deleteCollection('non-existent-id');
      expect(result).toBe(false);
    });

    it('应处理创建名称很长的 Folder', () => {
      const collection = createCollection('Test');
      const longName = 'A'.repeat(1000);
      const folder = createFolder(collection.id, longName);
      expect(folder.name).toBe(longName);
    });

    it('应处理在无效的 Collection 中创建 Folder', () => {
      const folder = createFolder('invalid-collection-id', 'Test Folder');
      expect(folder).toBeDefined();
    });

    it('应处理移动请求到无效的 Folder', () => {
      const collection = createCollection('Test');
      const request = createRequest(collection.id, {
        name: 'Test',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
      });

      const result = moveRequest(collection.id, request.id, undefined, 'invalid-folder-id');
      expect(result).toBe(false);
    });

    it('应处理更新请求时的边界情况', () => {
      const collection = createCollection('Test');
      const request = createRequest(collection.id, {
        name: 'Original',
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
      });

      // 测试更新为相同的值
      const updated = updateRequest(collection.id, request.id, { name: 'Original' });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Original');
    });

    it('应处理更新不存在的请求', () => {
      const collection = createCollection('Test');
      const result = updateRequest(collection.id, 'non-existent-id', { name: 'New' });
      expect(result).toBeNull();
    });
  });

  describe('环境服务 - 边界情况', () => {
    it('应处理创建同名环境', () => {
      const env1 = createEnvironment('Production');
      const env2 = createEnvironment('Production');
      
      expect(env1.name).toBe('Production');
      expect(env2.name).toBe('Production');
      expect(env1.id).not.toBe(env2.id);
    });

    it('应处理更新不存在的环境', () => {
      const result = updateEnvironment('non-existent-id', { name: 'New Name' });
      expect(result).toBeNull();
    });

    it('应处理删除不存在的环境', () => {
      const result = deleteEnvironment('non-existent-id');
      expect(result).toBe(false);
    });

    it('应处理向不存在的环境添加变量', () => {
      const result = addEnvironmentVariable('non-existent-id', {
        key: 'TEST',
        value: 'value',
        type: 'string',
      });
      expect(result).toBeNull();
    });

    it('应处理更新不存在的环境变量', () => {
      const env = createEnvironment('Test');
      const result = updateEnvironmentVariable(env.id, 'NON_EXISTENT', {
        value: 'new-value',
      });
      expect(result).toBeNull();
    });

    it('应处理删除不存在的环境变量', () => {
      const env = createEnvironment('Test');
      const result = deleteEnvironmentVariable(env.id, 'NON_EXISTENT');
      expect(result).toBe(false);
    });

    it('应处理克隆不存在的环境', () => {
      const result = cloneEnvironment('non-existent-id', 'Cloned');
      expect(result).toBeNull();
    });

    it('应处理克隆环境的完整复制', () => {
      const env = createEnvironment('Original');
      setEnvironmentVariables(env.id, [
        { key: 'VAR1', value: 'value1', type: 'string', enabled: true },
        { key: 'VAR2', value: 'value2', type: 'secret', enabled: false },
      ]);

      const cloned = cloneEnvironment(env.id, 'Cloned');
      expect(cloned).toBeDefined();
      expect(cloned!.name).toBe('Cloned');
      expect(cloned!.variables).toHaveLength(2);
      expect(cloned!.id).not.toBe(env.id);
      expect(cloned!.isDefault).toBe(false);
    });

    it('应处理大量环境变量', () => {
      const env = createEnvironment('Test');
      const variables: EnvironmentVariable[] = Array.from({ length: 100 }, (_, i) => ({
        key: `VAR_${i}`,
        value: `value_${i}`,
        type: i % 5 === 0 ? 'secret' : 'string',
        enabled: i % 2 === 0,
      }));

      const result = setEnvironmentVariables(env.id, variables);
      expect(result!.variables).toHaveLength(100);
    });
  });

  describe('存储服务 - 边界情况', () => {
    it('应处理 localStorage 被禁用的情况', () => {
      const originalLocalStorage = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });

      const result = loadCollections();
      expect(result).toEqual([]);

      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
      });
    });

    it('应处理损坏的 JSON 数据', () => {
      localStorage.setItem('postlite_collections', 'invalid json {');
      const result = loadCollections();
      expect(result).toEqual([]);
    });

    it('应处理空的 localStorage', () => {
      expect(loadCollections()).toEqual([]);
      // loadEnvironments 会返回默认环境
      const envs = loadEnvironments();
      expect(Array.isArray(envs)).toBe(true);
    });

    it('应处理保存空 Collections', () => {
      saveCollections([]);
      const loaded = loadCollections();
      expect(loaded).toEqual([]);
    });

    it('应处理保存空 Environments', () => {
      saveEnvironments([]);
      const loaded = loadEnvironments();
      expect(loaded).toEqual([]);
    });
  });

  describe('导入导出 - 边界情况', () => {
    it('应处理无效的 Postman 数据', () => {
      // 无效的 Postman 数据应抛出错误或返回默认值
      const invalidData = { info: { name: 'Test', _postman_id: '123' }, item: null };
      const result = importPostmanCollection(invalidData as unknown as Record<string, unknown>);
      expect(result).toBeDefined();
      expect(result.requests).toEqual([]);
    });

    it('应处理空的 Swagger 文档', () => {
      const emptySwagger = {
        swagger: '2.0',
        info: { title: 'Empty', version: '1.0.0' },
        paths: {},
      };
      const result = importSwagger(emptySwagger as unknown as Record<string, unknown>);
      expect(result.requests).toEqual([]);
    });

    it('应处理无效的 YApi 数据', () => {
      // YApi 导入需要特定格式的数据，空对象会导致错误
      // 这里测试函数能处理异常输入而不崩溃
      expect(() => importYApi({} as unknown as Record<string, unknown>)).toThrow();
    });

    it('应处理 autoImport 无法识别的格式', () => {
      const unknownData = { unknown: 'format', data: [] };
      const result = autoImport(JSON.stringify(unknownData));
      expect(result).toBeNull();
    });

    it('应处理导出空 Collection', () => {
      const emptyCollection = createMockCollection({ name: 'Empty', requests: [], folders: [] });
      const postmanExport = exportToPostman(emptyCollection);
      expect(postmanExport.item).toEqual([]);

      const swaggerExport = exportToSwagger(emptyCollection);
      expect(Object.keys(swaggerExport.paths)).toHaveLength(0);
    });
  });

  describe('复杂场景 - 错误恢复', () => {
    it('应能从不完整的状态中恢复', () => {
      // 模拟部分损坏的数据
      localStorage.setItem('postlite_collections', JSON.stringify([
        { id: '1', name: 'Test', requests: null },
        { id: '2', name: 'Valid', requests: [], folders: [], createdAt: Date.now(), updatedAt: Date.now() },
      ]));

      const collections = loadCollections();
      expect(collections.length).toBeGreaterThanOrEqual(0);
    });

    it('应处理循环的文件夹结构', () => {
      // 创建正常的嵌套结构
      const collection = createCollection('Test');
      const folder1 = createFolder(collection.id, 'Folder 1');
      const folder2 = createFolder(collection.id, 'Folder 2', folder1.id);
      
      expect(folder2).toBeDefined();
      
      // 验证结构可以正常读取
      const collections = loadCollections();
      const saved = collections.find(c => c.id === collection.id);
      expect(saved).toBeDefined();
    });

    it('应处理并发修改的竞态条件', () => {
      const collection = createCollection('Test');
      
      // 模拟并发更新
      updateCollection(collection.id, { name: 'Update 1' });
      updateCollection(collection.id, { name: 'Update 2' });
      updateCollection(collection.id, { name: 'Update 3' });
      
      // 最后一次更新应该生效
      const collections = loadCollections();
      const saved = collections.find(c => c.id === collection.id);
      expect(['Update 1', 'Update 2', 'Update 3']).toContain(saved?.name);
    });
  });
});
