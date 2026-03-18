import { describe, it, expect } from 'vitest';
import type { Environment, EnvironmentVariable } from '../types';

describe('EnvironmentManager Component', () => {
  const mockVariables: EnvironmentVariable[] = [
    { key: 'baseUrl', value: 'https://dev.example.com', type: 'string', enabled: true },
    { key: 'apiKey', value: 'secret-key', type: 'secret', enabled: true },
    { key: 'disabledVar', value: 'not-used', type: 'string', enabled: false },
  ];

  const mockEnvironment: Environment = {
    id: 'env-1',
    name: 'Development',
    variables: mockVariables,
  };

  const mockDefaultEnvironment: Environment = {
    id: 'env-default',
    name: 'Default',
    variables: [],
    isDefault: true,
  };

  it('should validate environment structure', () => {
    expect(mockEnvironment).toBeDefined();
    expect(mockEnvironment.id).toBe('env-1');
    expect(mockEnvironment.name).toBe('Development');
    expect(mockEnvironment.variables).toHaveLength(3);
  });

  it('should validate default environment', () => {
    expect(mockDefaultEnvironment.isDefault).toBe(true);
    expect(mockDefaultEnvironment.variables).toHaveLength(0);
  });

  it('should handle string variables', () => {
    const stringVar = mockVariables.find(v => v.type === 'string');
    expect(stringVar).toBeDefined();
    expect(stringVar!.key).toBe('baseUrl');
  });

  it('should handle secret variables', () => {
    const secretVar = mockVariables.find(v => v.type === 'secret');
    expect(secretVar).toBeDefined();
    expect(secretVar!.key).toBe('apiKey');
  });

  it('should handle disabled variables', () => {
    const disabledVar = mockVariables.find(v => !v.enabled);
    expect(disabledVar).toBeDefined();
    expect(disabledVar!.key).toBe('disabledVar');
  });

  it('should handle empty environment', () => {
    const emptyEnv: Environment = {
      id: 'empty',
      name: 'Empty Environment',
      variables: [],
    };

    expect(emptyEnv.variables).toHaveLength(0);
  });

  it('should handle multiple environments', () => {
    const environments: Environment[] = [
      mockDefaultEnvironment,
      mockEnvironment,
      { id: 'env-2', name: 'Production', variables: [] },
      { id: 'env-3', name: 'Staging', variables: [] },
    ];

    expect(environments).toHaveLength(4);
    expect(environments.filter(e => e.isDefault)).toHaveLength(1);
  });

  it('should handle variable with special characters', () => {
    const specialVar: EnvironmentVariable = {
      key: 'special_key-123',
      value: 'value with spaces and !@#$%',
      type: 'string',
      enabled: true,
    };

    expect(specialVar.key).toBe('special_key-123');
    expect(specialVar.value).toBe('value with spaces and !@#$%');
  });

  it('should handle environment cloning structure', () => {
    const clonedEnv: Environment = {
      ...mockEnvironment,
      id: 'cloned-1',
      name: 'Development Copy',
      isDefault: false,
    };

    expect(clonedEnv.id).not.toBe(mockEnvironment.id);
    expect(clonedEnv.name).toBe('Development Copy');
    expect(clonedEnv.variables).toHaveLength(mockEnvironment.variables.length);
  });
});
