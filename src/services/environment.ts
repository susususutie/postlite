// 环境变量管理服务
import { v4 as uuidv4 } from 'uuid';
import type { Environment, EnvironmentVariable } from '../types';
import {
  loadEnvironments,
  saveEnvironments,
  loadCurrentEnvironment,
  saveCurrentEnvironment,
} from '../store/storage';

// 获取所有环境
export function getEnvironments(): Environment[] {
  return loadEnvironments();
}

// 创建环境
export function createEnvironment(name: string, isDefault: boolean = false): Environment {
  const environments = loadEnvironments();

  const newEnv: Environment = {
    id: uuidv4(),
    name,
    variables: [],
    isDefault,
  };

  // 如果设为默认，取消其他默认环境
  if (isDefault) {
    environments.forEach(env => {
      env.isDefault = false;
    });
  }

  environments.push(newEnv);
  saveEnvironments(environments);

  return newEnv;
}

// 更新环境
export function updateEnvironment(
  envId: string,
  updates: Partial<Pick<Environment, 'name' | 'isDefault'>>
): Environment | null {
  const environments = loadEnvironments();
  const env = environments.find(e => e.id === envId);

  if (!env) {
    return null;
  }

  // 如果设为默认，取消其他默认环境
  if (updates.isDefault) {
    environments.forEach(e => {
      e.isDefault = false;
    });
  }

  Object.assign(env, updates);
  saveEnvironments(environments);

  return env;
}

// 删除环境
export function deleteEnvironment(envId: string): boolean {
  const environments = loadEnvironments();
  const filtered = environments.filter(e => e.id !== envId);

  if (filtered.length === environments.length) {
    return false;
  }

  // 如果删除的是默认环境，设置第一个为默认
  const hasDefault = filtered.some(e => e.isDefault);
  if (!hasDefault && filtered.length > 0) {
    filtered[0].isDefault = true;
  }

  saveEnvironments(filtered);

  // 更新当前环境
  const currentEnv = loadCurrentEnvironment();
  if (currentEnv === envId) {
    const newDefault = filtered.find(e => e.isDefault);
    saveCurrentEnvironment(newDefault?.id);
  }

  return true;
}

// 添加环境变量
export function addEnvironmentVariable(
  envId: string,
  variable: Omit<EnvironmentVariable, 'enabled'> & { enabled?: boolean }
): Environment | null {
  const environments = loadEnvironments();
  const env = environments.find(e => e.id === envId);

  if (!env) {
    return null;
  }

  const newVar: EnvironmentVariable = {
    ...variable,
    enabled: variable.enabled ?? true,
  };

  // 检查是否已存在同名变量，如果存在则更新
  const existingIndex = env.variables.findIndex(v => v.key === variable.key);
  if (existingIndex !== -1) {
    env.variables[existingIndex] = newVar;
  } else {
    env.variables.push(newVar);
  }

  saveEnvironments(environments);
  return env;
}

// 更新环境变量
export function updateEnvironmentVariable(
  envId: string,
  variableKey: string,
  updates: Partial<EnvironmentVariable>
): Environment | null {
  const environments = loadEnvironments();
  const env = environments.find(e => e.id === envId);

  if (!env) {
    return null;
  }

  const variable = env.variables.find(v => v.key === variableKey);

  if (!variable) {
    return null;
  }

  Object.assign(variable, updates);
  saveEnvironments(environments);

  return env;
}

// 删除环境变量
export function deleteEnvironmentVariable(envId: string, variableKey: string): boolean {
  const environments = loadEnvironments();
  const env = environments.find(e => e.id === envId);

  if (!env) {
    return false;
  }

  const index = env.variables.findIndex(v => v.key === variableKey);
  if (index === -1) {
    return false;
  }

  env.variables.splice(index, 1);
  saveEnvironments(environments);

  return true;
}

// 获取当前环境 ID
export function getCurrentEnvironmentId(): string | undefined {
  return loadCurrentEnvironment();
}

// 设置当前环境
export function setCurrentEnvironment(envId: string | undefined): void {
  saveCurrentEnvironment(envId);
}

// 获取当前环境
export function getCurrentEnvironment(): Environment | null {
  const envId = loadCurrentEnvironment();
  if (!envId) {
    const environments = loadEnvironments();
    const defaultEnv = environments.find(e => e.isDefault);
    return defaultEnv || null;
  }

  const environments = loadEnvironments();
  return environments.find(e => e.id === envId) || null;
}

// 获取环境变量
export function getEnvironmentVariables(envId: string): EnvironmentVariable[] {
  const environments = loadEnvironments();
  const env = environments.find(e => e.id === envId);
  return env?.variables || [];
}

// 根据 ID 获取环境
export function getEnvironmentById(envId: string): Environment | null {
  const environments = loadEnvironments();
  return environments.find(e => e.id === envId) || null;
}

// 克隆环境
export function cloneEnvironment(envId: string, newName: string): Environment | null {
  const environments = loadEnvironments();
  const env = environments.find(e => e.id === envId);

  if (!env) {
    return null;
  }

  const clonedEnv: Environment = {
    id: uuidv4(),
    name: newName,
    variables: env.variables.map(v => ({ ...v })),
    isDefault: false,
  };

  environments.push(clonedEnv);
  saveEnvironments(environments);

  return clonedEnv;
}

// 批量设置环境变量
export function setEnvironmentVariables(
  envId: string,
  variables: EnvironmentVariable[]
): Environment | null {
  const environments = loadEnvironments();
  const env = environments.find(e => e.id === envId);

  if (!env) {
    return null;
  }

  env.variables = variables;
  saveEnvironments(environments);

  return env;
}

// 导入环境
export function importEnvironment(environment: Environment): Environment {
  const environments = loadEnvironments();
  environment.id = uuidv4();
  environment.isDefault = false;
  environments.push(environment);
  saveEnvironments(environments);
  return environment;
}

// 导出环境
export function exportEnvironment(envId: string): Environment | null {
  const env = getEnvironmentById(envId);
  if (!env) {
    return null;
  }
  return { ...env };
}
