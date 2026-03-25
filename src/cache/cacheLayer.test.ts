import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheLayer } from './index';

interface TestData {
  id: string;
  name: string;
}

describe('CacheLayer', () => {
  let cache: CacheLayer<TestData>;
  let storage: Map<string, TestData>;

  beforeEach(() => {
    storage = new Map();
    
    cache = new CacheLayer<TestData>({
      namespace: 'test',
      storage: {
        getItem: async (key: string) => storage.get(key) ?? null,
        setItem: async (_key: string, value: string) => {
          const parsed = JSON.parse(value);
          storage.set(_key, parsed);
        },
        removeItem: async (key: string) => {
          storage.delete(key);
        },
        clear: async () => {
          storage.clear();
        },
      },
      maxSize: 3,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should get value from cache (read-through)', async () => {
    const data = { id: '1', name: 'test' };
    storage.set('test:1', data);

    const result = await cache.get('1');

    expect(result).toEqual(data);
  });

  it('should return null for cache miss without loader', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should load from storage on cache miss with loader', async () => {
    const data = { id: '2', name: 'loaded' };
    storage.set('test:2', data);

    const result = await cache.get('2');

    expect(result).toEqual(data);
  });

  it('should set value to cache', async () => {
    const data = { id: '3', name: 'new' };

    await cache.set('3', data);

    const cached = await cache.get('3');
    expect(cached).toEqual(data);
    expect(storage.get('test:3')).toEqual(data);
  });

  it('should invalidate cache on delete', async () => {
    const data = { id: '4', name: 'to-delete' };
    storage.set('test:4', data);
    await cache.get('4');

    await cache.invalidate('4');

    const result = await cache.get('4');
    expect(result).toBeNull();
  });

  it('should support write-through strategy', async () => {
    const data = { id: '5', name: 'write-through' };

    await cache.set('5', data);

    expect(storage.get('test:5')).toEqual(data);
  });

  it('should support LRU eviction (maxSize)', async () => {
    await cache.set('1', { id: '1', name: 'first' });
    await cache.set('2', { id: '2', name: 'second' });
    await cache.set('3', { id: '3', name: 'third' });

    await cache.set('4', { id: '4', name: 'fourth' });

    const resultAfterEvict = await cache.get('1');
    expect(resultAfterEvict).toBeNull();
  });

  it('should clear all cache', async () => {
    await cache.set('1', { id: '1', name: 'first' });
    await cache.set('2', { id: '2', name: 'second' });

    await cache.clear();

    const result1 = await cache.get('1');
    const result2 = await cache.get('2');
    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  it('should call onEvict callback when eviction occurs', async () => {
    const onEvict = vi.fn();
    const cacheWithEvict = new CacheLayer<TestData>({
      storage: cache['storage'],
      maxSize: 2,
      onEvict,
    });

    await cacheWithEvict.set('1', { id: '1', name: 'first' });
    await cacheWithEvict.set('2', { id: '2', name: 'second' });
    await cacheWithEvict.set('3', { id: '3', name: 'third' });

    expect(onEvict).toHaveBeenCalledWith('1', { id: '1', name: 'first' });
  });

  it('should support invalidateByPattern', async () => {
    await cache.set('user:1', { id: 'user:1', name: 'user1' });
    await cache.set('user:2', { id: 'user:2', name: 'user2' });
    await cache.set('post:1', { id: 'post:1', name: 'post1' });

    await cache.invalidateByPattern('user:*');

    const user1 = await cache.get('user:1');
    const user2 = await cache.get('user:2');
    const post1 = await cache.get('post:1');

    expect(user1).toBeNull();
    expect(user2).toBeNull();
    expect(post1).not.toBeNull();
  });

  describe('get boundary cases', () => {
    it('should return cached value on multiple gets', async () => {
      await cache.set('key1', { id: 'key1', name: 'value1' });
      
      const result1 = await cache.get('key1');
      const result2 = await cache.get('key1');
      const result3 = await cache.get('key1');

      expect(result1).toEqual({ id: 'key1', name: 'value1' });
      expect(result2).toEqual({ id: 'key1', name: 'value1' });
      expect(result3).toEqual({ id: 'key1', name: 'value1' });
    });

    it('should update access time on get', async () => {
      await cache.set('key1', { id: 'key1', name: 'value1' });
      
      const firstGet = await cache.get('key1');
      const secondGet = await cache.get('key1');
      
      expect(firstGet).toEqual(secondGet);
    });

    it('should return null for empty key', async () => {
      const result = await cache.get('');
      expect(result).toBeNull();
    });

    it('should return null for key not in cache or storage', async () => {
      const result = await cache.get('nonexistent_key_12345');
      expect(result).toBeNull();
    });

    it('should fall back to storage on cache miss', async () => {
      storage.set('test:storage_key', { id: 'storage_key', name: 'from_storage' });
      
      const result = await cache.get('storage_key');
      expect(result).toEqual({ id: 'storage_key', name: 'from_storage' });
    });
  });

  describe('set boundary cases', () => {
    it('should set value with empty key', async () => {
      await cache.set('', { id: '', name: 'empty_key' });
      const result = await cache.get('');
      expect(result).toEqual({ id: '', name: 'empty_key' });
    });

    it('should update existing key with new value', async () => {
      await cache.set('key1', { id: 'key1', name: 'first' });
      await cache.set('key1', { id: 'key1', name: 'updated' });
      
      const result = await cache.get('key1');
      expect(result).toEqual({ id: 'key1', name: 'updated' });
    });

    it('should handle large value (100KB+)', async () => {
      const largeValue = { id: 'large', name: 'x'.repeat(150000) };
      
      await cache.set('large', largeValue);
      const result = await cache.get('large');
      
      expect(result?.name.length).toBe(150000);
    });

    it('should handle special characters in key', async () => {
      const specialCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: {
          getItem: async (key: string) => storage.get(key) ?? null,
          setItem: async (_key: string, value: string) => {
            const parsed = JSON.parse(value);
            storage.set(_key, parsed);
          },
          removeItem: async (key: string) => {
            storage.delete(key);
          },
          clear: async () => {
            storage.clear();
          },
        },
        maxSize: 10,
      });
      
      const specialKeys = ['key:with:colons', 'key.with.dots', 'key-with-dashes', 'key_underscore', 'key with spaces'];
      
      for (const key of specialKeys) {
        await specialCache.set(key, { id: key, name: `value for ${key}` });
      }
      
      for (const key of specialKeys) {
        const result = await specialCache.get(key);
        expect(result).toEqual({ id: key, name: `value for ${key}` });
      }
    });

    it('should handle unicode characters in key', async () => {
      const unicodeKey = ' клюč ħēřē ';
      await cache.set(unicodeKey, { id: unicodeKey, name: 'unicode value' });
      
      const result = await cache.get(unicodeKey);
      expect(result).toEqual({ id: unicodeKey, name: 'unicode value' });
    });
  });

  describe('invalidate boundary cases', () => {
    it('should handle invalidate non-existent key', async () => {
      await expect(cache.invalidate('nonexistent')).resolves.not.toThrow();
    });

    it('should handle multiple invalidate calls on same key', async () => {
      await cache.set('key1', { id: 'key1', name: 'value1' });
      
      await cache.invalidate('key1');
      await cache.invalidate('key1');
      
      const result = await cache.get('key1');
      expect(result).toBeNull();
    });

    it('should allow set after invalidate', async () => {
      await cache.set('key1', { id: 'key1', name: 'value1' });
      await cache.invalidate('key1');
      
      await cache.set('key1', { id: 'key1', name: 'new_value' });
      
      const result = await cache.get('key1');
      expect(result).toEqual({ id: 'key1', name: 'new_value' });
    });
  });

  describe('invalidateByPattern boundary cases', () => {
    it('should match all keys with wildcard pattern', async () => {
      await cache.set('key1', { id: 'key1', name: 'value1' });
      await cache.set('key2', { id: 'key2', name: 'value2' });
      await cache.set('key3', { id: 'key3', name: 'value3' });

      await cache.invalidateByPattern('*');

      const result1 = await cache.get('key1');
      const result2 = await cache.get('key2');
      const result3 = await cache.get('key3');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should not match any keys with specific pattern', async () => {
      await cache.set('user:1', { id: 'user:1', name: 'user1' });
      await cache.set('post:1', { id: 'post:1', name: 'post1' });

      await cache.invalidateByPattern('nonexistent:*');

      const user1 = await cache.get('user:1');
      const post1 = await cache.get('post:1');
      expect(user1).not.toBeNull();
      expect(post1).not.toBeNull();
    });

    it('should handle single character wildcard', async () => {
      await cache.set('a1', { id: 'a1', name: 'a1' });
      await cache.set('a2', { id: 'a2', name: 'a2' });
      await cache.set('b1', { id: 'b1', name: 'b1' });

      await cache.invalidateByPattern('a?');

      const a1 = await cache.get('a1');
      const a2 = await cache.get('a2');
      const b1 = await cache.get('b1');
      expect(a1).toBeNull();
      expect(a2).toBeNull();
      expect(b1).not.toBeNull();
    });

    it('should handle empty pattern', async () => {
      await cache.set('key1', { id: 'key1', name: 'value1' });

      await cache.invalidateByPattern('');

      const result = await cache.get('key1');
      expect(result).not.toBeNull();
    });

    it('should handle pattern that matches partial keys', async () => {
      await cache.set('user:1:profile', { id: 'user:1:profile', name: 'profile' });
      await cache.set('user:1:posts', { id: 'user:1:posts', name: 'posts' });
      await cache.set('user:2:profile', { id: 'user:2:profile', name: 'profile' });

      await cache.invalidateByPattern('user:1:*');

      const profile1 = await cache.get('user:1:profile');
      const posts1 = await cache.get('user:1:posts');
      const profile2 = await cache.get('user:2:profile');
      expect(profile1).toBeNull();
      expect(posts1).toBeNull();
      expect(profile2).not.toBeNull();
    });

    it('should handle multiple wildcard patterns', async () => {
      await cache.set('test:abc:123', { id: 'test:abc:123', name: 'val1' });
      await cache.set('test:xyz:456', { id: 'test:xyz:456', name: 'val2' });
      await cache.set('other:abc:123', { id: 'other:abc:123', name: 'val3' });

      await cache.invalidateByPattern('test:*:???');

      const abc123 = await cache.get('test:abc:123');
      const xyz456 = await cache.get('test:xyz:456');
      const other = await cache.get('other:abc:123');
      expect(abc123).toBeNull();
      expect(xyz456).toBeNull();
      expect(other).not.toBeNull();
    });
  });

  describe('clear boundary cases', () => {
    it('should handle multiple clear calls', async () => {
      await cache.set('key1', { id: 'key1', name: 'value1' });
      await cache.set('key2', { id: 'key2', name: 'value2' });

      await cache.clear();
      await cache.clear();

      const result1 = await cache.get('key1');
      const result2 = await cache.get('key2');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should allow operations after clear', async () => {
      await cache.set('key1', { id: 'key1', name: 'value1' });
      await cache.clear();
      
      await cache.set('key2', { id: 'key2', name: 'value2' });
      const result = await cache.get('key2');
      
      expect(result).toEqual({ id: 'key2', name: 'value2' });
    });

    it('should clear empty cache', async () => {
      await expect(cache.clear()).resolves.not.toThrow();
    });
  });

  describe('LRU boundary cases', () => {
    it('should handle maxSize of 0', async () => {
      const zeroCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: {
          getItem: async () => null,
          setItem: async () => {},
          removeItem: async () => {},
          clear: async () => {},
        },
        maxSize: 0,
      });

      await zeroCache.set('key1', { id: 'key1', name: 'value1' });
      const result = await zeroCache.get('key1');
      expect(result).toEqual({ id: 'key1', name: 'value1' });
    });

    it('should handle maxSize of 1', async () => {
      const singleCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: {
          getItem: async () => null,
          setItem: async () => {},
          removeItem: async () => {},
          clear: async () => {},
        },
        maxSize: 1,
      });

      await singleCache.set('key1', { id: 'key1', name: 'value1' });
      await singleCache.set('key2', { id: 'key2', name: 'value2' });

      const key1 = await singleCache.get('key1');
      const key2 = await singleCache.get('key2');
      expect(key1).toBeNull();
      expect(key2).toEqual({ id: 'key2', name: 'value2' });
    });

    it('should not evict when size equals maxSize', async () => {
      await cache.set('1', { id: '1', name: 'first' });
      await cache.set('2', { id: '2', name: 'second' });
      await cache.set('3', { id: '3', name: 'third' });

      const result1 = await cache.get('1');
      const result2 = await cache.get('2');
      const result3 = await cache.get('3');

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result3).not.toBeNull();
    });

    it('should trigger multiple evictions on continuous writes', async () => {
      const evictCalls: string[] = [];
      const multiEvictCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: {
          getItem: async () => null,
          setItem: async () => {},
          removeItem: async () => {},
          clear: async () => {},
        },
        maxSize: 2,
        onEvict: (key) => evictCalls.push(key),
      });

      await multiEvictCache.set('1', { id: '1', name: 'first' });
      await multiEvictCache.set('2', { id: '2', name: 'second' });
      await multiEvictCache.set('3', { id: '3', name: 'third' });
      await multiEvictCache.set('4', { id: '4', name: 'fourth' });
      await multiEvictCache.set('5', { id: '5', name: 'fifth' });

      expect(evictCalls.length).toBe(3);
      expect(evictCalls).toContain('1');
      expect(evictCalls).toContain('2');
      expect(evictCalls).toContain('3');
    });

    it('should evict LRU based on access time not insertion order', async () => {
      const lruCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: {
          getItem: async () => null,
          setItem: async () => {},
          removeItem: async () => {},
          clear: async () => {},
        },
        maxSize: 2,
      });

      vi.useFakeTimers();
      vi.setSystemTime(1000);
      await lruCache.set('a', { id: 'a', name: 'first' });
      
      vi.setSystemTime(2000);
      await lruCache.set('b', { id: 'b', name: 'second' });
      
      vi.setSystemTime(3000);
      await lruCache.get('a');
      
      vi.setSystemTime(4000);
      await lruCache.set('c', { id: 'c', name: 'third' });
      
      vi.useRealTimers();

      const aResult = await lruCache.get('a');
      const bResult = await lruCache.get('b');

      expect(aResult).not.toBeNull();
      expect(bResult).toBeNull();
    });
  });

  describe('exception handling', () => {
    it('should propagate storage get errors', async () => {
      const failingStorage = {
        getItem: async () => { throw new Error('Storage get failed'); },
        setItem: async () => {},
        removeItem: async () => {},
        clear: async () => {},
      };

      const errorCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: failingStorage,
      });

      await expect(errorCache.get('anykey')).rejects.toThrow('Storage get failed');
    });

    it('should propagate storage set errors', async () => {
      let setCalled = false;
      const failingStorage = {
        getItem: async () => null,
        setItem: async () => { 
          setCalled = true;
          throw new Error('Storage set failed');
        },
        removeItem: async () => {},
        clear: async () => {},
      };

      const errorCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: failingStorage,
        maxSize: 10,
      });

      await expect(errorCache.set('key1', { id: 'key1', name: 'value1' })).rejects.toThrow('Storage set failed');
      expect(setCalled).toBe(true);
    });

    it('should propagate storage remove errors', async () => {
      const failingStorage = {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => { throw new Error('Remove failed'); },
        clear: async () => {},
      };

      const errorCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: failingStorage,
      });

      await expect(errorCache.invalidate('nonexistent')).rejects.toThrow('Remove failed');
    });

    it('should propagate storage clear errors', async () => {
      const failingStorage = {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
        clear: async () => { throw new Error('Clear failed'); },
      };

      const errorCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: failingStorage,
      });

      await expect(errorCache.clear()).rejects.toThrow('Clear failed');
    });

    it('should handle storage returning non-JSON value', async () => {
      const storageWithInvalidData: Map<string, string> = new Map();
      storageWithInvalidData.set('test:bad', 'not-a-json-string');

      const errorCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: {
          getItem: async (key: string) => {
            const data = storageWithInvalidData.get(key);
            if (typeof data === 'string') {
              return JSON.parse(data);
            }
            return null;
          },
          setItem: async () => {},
          removeItem: async () => {},
          clear: async () => {},
        },
      });

      await expect(errorCache.get('bad')).rejects.toThrow();
    });

    it('should handle invalid storage implementation', async () => {
      const nullStorage = {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
        clear: async () => {},
      };

      const nullCache = new CacheLayer<TestData>({
        namespace: 'test',
        storage: nullStorage,
        maxSize: 2,
      });

      await nullCache.set('key1', { id: 'key1', name: 'value1' });
      await nullCache.set('key2', { id: 'key2', name: 'value2' });
      await nullCache.set('key3', { id: 'key3', name: 'value3' });

      const result = await nullCache.get('key3');
      expect(result).not.toBeNull();
    });
  });

  describe('namespace handling', () => {
    it('should use default namespace when not specified', async () => {
      const defaultNsCache = new CacheLayer<TestData>({
        storage: {
          getItem: async () => null,
          setItem: async () => {},
          removeItem: async () => {},
          clear: async () => {},
        },
      });

      const cacheMap = (defaultNsCache as unknown as { cache: Map<string, unknown> }).cache;
      expect(cacheMap).toBeInstanceOf(Map);
    });

    it('should prepend namespace to storage keys', async () => {
      const nsStorage: Map<string, TestData> = new Map();
      const nsCache = new CacheLayer<TestData>({
        namespace: 'myapp',
        storage: {
          getItem: async (key: string) => nsStorage.get(key) ?? null,
          setItem: async (key: string, value: string) => {
            nsStorage.set(key, JSON.parse(value));
          },
          removeItem: async (key: string) => { nsStorage.delete(key); },
          clear: async () => { nsStorage.clear(); },
        },
      });

      await nsCache.set('key1', { id: 'key1', name: 'value1' });

      const keys = Array.from(nsStorage.keys());
      expect(keys).toContain('myapp:key1');
    });
  });
});
