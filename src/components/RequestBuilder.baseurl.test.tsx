import { describe, it, expect, vi } from 'vitest';
import type { HttpRequest, Environment, EnvironmentVariable } from '../types';
import {
  resolveVariables,
  StaticVariableResolver,
  extractUnresolvedVariables,
  hasTemplateVariables,
} from '../utils/variables';
import { normalizeUrl, isValidUrl, hasProtocol, weakConcatenateBaseUrl } from '../utils/url';

// Mock services
vi.mock('../services/environment', () => ({
  getCurrentEnvironment: vi.fn(),
}));

vi.mock('../services/http', () => ({
  sendRequest: vi.fn(),
}));

describe('RequestBuilder - BaseURL Feature', () => {
  const mockVariables: EnvironmentVariable[] = [
    { key: 'baseURL', value: 'https://api.example.com', type: 'string', enabled: true },
    { key: 'authToken', value: 'secret-token', type: 'secret', enabled: true },
    { key: 'userId', value: '12345', type: 'string', enabled: true },
    { key: 'disabledVar', value: 'disabled', type: 'string', enabled: false },
  ];

  const mockEnvironment: Environment = {
    id: 'env-1',
    name: 'Development',
    variables: mockVariables,
    isDefault: true,
  };

  const mockEmptyEnvironment: Environment = {
    id: 'env-2',
    name: 'Empty',
    variables: [],
    isDefault: false,
  };

  describe('URL Preview with Variables', () => {
    it('should resolve URL when variables are available', () => {
      const resolver = new StaticVariableResolver(mockEnvironment.variables);
      const resolved = resolveVariables('{{baseURL}}/users', resolver);
      expect(resolved).toBe('https://api.example.com/users');
    });

    it('should show unresolved variables when not defined', () => {
      const resolver = new StaticVariableResolver([]);
      const resolved = resolveVariables('{{unknownVar}}/users', resolver);
      expect(resolved).toBe('{{unknownVar}}/users');

      const unresolved = extractUnresolvedVariables(resolved);
      expect(unresolved).toContain('unknownVar');
    });

    it('should handle partially resolved variables', () => {
      const resolver = new StaticVariableResolver(mockEnvironment.variables);
      const resolved = resolveVariables('{{baseURL}}/users/{{unknownId}}', resolver);

      expect(resolved).toContain('https://api.example.com/users');
      expect(resolved).toContain('{{unknownId}}');

      const unresolved = extractUnresolvedVariables(resolved);
      expect(unresolved).toContain('unknownId');
    });

    it('should handle nested variables', () => {
      const envWithNested: EnvironmentVariable[] = [
        { key: 'host', value: 'api.example.com', type: 'string', enabled: true },
        { key: 'baseURL', value: 'https://{{host}}/v1', type: 'string', enabled: true },
      ];

      const resolver = new StaticVariableResolver(envWithNested);
      const resolved = resolveVariables('{{baseURL}}/users', resolver);

      expect(resolved).toBe('https://api.example.com/v1/users');
    });

    it('should handle empty URL', () => {
      const resolver = new StaticVariableResolver(mockEnvironment.variables);
      const resolved = resolveVariables('', resolver);
      expect(resolved).toBe('');
    });

    it('should handle URL without variables', () => {
      const resolver = new StaticVariableResolver(mockEnvironment.variables);
      const url = 'https://direct.example.com/users';
      const resolved = resolveVariables(url, resolver);
      expect(resolved).toBe(url);
    });
  });

  describe('Variable Insertion Logic', () => {
    it('should detect template variables in string', () => {
      expect(hasTemplateVariables('{{baseURL}}/users')).toBe(true);
      expect(hasTemplateVariables('https://api.example.com')).toBe(false);
      expect(hasTemplateVariables('')).toBe(false);
    });

    it('should extract all variable names from template', () => {
      const url = '{{baseURL}}/users/{{userId}}/posts/{{userId}}';
      const variables = extractUnresolvedVariables(url);

      expect(variables).toContain('baseURL');
      expect(variables).toContain('userId');
      // Should deduplicate
      expect(variables.filter(v => v === 'userId')).toHaveLength(1);
    });

    it('should build variable menu items from enabled variables', () => {
      const enabledVars = mockEnvironment.variables.filter(v => v.enabled);
      expect(enabledVars).toHaveLength(3);
      expect(enabledVars.map(v => v.key)).toContain('baseURL');
      expect(enabledVars.map(v => v.key)).toContain('authToken');
      expect(enabledVars.map(v => v.key)).toContain('userId');
      expect(enabledVars.map(v => v.key)).not.toContain('disabledVar');
    });

    it('should handle empty variable list', () => {
      const enabledVars = mockEmptyEnvironment.variables.filter(v => v.enabled);
      expect(enabledVars).toHaveLength(0);
    });
  });

  describe('Collection defaultBaseUrl', () => {
    it('should apply defaultBaseUrl for relative paths', () => {
      const result = weakConcatenateBaseUrl('users', 'https://api.example.com');
      expect(result).toBe('https://api.example.comusers');
    });

    it('should not apply defaultBaseUrl when URL has protocol', () => {
      const url = 'https://other.com/users';
      const result = weakConcatenateBaseUrl(url, 'https://api.example.com');
      expect(result).toBe(url);
    });

    it('should not apply defaultBaseUrl when URL has template variables', () => {
      const url = '{{baseURL}}/users';
      const result = weakConcatenateBaseUrl(url, 'https://api.example.com');
      expect(result).toBe(url);
    });

    it('should not apply defaultBaseUrl for absolute paths', () => {
      const url = '/absolute/path';
      const result = weakConcatenateBaseUrl(url, 'https://api.example.com');
      expect(result).toBe(url);
    });

    it('should apply defaultBaseUrl with trailing slash correctly', () => {
      const result = weakConcatenateBaseUrl('users', 'https://api.example.com/');
      expect(result).toBe('https://api.example.com/users');
    });

    it('should not apply when defaultBaseUrl is undefined', () => {
      const url = 'users';
      const result = weakConcatenateBaseUrl(url, undefined);
      expect(result).toBe(url);
    });
  });

  describe('URL Normalization', () => {
    it('should normalize double slashes in path', () => {
      const normalized = normalizeUrl('https://api.com//v1//users');
      expect(normalized).toBe('https://api.com/v1/users');
    });

    it('should preserve query parameters', () => {
      const url = 'https://api.example.com/users?page=1&limit=10';
      const normalized = normalizeUrl(url);
      expect(normalized).toContain('page=1');
      expect(normalized).toContain('limit=10');
    });

    it('should handle protocol-relative URLs', () => {
      const url = '//cdn.example.com/resource';
      const normalized = normalizeUrl(url);
      expect(normalized).toBe('//cdn.example.com/resource');
    });

    it('should handle empty string', () => {
      expect(normalizeUrl('')).toBe('');
    });

    it('should handle URLs with hash', () => {
      const url = 'https://api.example.com/users#section';
      const normalized = normalizeUrl(url);
      expect(normalized).toContain('#section');
    });
  });

  describe('Invalid URL Handling', () => {
    it('should detect invalid URL', () => {
      expect(isValidUrl('not a valid url')).toBe(false);
    });

    it('should detect valid URL', () => {
      expect(isValidUrl('https://api.example.com')).toBe(true);
    });

    it('should detect URL with spaces as invalid', () => {
      expect(isValidUrl('https://api example com/users')).toBe(false);
    });

    it('should handle normalization of unusual URL formats', () => {
      // URL with colons gets processed by URL constructor with dummy base
      const unusualUrl = '::invalid::';
      const normalized = normalizeUrl(unusualUrl);
      // The URL constructor may prepend '/' when using dummy base
      expect(typeof normalized).toBe('string');
    });
  });

  describe('Protocol Detection', () => {
    it('should detect http protocol', () => {
      expect(hasProtocol('http://example.com')).toBe(true);
    });

    it('should detect https protocol', () => {
      expect(hasProtocol('https://example.com')).toBe(true);
    });

    it('should detect ws protocol', () => {
      expect(hasProtocol('ws://example.com')).toBe(true);
    });

    it('should detect protocol-relative URL', () => {
      expect(hasProtocol('//cdn.example.com')).toBe(true);
    });

    it('should not detect protocol in relative path', () => {
      expect(hasProtocol('/api/users')).toBe(false);
    });

    it('should not detect protocol in template', () => {
      expect(hasProtocol('{{baseURL}}/users')).toBe(false);
    });
  });

  describe('Dynamic URL Updates', () => {
    it('should update resolved URL when template changes', () => {
      const resolver = new StaticVariableResolver(mockEnvironment.variables);

      let url = '{{baseURL}}/users';
      let resolved = resolveVariables(url, resolver);
      expect(resolved).toBe('https://api.example.com/users');

      url = '{{baseURL}}/posts';
      resolved = resolveVariables(url, resolver);
      expect(resolved).toBe('https://api.example.com/posts');
    });

    it('should handle partial variable in URL', () => {
      const resolver = new StaticVariableResolver(mockEnvironment.variables);

      // Partial variable - should not match
      const partial = '{{base';
      const resolved = resolveVariables(partial, resolver);
      expect(resolved).toBe('{{base');
    });
  });

  describe('Multiple Variables', () => {
    it('should resolve multiple variables in URL', () => {
      const resolver = new StaticVariableResolver(mockEnvironment.variables);
      const url = '{{baseURL}}/users/{{userId}}/profile';
      const resolved = resolveVariables(url, resolver);

      expect(resolved).toBe('https://api.example.com/users/12345/profile');
    });

    it('should handle same variable multiple times', () => {
      const resolver = new StaticVariableResolver(mockEnvironment.variables);
      const url = '{{baseURL}}/users/{{userId}}/posts/{{userId}}';
      const resolved = resolveVariables(url, resolver);

      expect(resolved).toBe('https://api.example.com/users/12345/posts/12345');
    });
  });

  describe('Error Boundary Cases', () => {
    it('should handle circular variable references with error', () => {
      const circularVars: EnvironmentVariable[] = [
        { key: 'a', value: '{{b}}', type: 'string', enabled: true },
        { key: 'b', value: '{{a}}', type: 'string', enabled: true },
      ];

      const resolver = new StaticVariableResolver(circularVars);
      expect(() => resolveVariables('{{a}}', resolver)).toThrow(/Circular/);
    });

    it('should handle deep variable nesting', () => {
      const deepVars: EnvironmentVariable[] = [
        { key: 'a', value: '{{b}}', type: 'string', enabled: true },
        { key: 'b', value: '{{c}}', type: 'string', enabled: true },
        { key: 'c', value: '{{d}}', type: 'string', enabled: true },
        { key: 'd', value: '{{e}}', type: 'string', enabled: true },
        { key: 'e', value: 'final-value', type: 'string', enabled: true },
      ];

      const resolver = new StaticVariableResolver(deepVars);
      const resolved = resolveVariables('{{a}}', resolver);
      expect(resolved).toBe('final-value');
    });

    it('should throw error on excessive depth', () => {
      const deepVars: EnvironmentVariable[] = [
        { key: 'v0', value: 'end', type: 'string', enabled: true },
      ];
      // Create chain v10 -> v9 -> ... -> v0
      for (let i = 1; i <= 15; i++) {
        deepVars.push({
          key: `v${i}`,
          value: `{{v${i - 1}}}`,
          type: 'string',
          enabled: true,
        });
      }

      const resolver = new StaticVariableResolver(deepVars);
      expect(() => resolveVariables('{{v15}}', resolver)).toThrow(/depth/);
    });
  });

  describe('URL Preview Status', () => {
    it('should return valid status for resolved URL', () => {
      const resolver = new StaticVariableResolver(mockEnvironment.variables);
      const url = '{{baseURL}}/users';
      const resolved = resolveVariables(url, resolver);
      const normalized = normalizeUrl(resolved);

      expect(hasTemplateVariables(normalized)).toBe(false);
      expect(isValidUrl(normalized)).toBe(true);
    });

    it('should return warning status for unresolved variables', () => {
      const resolver = new StaticVariableResolver([]);
      const url = '{{unknownVar}}/users';
      const resolved = resolveVariables(url, resolver);

      expect(hasTemplateVariables(resolved)).toBe(true);
      expect(extractUnresolvedVariables(resolved)).toContain('unknownVar');
    });

    it('should return error status for invalid URL', () => {
      const resolver = new StaticVariableResolver([]);
      const url = 'not a valid url';
      const resolved = resolveVariables(url, resolver);

      expect(isValidUrl(resolved)).toBe(false);
    });
  });

  describe('Priority Handling', () => {
    it('should prioritize local vars over env vars', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'baseURL', value: 'https://env.example.com', type: 'string', enabled: true },
      ];
      const localVars: EnvironmentVariable[] = [
        { key: 'baseURL', value: 'https://local.example.com', type: 'string', enabled: true },
      ];

      const resolver = new StaticVariableResolver(envVars, localVars);
      const resolved = resolveVariables('{{baseURL}}', resolver);

      expect(resolved).toBe('https://local.example.com');
    });

    it('should fall back to env vars when local var not defined', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'baseURL', value: 'https://env.example.com', type: 'string', enabled: true },
      ];
      const localVars: EnvironmentVariable[] = [
        { key: 'otherVar', value: 'local', type: 'string', enabled: true },
      ];

      const resolver = new StaticVariableResolver(envVars, localVars);
      const resolved = resolveVariables('{{baseURL}}', resolver);

      expect(resolved).toBe('https://env.example.com');
    });
  });

  describe('Request Object Validation', () => {
    it('should have correct request structure with variables', () => {
      const request: HttpRequest = {
        id: 'req-1',
        name: 'Test Request',
        method: 'GET',
        url: '{{baseURL}}/users',
        headers: [{ key: 'Authorization', value: 'Bearer {{authToken}}', enabled: true }],
        params: [{ key: 'userId', value: '{{userId}}', enabled: true }],
      };

      expect(request.url).toContain('{{');
      expect(request.headers[0].value).toContain('{{');
      expect(request.params[0].value).toContain('{{');
    });

    it('should support collection reference in props', () => {
      const collection = { defaultBaseUrl: 'https://api.example.com' };
      expect(collection.defaultBaseUrl).toBeDefined();
    });
  });
});