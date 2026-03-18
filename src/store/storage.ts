// 数据持久化存储层
import type { Collection, Environment, HistoryItem } from '../types';

const STORAGE_KEYS = {
  COLLECTIONS: 'postlite_collections',
  ENVIRONMENTS: 'postlite_environments',
  CURRENT_ENV: 'postlite_current_env',
  HISTORY: 'postlite_history',
  SETTINGS: 'postlite_settings',
};

export interface Settings {
  theme: 'light' | 'dark';
  timeout: number;
  followRedirects: boolean;
  validateSSL: boolean;
}

const defaultSettings: Settings = {
  theme: 'light',
  timeout: 30000,
  followRedirects: true,
  validateSSL: false,
};

// Collections
export function saveCollections(collections: Collection[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS, JSON.stringify(collections));
  } catch (error) {
    console.error('Failed to save collections:', error);
  }
}

export function loadCollections(): Collection[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load collections:', error);
    return [];
  }
}

// Environments
export function saveEnvironments(environments: Environment[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENTS, JSON.stringify(environments));
  } catch (error) {
    console.error('Failed to save environments:', error);
  }
}

export function loadEnvironments(): Environment[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ENVIRONMENTS);
    if (data) {
      return JSON.parse(data);
    }
    // 返回默认环境
    return [{
      id: 'default',
      name: 'Default',
      variables: [],
      isDefault: true,
    }];
  } catch (error) {
    console.error('Failed to load environments:', error);
    return [{
      id: 'default',
      name: 'Default',
      variables: [],
      isDefault: true,
    }];
  }
}

export function saveCurrentEnvironment(envId: string | undefined): void {
  try {
    if (envId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_ENV, envId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ENV);
    }
  } catch (error) {
    console.error('Failed to save current environment:', error);
  }
}

export function loadCurrentEnvironment(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_ENV) || undefined;
  } catch (error) {
    console.error('Failed to load current environment:', error);
    return undefined;
  }
}

// History
export function saveHistory(history: HistoryItem[]): void {
  try {
    // 只保留最近的 100 条记录
    const trimmed = history.slice(-100);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
}

export function loadHistory(): HistoryItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
}

// Settings
export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function loadSettings(): Settings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return defaultSettings;
  }
}

// 导出所有数据（用于导出功能）
export function exportAllData(): string {
  const data = {
    collections: loadCollections(),
    environments: loadEnvironments(),
    currentEnvironment: loadCurrentEnvironment(),
    settings: loadSettings(),
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
  };
  return JSON.stringify(data, null, 2);
}

// 导入所有数据
export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.collections) {
      saveCollections(data.collections);
    }
    if (data.environments) {
      saveEnvironments(data.environments);
    }
    if (data.currentEnvironment) {
      saveCurrentEnvironment(data.currentEnvironment);
    }
    if (data.settings) {
      saveSettings({ ...defaultSettings, ...data.settings });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

// 清除所有数据
export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}
