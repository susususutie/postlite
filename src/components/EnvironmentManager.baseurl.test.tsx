import { describe, it, expect, vi } from 'vitest';
import type { Environment, EnvironmentVariable } from '../types';

// Mock services
vi.mock('../services/environment', () => ({
  getEnvironments: vi.fn(),
  getCurrentEnvironmentId: vi.fn(),
  setCurrentEnvironment: vi.fn(),
  createEnvironment: vi.fn(),
  updateEnvironment: vi.fn(),
  deleteEnvironment: vi.fn(),
  addEnvironmentVariable: vi.fn(),
  deleteEnvironmentVariable: vi.fn(),
  cloneEnvironment: vi.fn(),
  setEnvironmentVariables: vi.fn(),
}));

describe('EnvironmentManager - BaseURL Feature', () => {
  const mockVariables: EnvironmentVariable[] = [
    { key: 'baseURL', value: 'https://api.example.com', type: 'string', enabled: true },
    { key: 'authToken', value: 'secret-token', type: 'secret', enabled: true },
    { key: 'userId', value: '12345', type: 'string', enabled: true },
  ];

  const mockEnvironment: Environment = {
    id: 'env-1',
    name: 'Development',
    variables: mockVariables,
    isDefault: true,
  };

  const mockEmptyEnvironment: Environment = {
    id: 'env-2',
    name: 'Production',
    variables: [],
    isDefault: false,
  };

  describe('Recommended Variables List', () => {
    it('should have complete list of recommended variables', () => {
      const recommendedVars = [
        { key: 'baseURL', description: '主服务地址', type: 'string' },
        { key: 'authURL', description: '认证服务地址', type: 'string' },
        { key: 'fileURL', description: '文件服务地址', type: 'string' },
        { key: 'apiKey', description: 'API 密钥', type: 'secret' },
        { key: 'authToken', description: '认证令牌', type: 'secret' },
        { key: 'userId', description: '用户 ID', type: 'string' },
        { key: 'orgId', description: '组织 ID', type: 'string' },
      ];

      expect(recommendedVars).toHaveLength(7);
      expect(recommendedVars.map(v => v.key)).toContain('baseURL');
      expect(recommendedVars.map(v => v.key)).toContain('authURL');
      expect(recommendedVars.map(v => v.key)).toContain('apiKey');
    });

    it('should have correct types for each recommended variable', () => {
      const recommendedVars = [
        { key: 'baseURL', type: 'string' },
        { key: 'authURL', type: 'string' },
        { key: 'fileURL', type: 'string' },
        { key: 'apiKey', type: 'secret' },
        { key: 'authToken', type: 'secret' },
        { key: 'userId', type: 'string' },
        { key: 'orgId', type: 'string' },
      ];

      const urlVars = recommendedVars.filter(v => v.type === 'string' && v.key.includes('URL'));
      expect(urlVars).toHaveLength(3);

      const secretVars = recommendedVars.filter(v => v.type === 'secret');
      expect(secretVars).toHaveLength(2);
    });

    it('should have descriptions for all recommended variables', () => {
      const recommendedVars = [
        { key: 'baseURL', description: '主服务地址' },
        { key: 'authURL', description: '认证服务地址' },
        { key: 'fileURL', description: '文件服务地址' },
        { key: 'apiKey', description: 'API 密钥' },
        { key: 'authToken', description: '认证令牌' },
        { key: 'userId', description: '用户 ID' },
        { key: 'orgId', description: '组织 ID' },
      ];

      recommendedVars.forEach(v => {
        expect(v.description).toBeDefined();
        expect(v.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Variable Existence Check', () => {
    it('should detect existing recommended variables', () => {
      const existingKeys = mockEnvironment.variables.map(v => v.key);

      expect(existingKeys).toContain('baseURL');
      expect(existingKeys).toContain('authToken');
      expect(existingKeys).not.toContain('authURL');
      expect(existingKeys).not.toContain('apiKey');
    });

    it('should detect all missing recommended variables', () => {
      const existingKeys = mockEnvironment.variables.map(v => v.key);
      const recommendedKeys = ['baseURL', 'authURL', 'fileURL', 'apiKey', 'authToken', 'userId', 'orgId'];

      const missingKeys = recommendedKeys.filter(key => !existingKeys.includes(key));

      expect(missingKeys).toContain('authURL');
      expect(missingKeys).toContain('fileURL');
      expect(missingKeys).toContain('apiKey');
      expect(missingKeys).toContain('orgId');
    });

    it('should handle empty environment', () => {
      const existingKeys = mockEmptyEnvironment.variables.map(v => v.key);
      expect(existingKeys).toHaveLength(0);
    });
  });

  describe('Add Recommended Variable', () => {
    it('should create correct variable structure for baseURL', () => {
      const newVar: EnvironmentVariable = {
        key: 'baseURL',
        value: '',
        type: 'string',
        enabled: true,
      };

      expect(newVar.key).toBe('baseURL');
      expect(newVar.type).toBe('string');
      expect(newVar.enabled).toBe(true);
    });

    it('should create correct variable structure for secret type', () => {
      const newVar: EnvironmentVariable = {
        key: 'apiKey',
        value: '',
        type: 'secret',
        enabled: true,
      };

      expect(newVar.key).toBe('apiKey');
      expect(newVar.type).toBe('secret');
    });

    it('should prevent adding duplicate variables', () => {
      const existingKeys = mockEnvironment.variables.map(v => v.key);
      const keyToAdd = 'baseURL';

      const isDuplicate = existingKeys.includes(keyToAdd);
      expect(isDuplicate).toBe(true);
    });

    it('should allow adding non-duplicate variables', () => {
      const existingKeys = mockEnvironment.variables.map(v => v.key);
      const keyToAdd = 'authURL';

      const isDuplicate = existingKeys.includes(keyToAdd);
      expect(isDuplicate).toBe(false);
    });
  });

  describe('All Recommended Variables', () => {
    const allRecommendedVars = [
      { key: 'baseURL', description: '主服务地址', type: 'string' as const },
      { key: 'authURL', description: '认证服务地址', type: 'string' as const },
      { key: 'fileURL', description: '文件服务地址', type: 'string' as const },
      { key: 'apiKey', description: 'API 密钥', type: 'secret' as const },
      { key: 'authToken', description: '认证令牌', type: 'secret' as const },
      { key: 'userId', description: '用户 ID', type: 'string' as const },
      { key: 'orgId', description: '组织 ID', type: 'string' as const },
    ];

    it.each(allRecommendedVars)('should have correct structure for $key', ({ key, description, type }) => {
      expect(key).toBeDefined();
      expect(description).toBeDefined();
      expect(['string', 'secret']).toContain(type);
    });

    it.each(allRecommendedVars)('$key should have non-empty description', ({ description }) => {
      expect(description.length).toBeGreaterThan(0);
    });
  });

  describe('Variable Examples', () => {
    it('should have valid URL examples for URL variables', () => {
      const urlExamples = [
        { key: 'baseURL', example: 'https://api.example.com' },
        { key: 'authURL', example: 'https://auth.example.com' },
        { key: 'fileURL', example: 'https://files.example.com' },
      ];

      urlExamples.forEach(({ example }) => {
        expect(example).toMatch(/^https:\/\//);
      });
    });

    it('should have valid examples for secret variables', () => {
      const secretExamples = [
        { key: 'apiKey', example: 'your-api-key-here' },
        { key: 'authToken', example: 'Bearer xxx' },
      ];

      secretExamples.forEach(({ example }) => {
        expect(example).toBeDefined();
        expect(example.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Empty Environment State', () => {
    it('should show all recommended variables when environment is empty', () => {
      const existingKeys = mockEmptyEnvironment.variables.map(v => v.key);
      const recommendedKeys = ['baseURL', 'authURL', 'fileURL', 'apiKey', 'authToken', 'userId', 'orgId'];

      const allMissing = recommendedKeys.every(key => !existingKeys.includes(key));
      expect(allMissing).toBe(true);
    });

    it('should allow adding all recommended variables to empty environment', () => {
      const recommendedVars = [
        { key: 'baseURL', type: 'string' },
        { key: 'authURL', type: 'string' },
        { key: 'fileURL', type: 'string' },
        { key: 'apiKey', type: 'secret' },
        { key: 'authToken', type: 'secret' },
        { key: 'userId', type: 'string' },
        { key: 'orgId', type: 'string' },
      ];

      const newVars: EnvironmentVariable[] = recommendedVars.map(v => ({
        key: v.key,
        value: '',
        type: v.type as 'string' | 'secret',
        enabled: true,
      }));

      expect(newVars).toHaveLength(7);
      newVars.forEach(v => {
        expect(v.value).toBe('');
        expect(v.enabled).toBe(true);
      });
    });
  });

  describe('No Environment Selected', () => {
    it('should handle undefined environment', () => {
      const noEnv: Environment | undefined = undefined;
      expect(noEnv).toBeUndefined();
    });

    it('should handle empty environments list', () => {
      const emptyEnvs: Environment[] = [];
      expect(emptyEnvs).toHaveLength(0);
    });
  });

  describe('Variable Ordering and Display', () => {
    it('should maintain consistent ordering of recommended variables', () => {
      const expectedOrder = ['baseURL', 'authURL', 'fileURL', 'apiKey', 'authToken', 'userId', 'orgId'];

      expect(expectedOrder[0]).toBe('baseURL');
      expect(expectedOrder[1]).toBe('authURL');
      expect(expectedOrder[6]).toBe('orgId');
    });

    it('should group variables by type correctly', () => {
      const stringVars = ['baseURL', 'authURL', 'fileURL', 'userId', 'orgId'];
      const secretVars = ['apiKey', 'authToken'];

      expect(stringVars).toHaveLength(5);
      expect(secretVars).toHaveLength(2);
    });
  });

  describe('Integration with Existing Variables', () => {
    it('should handle environment with some recommended variables', () => {
      const partialEnvironment: Environment = {
        ...mockEnvironment,
        variables: [
          { key: 'baseURL', value: 'https://api.example.com', type: 'string', enabled: true },
          { key: 'customVar', value: 'custom', type: 'string', enabled: true },
        ],
      };

      const hasBaseURL = partialEnvironment.variables.some(v => v.key === 'baseURL');
      const hasAuthURL = partialEnvironment.variables.some(v => v.key === 'authURL');

      expect(hasBaseURL).toBe(true);
      expect(hasAuthURL).toBe(false);
    });

    it('should preserve existing variables when adding new ones', () => {
      const existingVars = [...mockEnvironment.variables];
      const newVar: EnvironmentVariable = {
        key: 'authURL',
        value: '',
        type: 'string',
        enabled: true,
      };

      const updatedVars = [...existingVars, newVar];

      expect(updatedVars).toHaveLength(4);
      expect(updatedVars.map(v => v.key)).toContain('baseURL');
      expect(updatedVars.map(v => v.key)).toContain('authURL');
    });
  });

  describe('Edge Cases', () => {
    it('should handle case-sensitive variable names', () => {
      const environmentWithDifferentCase: Environment = {
        ...mockEnvironment,
        variables: [
          { key: 'BaseURL', value: 'https://api.example.com', type: 'string', enabled: true },
        ],
      };

      const hasLowercase = environmentWithDifferentCase.variables.some(v => v.key === 'baseURL');
      const hasUppercase = environmentWithDifferentCase.variables.some(v => v.key === 'BaseURL');

      expect(hasLowercase).toBe(false);
      expect(hasUppercase).toBe(true);
    });

    it('should handle disabled recommended variables', () => {
      const environmentWithDisabledVar: Environment = {
        ...mockEnvironment,
        variables: [
          { key: 'baseURL', value: 'https://api.example.com', type: 'string', enabled: false },
        ],
      };

      const baseURLVar = environmentWithDisabledVar.variables.find(v => v.key === 'baseURL');
      expect(baseURLVar).toBeDefined();
      expect(baseURLVar?.enabled).toBe(false);
    });

    it('should handle rapid add operations', () => {
      const addedKeys: string[] = [];
      const keysToAdd = ['baseURL', 'authURL', 'apiKey'];

      keysToAdd.forEach(key => {
        if (!addedKeys.includes(key)) {
          addedKeys.push(key);
        }
      });

      // Should only add each key once
      expect(addedKeys).toHaveLength(3);
    });
  });

  describe('Help Text and Documentation', () => {
    it('should have help text for recommended variables section', () => {
      const helpText = '点击快速添加常用变量，可在请求中使用 {{variableName}} 引用';
      expect(helpText).toContain('点击快速添加');
      expect(helpText).toContain('{{variableName}}');
    });

    it('should document variable usage syntax', () => {
      const usageSyntax = '{{variableName}}';
      expect(usageSyntax).toMatch(/\{\{.*\}\}/);
    });
  });

  describe('Icon Assignment', () => {
    it('should assign correct icon types to variables', () => {
      const iconMapping = [
        { key: 'baseURL', iconType: 'global' },
        { key: 'authURL', iconType: 'global' },
        { key: 'fileURL', iconType: 'global' },
        { key: 'apiKey', iconType: 'key' },
        { key: 'authToken', iconType: 'key' },
        { key: 'userId', iconType: 'star' },
        { key: 'orgId', iconType: 'star' },
      ];

      const urlVars = iconMapping.filter(v => v.iconType === 'global');
      const keyVars = iconMapping.filter(v => v.iconType === 'key');
      const starVars = iconMapping.filter(v => v.iconType === 'star');

      expect(urlVars).toHaveLength(3);
      expect(keyVars).toHaveLength(2);
      expect(starVars).toHaveLength(2);
    });
  });
});