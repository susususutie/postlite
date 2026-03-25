import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemRepository } from './item';
import type { StorageStrategy, StorageItem } from '../../storage/types';

describe('ItemRepository', () => {
  let mockStorage: StorageStrategy;
  let repository: ItemRepository;

  const createMockStorageItem = (overrides: Partial<StorageItem> = {}): StorageItem => ({
    id: 'item-id',
    collectionId: 'collection-123',
    parentId: null,
    type: 'request',
    name: 'Test Item',
    data: {
      method: 'GET',
      url: 'https://api.example.com',
      headers: [],
      params: [],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(async () => {
    mockStorage = {
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      isOpen: vi.fn().mockReturnValue(true),
      getAllCollections: vi.fn().mockResolvedValue([]),
      getCollection: vi.fn().mockResolvedValue(null),
      createCollection: vi.fn(),
      updateCollection: vi.fn(),
      deleteCollection: vi.fn(),
      getAllItems: vi.fn().mockResolvedValue([]),
      getItem: vi.fn().mockResolvedValue(null),
      getItemsByCollectionId: vi.fn().mockResolvedValue([]),
      getItemsByParentId: vi.fn().mockResolvedValue([]),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      deleteItemsByCollectionId: vi.fn().mockResolvedValue(true),
      transaction: vi.fn(),
      batch: vi.fn(),
    };
    repository = new ItemRepository(mockStorage);
  });

  describe('create', () => {
    it('should create item (request)', async () => {
      const input = {
        type: 'request' as const,
        name: 'New Request',
        collectionId: 'collection-123',
        parentId: null,
        data: {
          method: 'POST',
          url: 'https://api.example.com/users',
          headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
          params: [],
          body: { mode: 'json' as const, content: '{"name": "test"}' },
        },
      };
      const storageItem = createMockStorageItem(input);
      mockStorage.createItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.create(input);

      expect(mockStorage.createItem).toHaveBeenCalled();
      expect(result.name).toBe(input.name);
      expect(result.type).toBe('request');
    });

    it('should create item (folder)', async () => {
      const input = {
        type: 'folder' as const,
        name: 'New Folder',
        collectionId: 'collection-123',
        parentId: null,
        data: { description: 'Folder description' },
      };
      const storageItem = createMockStorageItem({ ...input, type: 'folder' });
      mockStorage.createItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.create(input);

      expect(result.type).toBe('folder');
      expect(result.name).toBe(input.name);
    });
  });

  describe('findById', () => {
    it('should get item by id', async () => {
      const storageItem = createMockStorageItem({ id: 'item-123' });
      mockStorage.getItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.findById('item-123');

      expect(mockStorage.getItem).toHaveBeenCalledWith('item-123');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('item-123');
    });

    it('should return null when not found', async () => {
      mockStorage.getItem = vi.fn().mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByCollectionId', () => {
    it('should query items by collectionId', async () => {
      const storageItems = [
        createMockStorageItem({ id: 'item-1', collectionId: 'collection-123' }),
        createMockStorageItem({ id: 'item-2', collectionId: 'collection-123' }),
      ];
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(storageItems);

      const result = await repository.findByCollectionId('collection-123');

      expect(mockStorage.getItemsByCollectionId).toHaveBeenCalledWith('collection-123');
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no items', async () => {
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);

      const result = await repository.findByCollectionId('collection-123');

      expect(result).toEqual([]);
    });
  });

  describe('findByParentId', () => {
    it('should query items by parentId (build tree)', async () => {
      const storageItems = [
        createMockStorageItem({ id: 'item-1', parentId: 'folder-1' }),
        createMockStorageItem({ id: 'item-2', parentId: 'folder-1' }),
      ];
      mockStorage.getItemsByParentId = vi.fn().mockResolvedValue(storageItems);

      const result = await repository.findByParentId('folder-1');

      expect(mockStorage.getItemsByParentId).toHaveBeenCalledWith('folder-1');
      expect(result).toHaveLength(2);
    });

    it('should return root items when parentId is null', async () => {
      const storageItems = [
        createMockStorageItem({ id: 'item-1', parentId: null }),
        createMockStorageItem({ id: 'item-2', parentId: null }),
      ];
      mockStorage.getAllItems = vi.fn().mockResolvedValue(storageItems);

      const result = await repository.findByParentId(null);

      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update item', async () => {
      const storageItem = createMockStorageItem({
        id: 'item-123',
        name: 'Updated Name',
      });
      mockStorage.updateItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.update('item-123', { name: 'Updated Name' });

      expect(mockStorage.updateItem).toHaveBeenCalledWith('item-123', { name: 'Updated Name' });
      expect(result?.name).toBe('Updated Name');
    });

    it('should return null when not found', async () => {
      mockStorage.updateItem = vi.fn().mockResolvedValue(null);

      const result = await repository.update('non-existent', { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete item', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(true);

      const result = await repository.delete('item-123');

      expect(mockStorage.deleteItem).toHaveBeenCalledWith('item-123');
      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(false);

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('deleteByCollectionId', () => {
    it('should delete items when collection deleted', async () => {
      mockStorage.deleteItemsByCollectionId = vi.fn().mockResolvedValue(true);

      const result = await repository.deleteByCollectionId('collection-123');

      expect(mockStorage.deleteItemsByCollectionId).toHaveBeenCalledWith('collection-123');
      expect(result).toBe(true);
    });
  });

  describe('build tree structure', () => {
    it('should build tree structure from flat items', async () => {
      const storageItems = [
        createMockStorageItem({ id: 'folder-1', type: 'folder', parentId: null, name: 'Root Folder' }),
        createMockStorageItem({ id: 'request-1', type: 'request', parentId: 'folder-1', name: 'Request 1' }),
        createMockStorageItem({ id: 'folder-2', type: 'folder', parentId: 'folder-1', name: 'Nested Folder' }),
        createMockStorageItem({ id: 'request-2', type: 'request', parentId: 'folder-2', name: 'Request 2' }),
        createMockStorageItem({ id: 'request-3', type: 'request', parentId: null, name: 'Root Request' }),
      ];
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(storageItems);

      const result = await repository.findByCollectionId('collection-123');

      const rootItems = result.filter((item) => item.parentId === null);
      expect(rootItems).toHaveLength(2);
    });
  });

  describe('createMany', () => {
    it('should create multiple items', async () => {
      const inputs = [
        { type: 'request' as const, name: 'Request 1', collectionId: 'col-1', parentId: null, data: { method: 'GET' } },
        { type: 'request' as const, name: 'Request 2', collectionId: 'col-1', parentId: null, data: { method: 'POST' } },
        { type: 'folder' as const, name: 'Folder 1', collectionId: 'col-1', parentId: null, data: {} },
      ];
      mockStorage.createItem = vi.fn().mockImplementation(async (data) => data as StorageItem);

      const results = await repository.createMany(inputs);

      expect(results).toHaveLength(3);
      expect(mockStorage.createItem).toHaveBeenCalledTimes(3);
    });

    it('should create items with generated ids', async () => {
      mockStorage.createItem = vi.fn().mockImplementation(async (data) => data as StorageItem);

      const results = await repository.createMany([
        { type: 'request' as const, name: 'Test 1', collectionId: 'col-1', parentId: null, data: {} },
        { type: 'request' as const, name: 'Test 2', collectionId: 'col-1', parentId: null, data: {} },
      ]);

      results.forEach((result, index) => {
        expect(result.id).toBeDefined();
        expect(result.name).toBe(`Test ${index + 1}`);
      });
    });

    it('should return empty array for empty input', async () => {
      const results = await repository.createMany([]);

      expect(results).toEqual([]);
      expect(mockStorage.createItem).not.toHaveBeenCalled();
    });
  });

  describe('updateMany', () => {
    it('should update multiple items', async () => {
      const updates = [
        { id: 'item-1', name: 'Updated 1' },
        { id: 'item-2', name: 'Updated 2' },
      ];
      mockStorage.updateItem = vi.fn().mockImplementation(async (id, data) => ({
        id,
        name: data.name,
        collectionId: 'col-1',
        type: 'request' as const,
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as StorageItem));

      const results = await repository.updateMany(updates);

      expect(results).toHaveLength(2);
      expect(mockStorage.updateItem).toHaveBeenCalledTimes(2);
    });

    it('should return null for non-existent items', async () => {
      mockStorage.updateItem = vi.fn().mockResolvedValue(null);

      const results = await repository.updateMany([{ id: 'non-existent', name: 'Test' }]);

      expect(results[0]).toBeNull();
    });

    it('should handle partial updates', async () => {
      mockStorage.updateItem = vi.fn().mockImplementation(async (id, data) => ({
        id,
        name: data.name || 'Default',
        collectionId: 'col-1',
        type: 'request' as const,
        data: data.data || {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as StorageItem));

      const results = await repository.updateMany([
        { id: 'item-1', name: 'Updated' },
        { id: 'item-2', data: { method: 'PUT' } },
      ]);

      expect(results[0]?.name).toBe('Updated');
      expect(results[1]?.data).toEqual({ method: 'PUT' });
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple items', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(true);

      const results = await repository.deleteMany(['item-1', 'item-2', 'item-3']);

      expect(results).toEqual([true, true, true]);
      expect(mockStorage.deleteItem).toHaveBeenCalledTimes(3);
    });

    it('should handle partial deletion failures', async () => {
      mockStorage.deleteItem = vi.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const results = await repository.deleteMany(['item-1', 'item-2', 'item-3']);

      expect(results).toEqual([true, false, true]);
    });

    it('should return empty array for empty input', async () => {
      const results = await repository.deleteMany([]);

      expect(results).toEqual([]);
      expect(mockStorage.deleteItem).not.toHaveBeenCalled();
    });
  });

  describe('create - edge cases', () => {
    it('should create item with no parentId (root level)', async () => {
      const input = {
        type: 'request' as const,
        name: 'Root Request',
        collectionId: 'col-1',
        parentId: null,
        data: { method: 'GET', url: 'https://api.example.com' },
      };
      const storageItem = createMockStorageItem({ parentId: null });
      mockStorage.createItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.create(input);

      expect(result.parentId).toBeNull();
    });

    it('should create item with non-existent parentId', async () => {
      const input = {
        type: 'request' as const,
        name: 'Nested Request',
        collectionId: 'col-1',
        parentId: 'non-existent-folder',
        data: { method: 'POST', url: 'https://api.example.com' },
      };
      const storageItem = createMockStorageItem({ parentId: 'non-existent-folder' });
      mockStorage.createItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.create(input);

      expect(result.parentId).toBe('non-existent-folder');
    });

    it('should create folder type with full data', async () => {
      const input = {
        type: 'folder' as const,
        name: 'Folder',
        collectionId: 'col-1',
        parentId: null,
        data: { description: 'Folder description', custom: 'field' },
      };
      const storageItem = createMockStorageItem({ type: 'folder', data: input.data });
      mockStorage.createItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.create(input);

      expect(result.type).toBe('folder');
      expect(result.data).toEqual(input.data);
    });

    it('should create request without body', async () => {
      const input = {
        type: 'request' as const,
        name: 'Request without body',
        collectionId: 'col-1',
        parentId: null,
        data: { method: 'GET', url: 'https://api.example.com' },
      };
      const storageItem = createMockStorageItem({ data: input.data });
      mockStorage.createItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.create(input);

      expect(result.data.body).toBeUndefined();
    });

    it('should create item with empty data object', async () => {
      const input = {
        type: 'folder' as const,
        name: 'Empty Data Folder',
        collectionId: 'col-1',
        parentId: null,
        data: {},
      };
      const storageItem = createMockStorageItem({ data: {} });
      mockStorage.createItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.create(input);

      expect(result.data).toEqual({});
    });

    it('should create item with special characters in name', async () => {
      const input = {
        type: 'request' as const,
        name: 'Test @#$%^&*()',
        collectionId: 'col-1',
        parentId: null,
        data: {},
      };
      const storageItem = createMockStorageItem({ name: input.name });
      mockStorage.createItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.create(input);

      expect(result.name).toBe('Test @#$%^&*()');
    });
  });

  describe('findById - edge cases', () => {
    it('should return null for non-existent id', async () => {
      mockStorage.getItem = vi.fn().mockResolvedValue(null);

      const result = await repository.findById('non-existent-id-12345');

      expect(result).toBeNull();
    });

    it('should return null for null id', async () => {
      mockStorage.getItem = vi.fn().mockResolvedValue(null);

      const result = await repository.findById(null as unknown as string);

      expect(result).toBeNull();
    });

    it('should return null for undefined id', async () => {
      mockStorage.getItem = vi.fn().mockResolvedValue(null);

      const result = await repository.findById(undefined as unknown as string);

      expect(result).toBeNull();
    });

    it('should return null for empty string id', async () => {
      mockStorage.getItem = vi.fn().mockResolvedValue(null);

      const result = await repository.findById('');

      expect(result).toBeNull();
    });
  });

  describe('findByCollectionId - edge cases', () => {
    it('should return empty array for non-existent collectionId', async () => {
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);

      const result = await repository.findByCollectionId('non-existent-collection');

      expect(result).toEqual([]);
    });

    it('should return empty array when collection has no items', async () => {
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);

      const result = await repository.findByCollectionId('col-1');

      expect(result).toEqual([]);
    });

    it('should handle large number of items (100+)', async () => {
      const storageItems = Array.from({ length: 150 }, (_, i) =>
        createMockStorageItem({ id: `item-${i}`, collectionId: 'col-1', parentId: null })
      );
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(storageItems);

      const result = await repository.findByCollectionId('col-1');

      expect(result).toHaveLength(150);
    });

    it('should return items with mixed types (folder and request)', async () => {
      const storageItems = [
        createMockStorageItem({ id: 'folder-1', type: 'folder', collectionId: 'col-1' }),
        createMockStorageItem({ id: 'req-1', type: 'request', collectionId: 'col-1' }),
        createMockStorageItem({ id: 'folder-2', type: 'folder', collectionId: 'col-1' }),
        createMockStorageItem({ id: 'req-2', type: 'request', collectionId: 'col-1' }),
      ];
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(storageItems);

      const result = await repository.findByCollectionId('col-1');

      expect(result.filter(i => i.type === 'folder')).toHaveLength(2);
      expect(result.filter(i => i.type === 'request')).toHaveLength(2);
    });
  });

  describe('findByParentId - edge cases', () => {
    it('should return empty array when parent has no children', async () => {
      mockStorage.getItemsByParentId = vi.fn().mockResolvedValue([]);

      const result = await repository.findByParentId('folder-without-children');

      expect(result).toEqual([]);
    });

    it('should return empty array for non-existent parentId', async () => {
      mockStorage.getItemsByParentId = vi.fn().mockResolvedValue([]);

      const result = await repository.findByParentId('non-existent-parent');

      expect(result).toEqual([]);
    });

    it('should handle deep nesting levels', async () => {
      const storageItems = [
        createMockStorageItem({ id: 'req-deep', parentId: 'folder-level-3', name: 'Deep Request' }),
      ];
      mockStorage.getItemsByParentId = vi.fn().mockResolvedValue(storageItems);

      const result = await repository.findByParentId('folder-level-3');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Deep Request');
    });

    it('should return root items for null parentId', async () => {
      const storageItems = [
        createMockStorageItem({ id: 'root-1', parentId: null }),
        createMockStorageItem({ id: 'root-2', parentId: null }),
        createMockStorageItem({ id: 'child-1', parentId: 'folder-1' }),
      ];
      mockStorage.getAllItems = vi.fn().mockResolvedValue(storageItems);

      const result = await repository.findByParentId(null);

      expect(result).toHaveLength(2);
    });

    it('should handle undefined parentId in storage', async () => {
      const storageItems = [
        createMockStorageItem({ id: 'item-1', parentId: undefined }),
      ];
      mockStorage.getAllItems = vi.fn().mockResolvedValue(storageItems);

      const result = await repository.findByParentId(null);

      expect(result).toHaveLength(1);
    });
  });

  describe('update - edge cases', () => {
    it('should move item to root level (parentId = null)', async () => {
      const storageItem = createMockStorageItem({ parentId: null });
      mockStorage.updateItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.update('item-1', { parentId: null });

      expect(result?.parentId).toBeNull();
    });

    it('should move item to non-existent parent', async () => {
      const storageItem = createMockStorageItem({ parentId: 'non-existent-parent' });
      mockStorage.updateItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.update('item-1', { parentId: 'non-existent-parent' });

      expect(result?.parentId).toBe('non-existent-parent');
    });

    it('should update only data field', async () => {
      const newData = { method: 'PUT', url: 'https://api.example.com/updated' };
      const storageItem = createMockStorageItem({ data: newData });
      mockStorage.updateItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.update('item-1', { data: newData });

      expect(result?.data).toEqual(newData);
    });

    it('should return null for non-existent item', async () => {
      mockStorage.updateItem = vi.fn().mockResolvedValue(null);

      const result = await repository.update('non-existent', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('should update with empty name', async () => {
      const storageItem = createMockStorageItem({ name: '' });
      mockStorage.updateItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.update('item-1', { name: '' });

      expect(result?.name).toBe('');
    });

    it('should preserve data when not updating data field', async () => {
      const existingData = { method: 'GET', url: 'https://api.example.com' };
      const storageItem = createMockStorageItem({ name: 'New Name', data: existingData });
      mockStorage.updateItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.update('item-1', { name: 'New Name' });

      expect(result?.name).toBe('New Name');
      expect(result?.data).toEqual(existingData);
    });
  });

  describe('delete - edge cases', () => {
    it('should return false for non-existent item', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(false);

      const result = await repository.delete('non-existent-id');

      expect(result).toBe(false);
    });

    it('should delete successfully for valid id', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(true);

      const result = await repository.delete('valid-id');

      expect(result).toBe(true);
    });
  });

  describe('deleteByCollectionId - edge cases', () => {
    it('should return true for non-existent collection', async () => {
      mockStorage.deleteItemsByCollectionId = vi.fn().mockResolvedValue(true);

      const result = await repository.deleteByCollectionId('non-existent-collection');

      expect(result).toBe(true);
    });

    it('should delete all items in collection', async () => {
      mockStorage.deleteItemsByCollectionId = vi.fn().mockResolvedValue(true);

      const result = await repository.deleteByCollectionId('col-1');

      expect(mockStorage.deleteItemsByCollectionId).toHaveBeenCalledWith('col-1');
      expect(result).toBe(true);
    });
  });

  describe('createMany - edge cases', () => {
    it('should return empty array for empty input', async () => {
      const results = await repository.createMany([]);

      expect(results).toEqual([]);
      expect(mockStorage.createItem).not.toHaveBeenCalled();
    });

    it('should create items with same name', async () => {
      const inputs = [
        { type: 'request' as const, name: 'Same Name', collectionId: 'col-1', parentId: null, data: {} },
        { type: 'request' as const, name: 'Same Name', collectionId: 'col-1', parentId: null, data: {} },
      ];
      mockStorage.createItem = vi.fn().mockImplementation(async (data) => data as StorageItem);

      const results = await repository.createMany(inputs);

      expect(results).toHaveLength(2);
    });

    it('should create items in different collections', async () => {
      const inputs = [
        { type: 'request' as const, name: 'Req 1', collectionId: 'col-1', parentId: null, data: {} },
        { type: 'request' as const, name: 'Req 2', collectionId: 'col-2', parentId: null, data: {} },
      ];
      mockStorage.createItem = vi.fn().mockImplementation(async (data) => data as StorageItem);

      const results = await repository.createMany(inputs);

      expect(results[0].collectionId).toBe('col-1');
      expect(results[1].collectionId).toBe('col-2');
    });
  });

  describe('updateMany - edge cases', () => {
    it('should return empty array for empty input', async () => {
      const results = await repository.updateMany([]);

      expect(results).toEqual([]);
      expect(mockStorage.updateItem).not.toHaveBeenCalled();
    });

    it('should handle updates with non-existent ids', async () => {
      mockStorage.updateItem = vi.fn().mockResolvedValue(null);

      const results = await repository.updateMany([
        { id: 'non-1', name: 'Test 1' },
        { id: 'non-2', name: 'Test 2' },
      ]);

      expect(results[0]).toBeNull();
      expect(results[1]).toBeNull();
    });

    it('should handle mixed valid and invalid ids', async () => {
      mockStorage.updateItem = vi.fn()
        .mockResolvedValueOnce({ id: 'item-1', name: 'Updated', collectionId: 'col-1', type: 'request', data: {}, createdAt: Date.now(), updatedAt: Date.now() } as StorageItem)
        .mockResolvedValueOnce(null);

      const results = await repository.updateMany([
        { id: 'item-1', name: 'Updated' },
        { id: 'non-existent', name: 'Test' },
      ]);

      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
    });
  });

  describe('deleteMany - edge cases', () => {
    it('should return empty array for empty input', async () => {
      const results = await repository.deleteMany([]);

      expect(results).toEqual([]);
      expect(mockStorage.deleteItem).not.toHaveBeenCalled();
    });

    it('should handle all non-existent ids', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(false);

      const results = await repository.deleteMany(['non-1', 'non-2', 'non-3']);

      expect(results).toEqual([false, false, false]);
    });
  });

  describe('toDomainModel - edge cases', () => {
    it('should handle storage item with undefined parentId', async () => {
      const storageItem: StorageItem = {
        id: 'item-1',
        collectionId: 'col-1',
        parentId: undefined,
        type: 'request',
        name: 'Test',
        data: { method: 'GET' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      mockStorage.getItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.findById('item-1');

      expect(result?.parentId).toBeNull();
    });

    it('should handle storage item with null parentId', async () => {
      const storageItem = createMockStorageItem({ parentId: null });
      mockStorage.getItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.findById('item-1');

      expect(result?.parentId).toBeNull();
    });

    it('should preserve complex data structure', async () => {
      const complexData = {
        method: 'POST',
        url: 'https://api.example.com',
        headers: [
          { key: 'Content-Type', value: 'application/json', enabled: true },
          { key: 'Authorization', value: 'Bearer token', enabled: false },
        ],
        params: [
          { key: 'page', value: '1', enabled: true },
        ],
        body: { mode: 'json' as const, content: '{"key": "value"}' },
      };
      const storageItem = createMockStorageItem({ data: complexData });
      mockStorage.getItem = vi.fn().mockResolvedValue(storageItem);

      const result = await repository.findById('item-1');

      expect(result?.data).toEqual(complexData);
    });
  });
});