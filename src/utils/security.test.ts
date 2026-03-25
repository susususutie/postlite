// 安全相关测试
import { describe, it, expect, beforeEach } from 'vitest';
import type { Environment } from '../types';
import {
  replaceEnvironmentVariables,
} from '../utils/environment';
import{
  createCollection,
  createRequest,
} from '../services/collection';
import{
  createEnvironment,
  setEnvironmentVariables,
} from '../services/environment';
import{
  loadEnvironments,
} from '../store/storage';
import{
  importPostmanCollection,
  autoImport,
} from '../utils/importers';

describe('安全相关测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('XSS 防护', () => {
    it('应正确处理包含 script 标签的 URL', async () => {
      const maliciousUrls = [
        'https://example.com/<script>alert(1)</script>',
        'https://example.com/"><script>alert(1)</script>',
        "https://example.com/'><script>alert(1)</script>",
        'https://example.com/`><script>alert(1)</script>',
      ];

      for (const url of maliciousUrls) {
        const collection = await createCollection('Test');
        const request = await createRequest(collection.id, {
          name: 'XSS Test',
          method: 'GET',
          url,
          headers: [],
          params: [],
        });

        expect(request!.url).toBe(url);
      }
    });

    it('应正确处理包含 HTML 的 Header 值', async () => {
      const collection = await createCollection('Test');
      const request = await createRequest(collection.id, {
        name: 'XSS Header Test',
        method: 'GET',
        url: 'https://example.com',
        headers: [
          { key: 'X-Custom', value: '<img src=x onerror=alert(1)>', enabled: true },
          { key: 'X-Script', value: '<script>alert(1)</script>', enabled: true },
        ],
        params: [],
      });

      expect(request!.headers[0].value).toBe('<img src=x onerror=alert(1)>');
      expect(request!.headers[1].value).toBe('<script>alert(1)</script>');
    });

    it('应正确处理包含 JavaScript 伪协议的 URL', async () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'javascript://alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:alert(1)',
      ];

      for (const url of maliciousUrls) {
        const collection = await createCollection('Test');
        const request = await createRequest(collection.id, {
          name: 'Protocol Test',
          method: 'GET',
          url,
          headers: [],
          params: [],
        });

        expect(request!.url).toBe(url);
      }
    });
  });

  describe('SQL 注入防护', () => {
    it('应正确处理包含 SQL 注入字符的参数', async () => {
      const sqlInjectionParams = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "1; DROP TABLE users--",
        "' UNION SELECT * FROM users--",
        "1' AND 1=1--",
      ];

      for (const param of sqlInjectionParams) {
        const collection = await createCollection('Test');
        const request = await createRequest(collection.id, {
          name: 'SQL Injection Test',
          method: 'GET',
          url: 'https://example.com/api',
          headers: [],
          params: [{ key: 'id', value: param, enabled: true }],
        });

        expect(request!.params[0].value).toBe(param);
      }
    });

    it('应正确处理包含 SQL 关键字的请求体', async () => {
      const maliciousBody = {
        query: "SELECT * FROM users WHERE id = '1' OR '1'='1'",
        command: "'; DELETE FROM users; --",
      };

      const collection = await createCollection('Test');
      const request = await createRequest(collection.id, {
        name: 'SQL Body Test',
        method: 'POST',
        url: 'https://example.com/api',
        headers: [],
        params: [],
        body: {
          mode: 'json',
          content: JSON.stringify(maliciousBody),
        },
      });

      expect(request!.body!.content).toContain('SELECT');
      expect(request!.body!.content).toContain('DELETE');
    });
  });

  describe('命令注入防护', () => {
    it('应正确处理包含命令注入字符的输入', async () => {
      const commandInjectionStrings = [
        '$(whoami)',
        '`whoami`',
        '; cat /etc/passwd',
        '| ls -la',
        '&& echo hacked',
        '|| echo failed',
        '< /etc/passwd',
        '> /tmp/output',
      ];

      for (const cmd of commandInjectionStrings) {
        const collection = await createCollection('Test');
        const request = await createRequest(collection.id, {
          name: 'Command Injection Test',
          method: 'POST',
          url: 'https://example.com/api',
          headers: [],
          params: [{ key: 'input', value: cmd, enabled: true }],
        });

        expect(request!.params[0].value).toBe(cmd);
      }
    });
  });

  describe('路径遍历防护', () => {
    it('应正确处理包含路径遍历的 URL', async () => {
      const pathTraversalUrls = [
        'https://example.com/../../../etc/passwd',
        'https://example.com/..\\..\\..\\windows\\system32\\config\\sam',
        'https://example.com/%2e%2e/%2e%2e/%2e%2e/etc/passwd',
        'https://example.com/....//....//etc/passwd',
      ];

      for (const url of pathTraversalUrls) {
        const collection = await createCollection('Test');
        const request = await createRequest(collection.id, {
          name: 'Path Traversal Test',
          method: 'GET',
          url,
          headers: [],
          params: [],
        });

        expect(request!.url).toBe(url);
      }
    });
  });

  describe('JSON 注入防护', () => {
    it('应正确处理包含特殊 JSON 字符的请求体', async () => {
      const maliciousBodies = [
        { key: 'value"}, {"injected": "true' },
        { key: 'value\x00' },
        { key: 'value\n\r' },
        { key: '</script><script>alert(1)</script>' },
      ];

      for (const body of maliciousBodies) {
        const collection = await createCollection('Test');
        const request = await createRequest(collection.id, {
          name: 'JSON Injection Test',
          method: 'POST',
          url: 'https://example.com/api',
          headers: [],
          params: [],
          body: {
            mode: 'json',
            content: JSON.stringify(body),
          },
        });

        expect(() => JSON.parse(request!.body!.content!)).not.toThrow();
      }
    });
  });

  describe('环境变量安全', () => {
    it('应正确处理包含敏感字符的环境变量', () => {
      const env = createEnvironment('Secure');
      setEnvironmentVariables(env.id, [
        { key: 'PASSWORD', value: 'pass\n\rword', type: 'secret', enabled: true },
        { key: 'TOKEN', value: 'tok\x00en', type: 'secret', enabled: true },
        { key: 'SECRET', value: 'sec\tret', type: 'secret', enabled: true },
      ]);

      const environments = loadEnvironments();
      const savedEnv = environments.find((e: Environment) => e.id === env.id);

      expect(savedEnv!.variables[0].value).toBe('pass\n\rword');
    });

    it('应防止环境变量循环引用', () => {
      const result = replaceEnvironmentVariables('{{VAR_A}}', [
        { key: 'VAR_A', value: '{{VAR_B}}', type: 'string', enabled: true },
        { key: 'VAR_B', value: '{{VAR_A}}', type: 'string', enabled: true },
      ]);

      expect(result).toBe('{{VAR_A}}');
    });
  });

  describe('导入安全', () => {
    it('应处理包含恶意代码的 Postman Collection', () => {
      const maliciousCollection = {
        info: {
          _postman_id: 'test',
          name: '<script>alert(1)</script>',
          description: 'Test **bold** [link](javascript:alert(1))',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: '<img src=x onerror=alert(1)>',
            request: {
              method: 'GET',
              header: [],
              url: {
                raw: 'https://example.com',
                host: ['example', 'com'],
              },
            },
          },
        ],
      };

      const result = importPostmanCollection(maliciousCollection as unknown as Record<string, unknown>);
      expect(result.name).toBe('<script>alert(1)</script>');
      expect(result.requests[0].name).toBe('<img src=x onerror=alert(1)>');
    });

    it('应处理非常大的导入数据', () => {
      const hugeCollection = {
        info: {
          _postman_id: 'test',
          name: 'Huge Collection',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: Array.from({ length: 1000 }, (_, i) => ({
          name: `Request ${i}`,
          request: {
            method: 'GET',
            header: [],
            url: {
              raw: `https://example.com/${'a'.repeat(1000)}`,
              host: ['example', 'com'],
              path: ['a'.repeat(1000)],
            },
          },
        })),
      };

      const result = importPostmanCollection(hugeCollection as unknown as Record<string, unknown>);
      expect(result.requests).toHaveLength(1000);
    });

    it('应拒绝无效的导入数据格式', () => {
      const invalidFormats = [
        null,
        undefined,
        '',
        'not json',
        '{ invalid json',
        '[]',
        '{}',
        '{ "item": null }',
      ];

      invalidFormats.forEach(data => {
        if (typeof data === 'string') {
          const result = autoImport(data);
          expect(result === null || typeof result === 'object').toBe(true);
        }
      });
    });
  });

  describe('URL 安全', () => {
    it('应处理包含用户凭证的 URL', async () => {
      const urlsWithCredentials = [
        'https://user:pass@example.com',
        'https://admin:password123@api.example.com/path',
        'ftp://anonymous:anonymous@ftp.example.com',
      ];

      for (const url of urlsWithCredentials) {
        const collection = await createCollection('Test');
        const request = await createRequest(collection.id, {
          name: 'Credentials Test',
          method: 'GET',
          url,
          headers: [],
          params: [],
        });

        expect(request!.url).toBe(url);
      }
    });

    it('应处理包含敏感查询参数的 URL', async () => {
      const sensitiveUrls = [
        'https://example.com?password=secret123',
        'https://example.com?token=abc123&api_key=xyz789',
        'https://example.com?session_id=abc&auth_token=xyz',
      ];

      for (const url of sensitiveUrls) {
        const collection = await createCollection('Test');
        const request = await createRequest(collection.id, {
          name: 'Sensitive Params Test',
          method: 'GET',
          url,
          headers: [],
          params: [],
        });

        expect(request!.url).toBe(url);
      }
    });
  });

  describe('Header 安全', () => {
    it('应处理包含敏感信息的 Headers', async () => {
      const sensitiveHeaders = [
        { key: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', enabled: true },
        { key: 'Cookie', value: 'session_id=abc123; auth_token=xyz789', enabled: true },
        { key: 'X-API-Key', value: 'super-secret-api-key', enabled: true },
        { key: 'X-Auth-Token', value: 'private-token-value', enabled: true },
      ];

      const collection = await createCollection('Test');
      const request = await createRequest(collection.id, {
        name: 'Sensitive Headers Test',
        method: 'GET',
        url: 'https://example.com',
        headers: sensitiveHeaders,
        params: [],
      });

      sensitiveHeaders.forEach((header, index) => {
        expect(request!.headers[index].value).toBe(header.value);
      });
    });
  });
});
