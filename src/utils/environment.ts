// 环境变量处理工具
import type { Environment, EnvironmentVariable } from '../types';

// 替换字符串中的环境变量（格式: {{variableName}}）
export function replaceEnvironmentVariables(
  str: string,
  variables: EnvironmentVariable[]
): string {
  if (!str || !variables || variables.length === 0) {
    return str;
  }

  let result = str;
  const enabledVars = variables.filter(v => v.enabled && v.key);

  // 替换 {{variableName}} 格式
  enabledVars.forEach(variable => {
    const regex = new RegExp(`\\{\\{\\s*${escapeRegex(variable.key)}\\s*\\}\\}`, 'g');
    result = result.replace(regex, variable.value);
  });

  return result;
}

// 转义正则表达式特殊字符
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 获取当前环境变量列表
export function getCurrentVariables(
  environments: Environment[],
  currentEnvId?: string
): EnvironmentVariable[] {
  if (!currentEnvId) {
    // 使用默认环境
    const defaultEnv = environments.find(e => e.isDefault);
    return defaultEnv?.variables || [];
  }

  const env = environments.find(e => e.id === currentEnvId);
  return env?.variables || [];
}

// 应用到请求 URL
export function applyEnvToUrl(
  url: string,
  variables: EnvironmentVariable[]
): string {
  return replaceEnvironmentVariables(url, variables);
}

// 应用到请求头
export function applyEnvToHeaders(
  headers: Record<string, string>,
  variables: EnvironmentVariable[]
): Record<string, string> {
  const result: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    result[replaceEnvironmentVariables(key, variables)] = replaceEnvironmentVariables(
      value,
      variables
    );
  });
  return result;
}

// 应用到请求参数
export function applyEnvToParams(
  params: Record<string, string>,
  variables: EnvironmentVariable[]
): Record<string, string> {
  const result: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    result[replaceEnvironmentVariables(key, variables)] = replaceEnvironmentVariables(
      value,
      variables
    );
  });
  return result;
}

// 应用到请求体
export function applyEnvToBody(
  body: string | undefined,
  variables: EnvironmentVariable[]
): string | undefined {
  if (!body) return body;
  return replaceEnvironmentVariables(body, variables);
}

// 提取环境变量（从字符串中找出所有 {{variable}} 格式的变量）
export function extractEnvironmentVariables(str: string): string[] {
  const regex = /\{\{\\s*(\w+)\\s*\}\}/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }

  return matches;
}

// 创建环境变量
export function createEnvironmentVariable(
  key: string,
  value: string,
  type: 'string' | 'secret' = 'string'
): EnvironmentVariable {
  return {
    key,
    value,
    type,
    enabled: true,
  };
}

// 验证环境变量名是否有效
export function isValidVariableName(name: string): boolean {
  // 只允许字母、数字、下划线和连字符
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name);
}
