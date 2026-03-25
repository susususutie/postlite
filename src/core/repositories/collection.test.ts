import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollectionRepository } from './collection';
import type { StorageStrategy, StorageCollection, StorageItem } from '../../storage/types';

describe('CollectionRepository', () => {
  let mockStorage: StorageStrategy;
  let repository: CollectionRepository;

  const createMockStorageCollection = (overrides: Partial<StorageCollection> = {}): StorageCollection => ({
    id: 'test-id',
    name: 'Test Collection',
    description: 'Test description',
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
    repository = new CollectionRepository(mockStorage);
  });

  describe('create', () => {
    it('should create collection', async () => {
      const input = {
        name: 'New Collection',
        description: 'Description',
      };
      const storageCollection = createMockStorageCollection({ name: input.name, description: input.description });
      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.create(input);

      expect(mockStorage.createCollection).toHaveBeenCalled();
      expect(result.name).toBe(input.name);
      expect(result.description).toBe(input.description);
      expect(result.folders).toEqual([]);
      expect(result.requests).toEqual([]);
    });

    it('should return domain model', async () => {
      const storageCollection = createMockStorageCollection();
      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.create({ name: 'Test' });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('folders');
      expect(result).toHaveProperty('requests');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });
  });

  describe('findById', () => {
    it('should get collection by id', async () => {
      const storageCollection = createMockStorageCollection({ id: 'collection-123' });
      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.findById('collection-123');

      expect(mockStorage.getCollection).toHaveBeenCalledWith('collection-123');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('collection-123');
    });

    it('should return null when not found', async () => {
      mockStorage.getCollection = vi.fn().mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should get all collections', async () => {
      const storageCollections = [
        createMockStorageCollection({ id: '1' }),
        createMockStorageCollection({ id: '2' }),
      ];
      mockStorage.getAllCollections = vi.fn().mockResolvedValue(storageCollections);

      const result = await repository.findAll();

      expect(mockStorage.getAllCollections).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should return domain models', async () => {
      const storageCollections = [createMockStorageCollection()];
      mockStorage.getAllCollections = vi.fn().mockResolvedValue(storageCollections);

      const result = await repository.findAll();

      expect(result[0]).toHaveProperty('folders');
      expect(result[0]).toHaveProperty('requests');
    });
  });

  describe('update', () => {
    it('should update collection', async () => {
      const storageCollection = createMockStorageCollection({
        id: 'collection-123',
        name: 'Updated Name',
      });
      mockStorage.updateCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.update('collection-123', { name: 'Updated Name' });

      expect(mockStorage.updateCollection).toHaveBeenCalledWith('collection-123', { name: 'Updated Name' });
      expect(result?.name).toBe('Updated Name');
    });

    it('should return null when not found', async () => {
      mockStorage.updateCollection = vi.fn().mockResolvedValue(null);

      const result = await repository.update('non-existent', { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete collection', async () => {
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(true);

      const result = await repository.delete('collection-123');

      expect(mockStorage.deleteCollection).toHaveBeenCalledWith('collection-123');
      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(false);

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('createMany', () => {
    it('should create multiple collections', async () => {
      const inputs = [
        { name: 'Collection 1', description: 'Desc 1' },
        { name: 'Collection 2', description: 'Desc 2' },
        { name: 'Collection 3', description: 'Desc 3' },
      ];
      mockStorage.createCollection = vi.fn().mockImplementation(async (data) => data as StorageCollection);

      const results = await repository.createMany(inputs);

      expect(results).toHaveLength(3);
      expect(mockStorage.createCollection).toHaveBeenCalledTimes(3);
    });

    it('should create collections with generated ids', async () => {
      mockStorage.createCollection = vi.fn().mockImplementation(async (data) => data as StorageCollection);

      const results = await repository.createMany([{ name: 'Test 1' }, { name: 'Test 2' }]);

      results.forEach((result, index) => {
        expect(result.id).toBeDefined();
        expect(result.name).toBe(`Test ${index + 1}`);
      });
    });

    it('should return empty array for empty input', async () => {
      const results = await repository.createMany([]);

      expect(results).toEqual([]);
      expect(mockStorage.createCollection).not.toHaveBeenCalled();
    });
  });

  describe('updateMany', () => {
    it('should update multiple collections', async () => {
      const updates = [
        { id: 'col-1', name: 'Updated 1' },
        { id: 'col-2', name: 'Updated 2' },
      ];
      mockStorage.updateCollection = vi.fn().mockImplementation(async (id, data) => ({
        id,
        name: data.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as StorageCollection));

      const results = await repository.updateMany(updates);

      expect(results).toHaveLength(2);
      expect(mockStorage.updateCollection).toHaveBeenCalledTimes(2);
    });

    it('should return null for non-existent collections', async () => {
      mockStorage.updateCollection = vi.fn().mockResolvedValue(null);

      const results = await repository.updateMany([{ id: 'non-existent', name: 'Test' }]);

      expect(results[0]).toBeNull();
    });

    it('should handle partial updates', async () => {
      mockStorage.updateCollection = vi.fn().mockImplementation(async (id, data) => ({
        id,
        name: data.name || 'Default',
        description: data.description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as StorageCollection));

      const results = await repository.updateMany([
        { id: 'col-1', name: 'Updated' },
        { id: 'col-2', description: 'New Description' },
      ]);

      expect(results[0]?.name).toBe('Updated');
      expect(results[1]?.description).toBe('New Description');
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple collections', async () => {
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(true);

      const results = await repository.deleteMany(['col-1', 'col-2', 'col-3']);

      expect(results).toEqual([true, true, true]);
      expect(mockStorage.deleteCollection).toHaveBeenCalledTimes(3);
    });

    it('should handle partial deletion failures', async () => {
      mockStorage.deleteCollection = vi.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const results = await repository.deleteMany(['col-1', 'col-2', 'col-3']);

      expect(results).toEqual([true, false, true]);
    });

    it('should return empty array for empty input', async () => {
      const results = await repository.deleteMany([]);

      expect(results).toEqual([]);
      expect(mockStorage.deleteCollection).not.toHaveBeenCalled();
    });
  });

  describe('withTransaction', () => {
    it('should execute function within transaction', async () => {
      const mockTransaction = {
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      };
      mockStorage.transaction = vi.fn().mockResolvedValue(mockTransaction);

      const result = await repository.withTransaction(async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockStorage.transaction).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockTransaction = {
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      };
      mockStorage.transaction = vi.fn().mockResolvedValue(mockTransaction);

      await expect(
        repository.withTransaction(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it('should commit on success', async () => {
      const mockTransaction = {
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      };
      mockStorage.transaction = vi.fn().mockResolvedValue(mockTransaction);

      await repository.withTransaction(async () => {
        mockStorage.createCollection({} as StorageCollection);
      });

      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();
    });
  });

  describe('create - edge cases', () => {
    it('should create collection with empty name', async () => {
      const input = { name: '' };
      const storageCollection = createMockStorageCollection({ name: '' });
      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.create(input);

      expect(result.name).toBe('');
    });

    it('should create collection with whitespace-only name', async () => {
      const input = { name: '   \t\n   ' };
      const storageCollection = createMockStorageCollection({ name: input.name });
      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.create(input);

      expect(result.name).toBe('   \t\n   ');
    });

    it('should create collection with very long name (1000+ characters)', async () => {
      const longName = 'A'.repeat(1000);
      const input = { name: longName };
      const storageCollection = createMockStorageCollection({ name: longName });
      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.create(input);

      expect(result.name).toHaveLength(1000);
    });

    it('should create collection with only description', async () => {
      const input = { name: 'Test', description: 'Only description' };
      const storageCollection = createMockStorageCollection(input);
      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.create(input);

      expect(result.name).toBe('Test');
      expect(result.description).toBe('Only description');
    });

    it('should create collection with special characters (emoji)', async () => {
      const input = { name: '🎉🚀 collection' };
      const storageCollection = createMockStorageCollection(input);
      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.create(input);

      expect(result.name).toBe('🎉🚀 collection');
    });

    it('should create collection with HTML characters', async () => {
      const input = { name: '<div>Test</div>' };
      const storageCollection = createMockStorageCollection(input);
      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.create(input);

      expect(result.name).toBe('<div>Test</div>');
    });

    it('should create collection with undefined description', async () => {
      const input = { name: 'Test' };
      const storageCollection = createMockStorageCollection({ ...input, description: undefined });
      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.create(input);

      expect(result.description).toBeUndefined();
    });

    it('should create collection with special unicode characters', async () => {
      const input = { name: '日本語收藏中文' };
      const storageCollection = createMockStorageCollection(input);
      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.create(input);

      expect(result.name).toBe('日本語收藏中文');
    });
  });

  describe('findById - edge cases', () => {
    it('should return null for non-existent id', async () => {
      mockStorage.getCollection = vi.fn().mockResolvedValue(null);

      const result = await repository.findById('non-existent-id-12345');

      expect(result).toBeNull();
    });

    it('should return null for null id', async () => {
      mockStorage.getCollection = vi.fn().mockResolvedValue(null);

      const result = await repository.findById(null as unknown as string);

      expect(result).toBeNull();
    });

    it('should return null for undefined id', async () => {
      mockStorage.getCollection = vi.fn().mockResolvedValue(null);

      const result = await repository.findById(undefined as unknown as string);

      expect(result).toBeNull();
    });

    it('should return null for empty string id', async () => {
      mockStorage.getCollection = vi.fn().mockResolvedValue(null);

      const result = await repository.findById('');

      expect(result).toBeNull();
    });

    it('should return collection with folders and requests', async () => {
      const storageCollection = createMockStorageCollection({ id: 'col-1' });
      const storageItems: StorageItem[] = [
        {
          id: 'folder-1',
          collectionId: 'col-1',
          parentId: null,
          type: 'folder',
          name: 'Folder 1',
          data: { description: 'Folder desc' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'req-1',
          collectionId: 'col-1',
          parentId: null,
          type: 'request',
          name: 'Request 1',
          data: { method: 'GET', url: 'https://api.example.com' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(storageItems);

      const result = await repository.findById('col-1');

      expect(result).not.toBeNull();
      expect(result?.folders).toHaveLength(1);
      expect(result?.requests).toHaveLength(1);
    });
  });

  describe('findAll - edge cases', () => {
    it('should return empty array when database is empty', async () => {
      mockStorage.getAllCollections = vi.fn().mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should handle large number of collections (100+)', async () => {
      const storageCollections = Array.from({ length: 150 }, (_, i) =>
        createMockStorageCollection({ id: `col-${i}`, name: `Collection ${i}` })
      );
      mockStorage.getAllCollections = vi.fn().mockResolvedValue(storageCollections);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toHaveLength(150);
    });

    it('should handle collections with no items', async () => {
      const storageCollections = [createMockStorageCollection({ id: 'col-1' })];
      mockStorage.getAllCollections = vi.fn().mockResolvedValue(storageCollections);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result[0].folders).toEqual([]);
      expect(result[0].requests).toEqual([]);
    });
  });

  describe('update - edge cases', () => {
    it('should return null for non-existent id', async () => {
      mockStorage.updateCollection = vi.fn().mockResolvedValue(null);

      const result = await repository.update('non-existent', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('should update with empty name to clear name', async () => {
      const storageCollection = createMockStorageCollection({ name: '' });
      mockStorage.updateCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.update('col-1', { name: '' });

      expect(result?.name).toBe('');
    });

    it('should update only description field', async () => {
      const storageCollection = createMockStorageCollection({ description: 'New description' });
      mockStorage.updateCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.update('col-1', { description: 'New description' });

      expect(result?.description).toBe('New description');
    });

    it('should update both name and description', async () => {
      const storageCollection = createMockStorageCollection({ name: 'New Name', description: 'New Desc' });
      mockStorage.updateCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.update('col-1', { name: 'New Name', description: 'New Desc' });

      expect(result?.name).toBe('New Name');
      expect(result?.description).toBe('New Desc');
    });

    it('should update with undefined fields preserved', async () => {
      const storageCollection = createMockStorageCollection({ description: undefined });
      mockStorage.updateCollection = vi.fn().mockResolvedValue(storageCollection);

      const result = await repository.update('col-1', { name: 'New' });

      expect(result).not.toBeNull();
    });
  });

  describe('delete - edge cases', () => {
    it('should return false for non-existent id', async () => {
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(false);

      const result = await repository.delete('non-existent-id');

      expect(result).toBe(false);
    });

    it('should handle multiple deletes of same id', async () => {
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(true);

      const result1 = await repository.delete('col-1');
      const result2 = await repository.delete('col-1');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockStorage.deleteCollection).toHaveBeenCalledTimes(2);
    });

    it('should delete and return true for valid id', async () => {
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(true);

      const result = await repository.delete('valid-id');

      expect(result).toBe(true);
    });
  });

  describe('createMany - edge cases', () => {
    it('should return empty array for empty input array', async () => {
      const results = await repository.createMany([]);

      expect(results).toEqual([]);
      expect(mockStorage.createCollection).not.toHaveBeenCalled();
    });

    it('should create collections with duplicate names', async () => {
      const inputs = [
        { name: 'Same Name' },
        { name: 'Same Name' },
        { name: 'Same Name' },
      ];
      mockStorage.createCollection = vi.fn().mockImplementation(async (data) => data as StorageCollection);

      const results = await repository.createMany(inputs);

      expect(results).toHaveLength(3);
    });
  });

  describe('updateMany - edge cases', () => {
    it('should handle updates with non-existent ids', async () => {
      mockStorage.updateCollection = vi.fn().mockResolvedValue(null);

      const results = await repository.updateMany([
        { id: 'non-existent-1', name: 'Test 1' },
        { id: 'non-existent-2', name: 'Test 2' },
      ]);

      expect(results[0]).toBeNull();
      expect(results[1]).toBeNull();
    });

    it('should handle empty update array', async () => {
      const results = await repository.updateMany([]);

      expect(results).toEqual([]);
      expect(mockStorage.updateCollection).not.toHaveBeenCalled();
    });

    it('should handle mixed existing and non-existing ids', async () => {
      mockStorage.updateCollection = vi.fn()
        .mockResolvedValueOnce({ id: 'col-1', name: 'Updated', createdAt: Date.now(), updatedAt: Date.now() } as StorageCollection)
        .mockResolvedValueOnce(null);

      const results = await repository.updateMany([
        { id: 'col-1', name: 'Updated' },
        { id: 'non-existent', name: 'Test' },
      ]);

      expect(results[0]).not.toBeNull();
      expect(results[1]).toBeNull();
    });
  });

  describe('deleteMany - edge cases', () => {
    it('should return empty array for empty input array', async () => {
      const results = await repository.deleteMany([]);

      expect(results).toEqual([]);
      expect(mockStorage.deleteCollection).not.toHaveBeenCalled();
    });

    it('should handle all non-existent ids', async () => {
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(false);

      const results = await repository.deleteMany(['non-1', 'non-2', 'non-3']);

      expect(results).toEqual([false, false, false]);
    });
  });

  describe('withTransaction - edge cases', () => {
    it('should handle transaction that returns null', async () => {
      const mockTransaction = {
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      };
      mockStorage.transaction = vi.fn().mockResolvedValue(mockTransaction);

      const result = await repository.withTransaction(async () => {
        return null;
      });

      expect(result).toBeNull();
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('should handle async operations in transaction', async () => {
      const mockTransaction = {
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      };
      mockStorage.transaction = vi.fn().mockResolvedValue(mockTransaction);

      const result = await repository.withTransaction(async () => {
        await Promise.resolve();
        return { success: true };
      });

      expect(result).toEqual({ success: true });
    });
  });
});