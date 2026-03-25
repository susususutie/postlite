import { describe, it, expect } from 'vitest';
import type { CollectionIR } from './types';
import type { Adapter, ImportAdapter, ExportAdapter } from './adapter';

const mockCollectionIR: CollectionIR = {
  name: 'Test Collection',
  items: [
    {
      id: 'request-1',
      type: 'request',
      name: 'Test Request',
      method: 'GET',
      url: 'https://api.example.com/test'
    }
  ]
};

describe('Adapter', () => {
  it('should have detect method', () => {
    const adapter: ImportAdapter = {
      detect: (data: unknown) => {
        return typeof data === 'string' && data.includes('postman');
      },
      parse: (data: unknown) => {
        void data;
        return mockCollectionIR;
      }
    };

    expect(typeof adapter.detect).toBe('function');
    expect(adapter.detect('postman_collection')).toBe(true);
    expect(adapter.detect('swagger')).toBe(false);
  });

  it('should have parse method for import', () => {
    const adapter: ImportAdapter = {
      detect: () => true,
      parse: (data: unknown) => {
        void data;
        return mockCollectionIR;
      }
    };

    const result = adapter.parse({ test: 'data' });
    expect(result.name).toBe('Test Collection');
  });

  it('should have export method for export', () => {
    const adapter: ExportAdapter = {
      export: (ir: CollectionIR) => {
        return JSON.stringify(ir, null, 2);
      }
    };

    const result = adapter.export(mockCollectionIR);
    expect(typeof result).toBe('string');
    expect(result).toContain('Test Collection');
  });

  it('should throw error for unsupported format', () => {
    const adapter: ImportAdapter = {
      detect: () => false,
      parse: () => {
        throw new Error('Unsupported format');
      }
    };

    expect(() => adapter.parse({})).toThrow('Unsupported format');
  });
});

describe('Adapter interface', () => {
  it('should combine ImportAdapter and ExportAdapter', () => {
    const adapter: Adapter = {
      name: 'TestAdapter',
      supportedFormats: ['.test'],
      detect: () => true,
      parse: () => mockCollectionIR,
      export: () => '{}'
    };

    expect(adapter.name).toBe('TestAdapter');
    expect(adapter.supportedFormats).toContain('.test');
    expect(typeof adapter.detect).toBe('function');
    expect(typeof adapter.parse).toBe('function');
    expect(typeof adapter.export).toBe('function');
  });

  it('should have readonly name and supportedFormats', () => {
    const adapter: Adapter = {
      name: 'ReadonlyAdapter',
      supportedFormats: ['.readonly'],
      detect: () => true,
      parse: () => mockCollectionIR,
      export: () => '{}'
    };

    expect(adapter.name).toBe('ReadonlyAdapter');
    expect(adapter.supportedFormats).toHaveLength(1);
  });
});
