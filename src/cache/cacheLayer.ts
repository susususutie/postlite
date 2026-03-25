export interface CacheLayerOptions<T> {
  namespace?: string;
  storage: StorageAdapter<T>;
  maxSize?: number;
  onEvict?: (key: string, value: T) => void;
}

export interface StorageAdapter<T> {
  getItem(key: string): Promise<T | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

interface CacheEntry<T> {
  key: string;
  value: T;
  accessTime: number;
}

export class CacheLayer<T extends { id: string }> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private namespace: string;
  private storage: StorageAdapter<T>;
  private maxSize: number;
  private onEvict?: (key: string, value: T) => void;

  constructor(options: CacheLayerOptions<T>) {
    this.namespace = options.namespace || 'cache';
    this.storage = options.storage;
    this.maxSize = options.maxSize || 100;
    this.onEvict = options.onEvict;
  }

  private getStorageKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  private updateAccessTime(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.accessTime = Date.now();
    }
  }

  private async evictLRU(): Promise<void> {
    while (this.cache.size >= this.maxSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.accessTime < oldestTime) {
          oldestTime = entry.accessTime;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        const evicted = this.cache.get(oldestKey);
        this.cache.delete(oldestKey);
        const storageKey = this.getStorageKey(oldestKey);
        await this.storage.removeItem(storageKey);
        if (evicted && this.onEvict) {
          this.onEvict(oldestKey, evicted.value);
        }
      } else {
        break;
      }
    }
  }

  async get(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (cached) {
      this.updateAccessTime(key);
      return cached.value;
    }

    const storageKey = this.getStorageKey(key);
    const data = await this.storage.getItem(storageKey);
    if (data) {
      this.cache.set(key, {
        key,
        value: data,
        accessTime: Date.now(),
      });
      return data;
    }

    return null;
  }

  async set(key: string, value: T): Promise<void> {
    if (this.cache.size >= this.maxSize) {
      await this.evictLRU();
    }

    this.cache.set(key, {
      key,
      value,
      accessTime: Date.now(),
    });

    const storageKey = this.getStorageKey(key);
    await this.storage.setItem(storageKey, JSON.stringify(value));
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);

    const storageKey = this.getStorageKey(key);
    await this.storage.removeItem(storageKey);
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    const regex = this.wildcardToRegex(pattern);
    const keysToInvalidate: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToInvalidate.push(key);
      }
    }

    for (const key of keysToInvalidate) {
      this.cache.delete(key);
      const storageKey = this.getStorageKey(key);
      await this.storage.removeItem(storageKey);
    }
  }

  private wildcardToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regexStr}$`);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    await this.storage.clear();
  }
}
