import { describe, it, expect } from 'vitest';
import {
  MAX_RESOLVE_DEPTH,
  StaticVariableResolver,
  resolveVariables,
  applyEnvironmentVariables,
  extractUnresolvedVariables,
  hasTemplateVariables,
} from './variables';
import type { EnvironmentVariable } from '../types';

describe('Variable Resolution Engine', () => {
  describe('StaticVariableResolver', () => {
    it('should resolve variables from envVars', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'baseUrl', value: 'https://api.example.com', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      expect(resolver.supports('baseUrl')).toBe(true);
      expect(resolver.resolve('baseUrl')).toBe('https://api.example.com');
      expect(resolver.supports('nonExistent')).toBe(false);
    });

    it('should give priority to localVars over envVars', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'baseUrl', value: 'https://env.example.com', type: 'string', enabled: true },
      ];
      const localVars: EnvironmentVariable[] = [
        { key: 'baseUrl', value: 'https://local.example.com', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars, localVars);

      expect(resolver.resolve('baseUrl')).toBe('https://local.example.com');
    });

    it('should skip disabled variables', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'baseUrl', value: 'https://api.example.com', type: 'string', enabled: false },
      ];
      const resolver = new StaticVariableResolver(envVars);

      expect(resolver.supports('baseUrl')).toBe(false);
    });

    it('should handle empty variable arrays', () => {
      const resolver = new StaticVariableResolver([], []);

      expect(resolver.supports('any')).toBe(false);
      expect(resolver.resolve('any')).toBeUndefined();
    });

    it('should handle secret type variables', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'token', value: 'secret-token', type: 'secret', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      expect(resolver.resolve('token')).toBe('secret-token');
    });
  });

  describe('resolveVariables', () => {
    it('should replace single variable', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'baseUrl', value: 'https://api.example.com', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{baseUrl}}/users', resolver);
      expect(result).toBe('https://api.example.com/users');
    });

    it('should replace multiple variables', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'host', value: 'api.example.com', type: 'string', enabled: true },
        { key: 'version', value: 'v2', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('https://{{host}}/api/{{version}}/users', resolver);
      expect(result).toBe('https://api.example.com/api/v2/users');
    });

    it('should handle variables with spaces', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'baseUrl', value: 'https://api.example.com', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{ baseUrl }}/users', resolver);
      expect(result).toBe('https://api.example.com/users');
    });

    it('should recursively resolve nested variables', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'host', value: 'https://api.example.com', type: 'string', enabled: true },
        { key: 'baseUrl', value: '{{host}}/api', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{baseUrl}}/users', resolver);
      expect(result).toBe('https://api.example.com/api/users');
    });

    it('should handle deeply nested variables up to MAX_RESOLVE_DEPTH', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'a', value: '{{b}}', type: 'string', enabled: true },
        { key: 'b', value: '{{c}}', type: 'string', enabled: true },
        { key: 'c', value: '{{d}}', type: 'string', enabled: true },
        { key: 'd', value: 'final-value', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{a}}', resolver);
      expect(result).toBe('final-value');
    });

    it('should throw error when exceeding MAX_RESOLVE_DEPTH', () => {
      // Create a chain that exceeds MAX_RESOLVE_DEPTH (10)
      const envVars: EnvironmentVariable[] = Array.from({ length: 12 }, (_, i) => ({
        key: `var${i}`,
        value: i < 11 ? `{{var${i + 1}}}` : 'final',
        type: 'string' as const,
        enabled: true,
      }));
      const resolver = new StaticVariableResolver(envVars);

      expect(() => resolveVariables('{{var0}}', resolver)).toThrow(
        `Variable resolution exceeded max depth (${MAX_RESOLVE_DEPTH})`
      );
    });

    it('should detect circular references (a -> b -> a)', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'a', value: '{{b}}', type: 'string', enabled: true },
        { key: 'b', value: '{{a}}', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      expect(() => resolveVariables('{{a}}', resolver)).toThrow(
        'Circular variable reference detected: a -> b -> a'
      );
    });

    it('should detect circular references with multiple steps (a -> b -> c -> a)', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'a', value: '{{b}}', type: 'string', enabled: true },
        { key: 'b', value: '{{c}}', type: 'string', enabled: true },
        { key: 'c', value: '{{a}}', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      expect(() => resolveVariables('{{a}}', resolver)).toThrow(
        'Circular variable reference detected: a -> b -> c -> a'
      );
    });

    it('should allow same variable referenced multiple times (a = {{b}}/{{b}})', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'a', value: '{{b}}/{{b}}', type: 'string', enabled: true },
        { key: 'b', value: 'value', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      // This should NOT throw - using the same variable multiple times is fine
      const result = resolveVariables('{{a}}', resolver);
      expect(result).toBe('value/value');
    });

    it('should preserve unresolved variables', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'known', value: 'resolved', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{known}}/{{unknown}}', resolver);
      expect(result).toBe('resolved/{{unknown}}');
    });

    it('should handle empty string input', () => {
      const resolver = new StaticVariableResolver([]);
      const result = resolveVariables('', resolver);
      expect(result).toBe('');
    });

    it('should handle string without variables', () => {
      const resolver = new StaticVariableResolver([]);
      const result = resolveVariables('https://api.example.com/users', resolver);
      expect(result).toBe('https://api.example.com/users');
    });

    it('should handle variables with special characters in values', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'special', value: 'hello/world//test', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{special}}', resolver);
      expect(result).toBe('hello/world//test');
    });

    it('should handle complex nested resolution', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'scheme', value: 'https', type: 'string', enabled: true },
        { key: 'domain', value: 'api.{{tld}}', type: 'string', enabled: true },
        { key: 'tld', value: 'example.com', type: 'string', enabled: true },
        { key: 'baseUrl', value: '{{scheme}}://{{domain}}', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{baseUrl}}/v1/users', resolver);
      expect(result).toBe('https://api.example.com/v1/users');
    });
  });

  describe('applyEnvironmentVariables (backward compatibility)', () => {
    it('should apply environment variables to string', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'baseUrl', value: 'https://api.example.com', type: 'string', enabled: true },
      ];

      const result = applyEnvironmentVariables('{{baseUrl}}/users', envVars);
      expect(result).toBe('https://api.example.com/users');
    });

    it('should support local variables overriding env variables', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'baseUrl', value: 'https://env.example.com', type: 'string', enabled: true },
      ];
      const localVars: EnvironmentVariable[] = [
        { key: 'baseUrl', value: 'https://local.example.com', type: 'string', enabled: true },
      ];

      const result = applyEnvironmentVariables('{{baseUrl}}/users', envVars, localVars);
      expect(result).toBe('https://local.example.com/users');
    });

    it('should handle empty variables gracefully', () => {
      const result = applyEnvironmentVariables('{{baseUrl}}/users', []);
      expect(result).toBe('{{baseUrl}}/users');
    });
  });

  describe('extractUnresolvedVariables', () => {
    it('should extract all variable names', () => {
      const result = extractUnresolvedVariables('{{host}}/api/{{version}}/{{host}}');
      expect(result).toEqual(['host', 'version']); // Duplicates removed
    });

    it('should return empty array for no variables', () => {
      const result = extractUnresolvedVariables('https://api.example.com/users');
      expect(result).toEqual([]);
    });

    it('should handle variables with spaces', () => {
      const result = extractUnresolvedVariables('{{ baseUrl }}/api');
      expect(result).toEqual(['baseUrl']);
    });

    it('should return empty array for empty string', () => {
      const result = extractUnresolvedVariables('');
      expect(result).toEqual([]);
    });
  });

  describe('hasTemplateVariables', () => {
    it('should return true for strings with template variables', () => {
      expect(hasTemplateVariables('{{baseUrl}}/users')).toBe(true);
      expect(hasTemplateVariables('{{ baseUrl }}/users')).toBe(true);
    });

    it('should return false for strings without template variables', () => {
      expect(hasTemplateVariables('https://api.example.com/users')).toBe(false);
      expect(hasTemplateVariables('')).toBe(false);
    });

    it('should return false for malformed variables', () => {
      expect(hasTemplateVariables('{baseUrl}')).toBe(false);
      expect(hasTemplateVariables('{{}}')).toBe(false);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very long variable values', () => {
      const longValue = 'a'.repeat(10000);
      const envVars: EnvironmentVariable[] = [
        { key: 'long', value: longValue, type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{long}}', resolver);
      expect(result).toBe(longValue);
    });

    it('should handle unicode in variable values', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'unicode', value: '你好世界🎉', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{unicode}}', resolver);
      expect(result).toBe('你好世界🎉');
    });

    it('should handle empty variable values', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'empty', value: '', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{empty}}/api', resolver);
      expect(result).toBe('/api');
    });

    it('should handle variable names with underscores and numbers', () => {
      const envVars: EnvironmentVariable[] = [
        { key: 'base_url_123', value: 'https://api.example.com', type: 'string', enabled: true },
      ];
      const resolver = new StaticVariableResolver(envVars);

      const result = resolveVariables('{{base_url_123}}/users', resolver);
      expect(result).toBe('https://api.example.com/users');
    });
  });
});
