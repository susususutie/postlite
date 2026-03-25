import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import {
  register,
  unregister,
  get,
  getAll,
  detectAndParse,
  exportCollection,
  getAdapterNames,
} from './index';
import type { Adapter } from './core';
import { postmanAdapter } from './postman';
import { swaggerAdapter } from './swagger';

describe('Adapter Registry', () => {
  beforeEach(() => {
    unregister('test-adapter');
    unregister('adapter1');
    unregister('adapter2');
    unregister('name1');
    unregister('name2');
  });

  afterEach(() => {
    unregister('test-adapter');
    unregister('adapter1');
    unregister('adapter2');
    unregister('name1');
    unregister('name2');
  });

  const createMockAdapter = (name: string): Adapter => ({
    name,
    supportedFormats: ['test'],
    detect: vi.fn((data: unknown) => data === name),
    parse: vi.fn((data: unknown) => ({ name: data as string, items: [] })),
    export: vi.fn((ir: { name: string; items: unknown[] }) => JSON.stringify(ir)),
  });

  describe('register', () => {
    it('should register an adapter', () => {
      const mockAdapter = createMockAdapter('test-adapter');
      register(mockAdapter);
      expect(get('test-adapter')).toBe(mockAdapter);
    });

    it('should throw when registering duplicate adapter', () => {
      const mockAdapter = createMockAdapter('test-adapter');
      register(mockAdapter);
      expect(() => register(mockAdapter)).toThrow("Adapter 'test-adapter' is already registered");
    });
  });

  describe('unregister', () => {
    it('should unregister an existing adapter', () => {
      const mockAdapter = createMockAdapter('test-adapter');
      register(mockAdapter);
      expect(unregister('test-adapter')).toBe(true);
      expect(get('test-adapter')).toBeUndefined();
    });

    it('should return false for non-existent adapter', () => {
      expect(unregister('non-existent')).toBe(false);
    });
  });

  describe('get', () => {
    it('should return registered adapter', () => {
      const mockAdapter = createMockAdapter('test-adapter');
      register(mockAdapter);
      expect(get('test-adapter')).toBe(mockAdapter);
    });

    it('should return undefined for non-existent adapter', () => {
      expect(get('non-existent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered adapters', () => {
      const adapter1 = createMockAdapter('adapter1');
      const adapter2 = createMockAdapter('adapter2');
      register(adapter1);
      register(adapter2);
      const all = getAll();
      expect(all).toHaveLength(2);
      expect(all.map(a => a.name)).toContain('adapter1');
      expect(all.map(a => a.name)).toContain('adapter2');
    });
  });

  describe('detectAndParse', () => {
    it('should detect and parse with matching adapter', () => {
      const mockAdapter = createMockAdapter('test-adapter');
      register(mockAdapter);
      const result = detectAndParse('test-adapter');
      expect(result).not.toBeNull();
      expect(result?.adapter).toBe(mockAdapter);
      expect(mockAdapter.parse).toHaveBeenCalledWith('test-adapter');
    });

    it('should return null when no adapter matches', () => {
      const mockAdapter = createMockAdapter('test-adapter');
      register(mockAdapter);
      expect(detectAndParse('not-matching')).toBeNull();
    });

    it('should return null when no adapters registered', () => {
      expect(detectAndParse('anything')).toBeNull();
    });
  });

  describe('exportCollection', () => {
    it('should export using registered adapter', () => {
      const mockAdapter = createMockAdapter('test-adapter');
      register(mockAdapter);
      const ir = { name: 'Test', items: [] };
      const result = exportCollection('test-adapter', ir);
      expect(mockAdapter.export).toHaveBeenCalledWith(ir);
      expect(result).toBe(JSON.stringify(ir));
    });

    it('should throw for non-existent adapter', () => {
      expect(() => exportCollection('non-existent', { name: 'Test', items: [] })).toThrow(
        "Adapter 'non-existent' not found"
      );
    });
  });

  describe('getAdapterNames', () => {
    it('should return all registered adapter names', () => {
      const adapter1 = createMockAdapter('name1');
      const adapter2 = createMockAdapter('name2');
      register(adapter1);
      register(adapter2);
      expect(getAdapterNames()).toEqual(['name1', 'name2']);
    });
  });

  describe('Adapter Registry boundary cases', () => {
    beforeEach(() => {
      unregister('empty-adapter');
      unregister('duplicate-test');
      unregister('empty-name-adapter');
      unregister('');
      unregister('multi-format');
      unregister('adapter1');
      unregister('adapter2');
      unregister('aa');
      unregister('bb');
      unregister('cc');
    });

    afterEach(() => {
      unregister('empty-adapter');
      unregister('duplicate-test');
      unregister('empty-name-adapter');
      unregister('');
      unregister('multi-format');
      unregister('adapter1');
      unregister('adapter2');
      unregister('aa');
      unregister('bb');
      unregister('cc');
    });

    describe('register boundary', () => {
      it('should register adapter with empty name', () => {
        const adapter: Adapter = {
          name: '',
          supportedFormats: ['test'],
          detect: () => true,
          parse: () => ({ name: 'Test', items: [] }),
          export: () => '{}'
        };
        register(adapter);
        expect(get('')).toBe(adapter);
      });

      it('should throw for duplicate adapter name', () => {
        const adapter1 = createMockAdapter('duplicate-test');
        const adapter2 = createMockAdapter('duplicate-test');
        register(adapter1);
        expect(() => register(adapter2)).toThrow("Adapter 'duplicate-test' is already registered");
      });

      it('should allow re-registering after unregister', () => {
        const adapter1 = createMockAdapter('duplicate-test');
        const adapter2 = createMockAdapter('duplicate-test');
        register(adapter1);
        unregister('duplicate-test');
        expect(() => register(adapter2)).not.toThrow();
      });

      it('should handle adapter with many supported formats', () => {
        const adapter: Adapter = {
          name: 'multi-format',
          supportedFormats: Array.from({ length: 50 }, (_, i) => `.format${i}`),
          detect: () => true,
          parse: () => ({ name: 'Test', items: [] }),
          export: () => '{}'
        };
        register(adapter);
        expect(get('multi-format')?.supportedFormats).toHaveLength(50);
      });
    });

    describe('unregister boundary', () => {
      it('should return false for non-existent adapter', () => {
        expect(unregister('non-existent-adapter')).toBe(false);
      });

      it('should return true for existing adapter', () => {
        const adapter = createMockAdapter('test-adapter');
        register(adapter);
        expect(unregister('test-adapter')).toBe(true);
      });

      it('should handle unregister multiple times', () => {
        const adapter = createMockAdapter('test-adapter');
        register(adapter);
        unregister('test-adapter');
        expect(unregister('test-adapter')).toBe(false);
      });
    });

    describe('get boundary', () => {
      it('should return undefined for empty name', () => {
        expect(get('')).toBeUndefined();
      });

      it('should return undefined for whitespace name', () => {
        expect(get('   ')).toBeUndefined();
      });

      it('should return adapter with empty name after register', () => {
        const adapter: Adapter = {
          name: '',
          supportedFormats: ['test'],
          detect: () => true,
          parse: () => ({ name: 'Test', items: [] }),
          export: () => '{}'
        };
        register(adapter);
        expect(get('')).toBe(adapter);
      });
    });

    describe('detectAndParse boundary', () => {
      it('should return null for empty data', () => {
        expect(detectAndParse({})).toBeNull();
      });

      it('should return null for null data', () => {
        expect(detectAndParse(null)).toBeNull();
      });

      it('should return null for undefined data', () => {
        expect(detectAndParse(undefined)).toBeNull();
      });

      it('should return null for invalid JSON string', () => {
        expect(detectAndParse('{invalid json')).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(detectAndParse('')).toBeNull();
      });

      it('should return null for empty array', () => {
        expect(detectAndParse([])).toBeNull();
      });

      it('should return null for number', () => {
        expect(detectAndParse(123)).toBeNull();
      });

      it('should return null for boolean', () => {
        expect(detectAndParse(true)).toBeNull();
      });

      it('should return first matching adapter in order', () => {
        const adapter1: Adapter = {
          name: 'adapter1',
          supportedFormats: ['format1'],
          detect: () => true,
          parse: () => ({ name: 'First', items: [] }),
          export: () => '{}'
        };
        const adapter2: Adapter = {
          name: 'adapter2',
          supportedFormats: ['format2'],
          detect: () => true,
          parse: () => ({ name: 'Second', items: [] }),
          export: () => '{}'
        };
        register(adapter1);
        register(adapter2);
        const result = detectAndParse('test');
        expect(result?.adapter.name).toBe('adapter1');
      });

      it('should handle adapters with overlapping detect logic', () => {
        const adapter1: Adapter = {
          name: 'adapter1',
          supportedFormats: ['overlap'],
          detect: (data: unknown) => typeof data === 'object' && data !== null && 'schema' in data,
          parse: () => ({ name: 'From overlap 1', items: [] }),
          export: () => '{}'
        };
        const adapter2: Adapter = {
          name: 'adapter2',
          supportedFormats: ['overlap'],
          detect: (data: unknown) => typeof data === 'object' && data !== null && 'schema' in data,
          parse: () => ({ name: 'From overlap 2', items: [] }),
          export: () => '{}'
        };
        register(adapter1);
        register(adapter2);
        const result = detectAndParse({ schema: 'test' });
        expect(result?.adapter.name).toBe('adapter1');
        expect(result?.ir.name).toBe('From overlap 1');
      });
    });

    describe('exportCollection boundary', () => {
      it('should throw for empty adapter name', () => {
        expect(() => exportCollection('', { name: 'Test', items: [] })).toThrow("Adapter '' not found");
      });

      it('should handle empty IR', () => {
        const adapter = createMockAdapter('test-adapter');
        register(adapter);
        const result = exportCollection('test-adapter', { name: '', items: [] });
        expect(result).toBeDefined();
      });

      it('should handle IR with many items', () => {
        const adapter = createMockAdapter('test-adapter');
        register(adapter);
        const items = Array.from({ length: 100 }, (_, i) => ({ id: `item-${i}`, type: 'request' as const, name: `Item ${i}`, method: 'GET' as const, url: `https://api.example.com/${i}` }));
        const result = exportCollection('test-adapter', { name: 'Many Items', items });
        expect(result).toBeDefined();
      });
    });

    describe('getAll boundary', () => {
      it('should return empty array when no adapters registered', () => {
        unregister('temp-adapter');
        const all = getAll();
        expect(Array.isArray(all)).toBe(true);
      });

      it('should return same adapter instance', () => {
        const adapter = createMockAdapter('test-adapter');
        register(adapter);
        const all = getAll();
        expect(all[0]).toBe(adapter);
      });
    });

    describe('getAdapterNames boundary', () => {
      it('should return empty array when no adapters', () => {
        unregister('temp-adapter');
        expect(getAdapterNames()).toEqual([]);
      });

      it('should return names in registration order', () => {
        unregister('aa');
        unregister('bb');
        unregister('cc');
        register(createMockAdapter('aa'));
        register(createMockAdapter('bb'));
        register(createMockAdapter('cc'));
        expect(getAdapterNames()).toEqual(['aa', 'bb', 'cc']);
      });
    });

    describe('multiple format detection priority', () => {
      beforeEach(() => {
        unregister('format-a');
        unregister('format-b');
        unregister('format-c');
        unregister('postman');
        unregister('swagger');
        register(postmanAdapter);
        register(swaggerAdapter);
      });

      afterEach(() => {
        unregister('format-a');
        unregister('format-b');
        unregister('format-c');
        unregister('postman');
        unregister('swagger');
      });

      it('should detect postman format correctly', () => {
        const postmanData = {
          info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
          item: []
        };
        const result = detectAndParse(postmanData);
        expect(result?.adapter.name).toBe('postman');
      });

      it('should detect swagger format correctly', () => {
        const swaggerData = {
          swagger: '2.0',
          info: { title: 'Test', version: '1.0' },
          paths: {}
        };
        const result = detectAndParse(swaggerData);
        expect(result?.adapter.name).toBe('swagger');
      });

      it('should handle both adapters registered simultaneously', () => {
        const postmanData = {
          info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
          item: []
        };
        const swaggerData = {
          swagger: '2.0',
          info: { title: 'Test', version: '1.0' },
          paths: {}
        };

        const postmanResult = detectAndParse(postmanData);
        const swaggerResult = detectAndParse(swaggerData);

        expect(postmanResult?.adapter.name).toBe('postman');
        expect(swaggerResult?.adapter.name).toBe('swagger');
      });
    });
  });
});
