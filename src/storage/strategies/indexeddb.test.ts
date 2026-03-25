import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBStorage } from './indexeddb';
import type { StorageCollection, StorageItem, BatchOperation, BatchOperationType } from '../types';

const TEST_DB_NAME = 'postlite_test_db';

describe('IndexedDBStorage', () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    storage = new IndexedDBStorage({ dbName: TEST_DB_NAME, version: 1 });
    await storage.open();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('open/close', () => {
    it('should open database successfully', async () => {
      expect(storage.isOpen()).toBe(true);
    });

    it('should close database successfully', async () => {
      await storage.close();
      expect(storage.isOpen()).toBe(false);
    });

    it('should be able to reopen after close', async () => {
      await storage.close();
      await storage.open();
      expect(storage.isOpen()).toBe(true);
    });
  });

  describe('Collection CRUD', () => {
    it('should create a collection', async () => {
      const collection: StorageCollection = {
        id: 'col-1',
        name: 'Test Collection',
        description: 'Test Description',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const created = await storage.createCollection(collection);
      expect(created.id).toBe('col-1');
      expect(created.name).toBe('Test Collection');
    });

    it('should get all collections', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Collection 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.createCollection({
        id: 'col-2',
        name: 'Collection 2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(2);
    });

    it('should get collection by id', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const collection = await storage.getCollection('col-1');
      expect(collection).not.toBeNull();
      expect(collection!.name).toBe('Test Collection');
    });

    it('should return null for non-existent collection', async () => {
      const collection = await storage.getCollection('non-existent');
      expect(collection).toBeNull();
    });

    it('should update collection', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Original Name',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const updated = await storage.updateCollection('col-1', { name: 'Updated Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
    });

    it('should delete collection', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'To Delete',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await storage.deleteCollection('col-1');
      expect(result).toBe(true);

      const collection = await storage.getCollection('col-1');
      expect(collection).toBeNull();
    });
  });

  describe('Item CRUD', () => {
    it('should create an item', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const item: StorageItem = {
        id: 'item-1',
        collectionId: 'col-1',
        type: 'request',
        name: 'Test Request',
        data: { method: 'GET', url: 'https://example.com' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const created = await storage.createItem(item);
      expect(created.id).toBe('item-1');
      expect(created.name).toBe('Test Request');
    });

    it('should get item by id', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await storage.createItem({
        id: 'item-1',
        collectionId: 'col-1',
        type: 'request',
        name: 'Test Request',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const item = await storage.getItem('item-1');
      expect(item).not.toBeNull();
      expect(item!.name).toBe('Test Request');
    });

    it('should query items by collectionId', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.createCollection({
        id: 'col-2',
        name: 'Other Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await storage.createItem({
        id: 'item-1',
        collectionId: 'col-1',
        type: 'request',
        name: 'Request 1',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.createItem({
        id: 'item-2',
        collectionId: 'col-1',
        type: 'folder',
        name: 'Folder 1',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.createItem({
        id: 'item-3',
        collectionId: 'col-2',
        type: 'request',
        name: 'Request 2',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const items = await storage.getItemsByCollectionId('col-1');
      expect(items).toHaveLength(2);
    });

    it('should query items by parentId for tree structure', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await storage.createItem({
        id: 'folder-1',
        collectionId: 'col-1',
        type: 'folder',
        name: 'Folder 1',
        parentId: null,
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.createItem({
        id: 'item-1',
        collectionId: 'col-1',
        type: 'request',
        name: 'Request in Root',
        parentId: null,
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.createItem({
        id: 'item-2',
        collectionId: 'col-1',
        type: 'request',
        name: 'Request in Folder',
        parentId: 'folder-1',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const rootItems = await storage.getItemsByParentId(null);
      expect(rootItems).toHaveLength(2);

      const folderItems = await storage.getItemsByParentId('folder-1');
      expect(folderItems).toHaveLength(1);
      expect(folderItems[0].name).toBe('Request in Folder');
    });

    it('should update item', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await storage.createItem({
        id: 'item-1',
        collectionId: 'col-1',
        type: 'request',
        name: 'Original Name',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const updated = await storage.updateItem('item-1', { name: 'Updated Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
    });

    it('should delete item', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await storage.createItem({
        id: 'item-1',
        collectionId: 'col-1',
        type: 'request',
        name: 'To Delete',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await storage.deleteItem('item-1');
      expect(result).toBe(true);

      const item = await storage.getItem('item-1');
      expect(item).toBeNull();
    });

    it('should delete items when collection is deleted', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await storage.createItem({
        id: 'item-1',
        collectionId: 'col-1',
        type: 'request',
        name: 'Test Request',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await storage.deleteCollection('col-1');

      const items = await storage.getItemsByCollectionId('col-1');
      expect(items).toHaveLength(0);
    });
  });

  describe('Transaction', () => {
    it('should support transaction rollback', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Original Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const transaction = await storage.transaction();

      await storage.createCollection({
        id: 'col-2',
        name: 'New Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await transaction.rollback();

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('Original Collection');
    });

    it('should commit transaction', async () => {
      const transaction = await storage.transaction();

      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await transaction.commit();

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(1);
    });

    it('should rollback multiple operations', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Original 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.createItem({
        id: 'item-1',
        collectionId: 'col-1',
        type: 'request',
        name: 'Original Request',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const transaction = await storage.transaction();

      await storage.updateCollection('col-1', { name: 'Modified' });
      await storage.deleteItem('item-1');
      await storage.createCollection({
        id: 'col-2',
        name: 'New Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await transaction.rollback();

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('Original 1');

      const items = await storage.getAllItems();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Original Request');
    });

    it('should prevent double rollback', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const transaction = await storage.transaction();

      await storage.createCollection({
        id: 'col-2',
        name: 'New Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await transaction.rollback();
      await transaction.rollback();

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(1);
    });
  });

  describe('Batch Operations', () => {
    it('should batch create collections', async () => {
      const operations: BatchOperation[] = [
        { type: 'createCollection', id: 'col-1', data: { id: 'col-1', name: 'Batch 1', createdAt: Date.now(), updatedAt: Date.now() } },
        { type: 'createCollection', id: 'col-2', data: { id: 'col-2', name: 'Batch 2', createdAt: Date.now(), updatedAt: Date.now() } },
        { type: 'createCollection', id: 'col-3', data: { id: 'col-3', name: 'Batch 3', createdAt: Date.now(), updatedAt: Date.now() } },
      ];

      const result = await storage.batch(operations);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results.every((r) => r.success)).toBe(true);

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(3);
    });

    it('should batch create items', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test Collection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const operations: BatchOperation[] = [
        { type: 'createItem', id: 'item-1', data: { id: 'item-1', collectionId: 'col-1', type: 'request' as const, name: 'Request 1', data: {}, createdAt: Date.now(), updatedAt: Date.now() } },
        { type: 'createItem', id: 'item-2', data: { id: 'item-2', collectionId: 'col-1', type: 'folder' as const, name: 'Folder 1', data: {}, createdAt: Date.now(), updatedAt: Date.now() } },
      ];

      const result = await storage.batch(operations);

      expect(result.success).toBe(true);
      const items = await storage.getAllItems();
      expect(items).toHaveLength(2);
    });

    it('should batch update operations', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Original 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.createCollection({
        id: 'col-2',
        name: 'Original 2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const operations: BatchOperation[] = [
        { type: 'updateCollection', id: 'col-1', data: { name: 'Updated 1' } },
        { type: 'updateCollection', id: 'col-2', data: { name: 'Updated 2' } },
      ];

      const result = await storage.batch(operations);

      expect(result.success).toBe(true);

      const col1 = await storage.getCollection('col-1');
      const col2 = await storage.getCollection('col-2');
      expect(col1?.name).toBe('Updated 1');
      expect(col2?.name).toBe('Updated 2');
    });

    it('should batch delete operations', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'To Delete 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.createCollection({
        id: 'col-2',
        name: 'To Delete 2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const operations: BatchOperation[] = [
        { type: 'deleteCollection', id: 'col-1' },
        { type: 'deleteCollection', id: 'col-2' },
      ];

      const result = await storage.batch(operations);

      expect(result.success).toBe(true);

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(0);
    });

    it('should handle mixed batch operations', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Original',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const operations: BatchOperation[] = [
        { type: 'createCollection', id: 'col-2', data: { id: 'col-2', name: 'New', createdAt: Date.now(), updatedAt: Date.now() } },
        { type: 'updateCollection', id: 'col-1', data: { name: 'Updated' } },
        { type: 'deleteCollection', id: 'col-2' },
      ];

      const result = await storage.batch(operations);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);

      const col1 = await storage.getCollection('col-1');
      expect(col1?.name).toBe('Updated');

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(1);
    });

    it('should return partial success on batch failure', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Existing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const operations: BatchOperation[] = [
        { type: 'createCollection', id: 'col-2', data: { id: 'col-2', name: 'New', createdAt: Date.now(), updatedAt: Date.now() } },
        { type: 'updateCollection', id: 'non-existent', data: { name: 'Fail' } },
      ];

      const result = await storage.batch(operations);

      expect(result.success).toBe(false);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });

  describe('Database Operation Boundaries', () => {
    it('should handle database name with special characters', async () => {
      const specialStorage = new IndexedDBStorage({ dbName: 'test_db-123_special', version: 1 });
      await specialStorage.open();
      expect(specialStorage.isOpen()).toBe(true);
      await specialStorage.close();
    });

    it('should handle multiple open calls without error', async () => {
      await storage.open();
      await storage.open();
      await storage.open();
      expect(storage.isOpen()).toBe(true);
    });

    it('should handle multiple close calls without error', async () => {
      await storage.close();
      await storage.close();
      await storage.close();
      expect(storage.isOpen()).toBe(false);
    });

    it('should reopen after close', async () => {
      await storage.close();
      expect(storage.isOpen()).toBe(false);
      await storage.open();
      expect(storage.isOpen()).toBe(true);
    });

    it('should throw error when accessing closed database', async () => {
      await storage.close();
      expect(() => storage.getAllCollections()).rejects.toThrow('Database is not open');
    });

    it('should handle concurrent open calls', async () => {
      await Promise.all([storage.open(), storage.open()]);
      expect(storage.isOpen()).toBe(true);
    });
  });

  describe('Collection CRUD Boundaries', () => {
    it('should handle large number of collections (100+)', async () => {
      const collections: StorageCollection[] = [];
      for (let i = 0; i < 100; i++) {
        collections.push({
          id: `col-${i}`,
          name: `Collection ${i}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      for (const col of collections) {
        await storage.createCollection(col);
      }

      const all = await storage.getAllCollections();
      expect(all).toHaveLength(100);
    });

    it('should handle collection id collision - updates existing', async () => {
      const col: StorageCollection = {
        id: 'col-same',
        name: 'First',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await storage.createCollection(col);

      const created = await storage.createCollection({ ...col, name: 'Second' });
      expect(created.name).toBe('Second');
    });

    it('should handle missing required fields - creates with available data', async () => {
      const result = await storage.createCollection({ id: 'col-1' } as StorageCollection);
      expect(result.id).toBe('col-1');
    });

    it('should handle very long collection name', async () => {
      const longName = 'a'.repeat(10000);
      const col: StorageCollection = {
        id: 'col-long',
        name: longName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const created = await storage.createCollection(col);
      expect(created.name).toBe(longName);
    });

    it('should handle very long description', async () => {
      const longDesc = 'b'.repeat(20000);
      const col: StorageCollection = {
        id: 'col-desc',
        name: 'Test',
        description: longDesc,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const created = await storage.createCollection(col);
      expect(created.description).toBe(longDesc);
    });

    it('should update non-existent collection returns null', async () => {
      const result = await storage.updateCollection('non-existent', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should delete non-existent collection returns false', async () => {
      const result = await storage.deleteCollection('non-existent');
      expect(result).toBe(false);
    });

    it('should handle empty collection name', async () => {
      const col: StorageCollection = {
        id: 'col-empty',
        name: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const created = await storage.createCollection(col);
      expect(created.name).toBe('');
    });
  });

  describe('Item CRUD Boundaries', () => {
    it('should handle large number of items (200+)', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      for (let i = 0; i < 200; i++) {
        await storage.createItem({
          id: `item-${i}`,
          collectionId: 'col-1',
          type: 'request',
          name: `Request ${i}`,
          data: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const items = await storage.getItemsByCollectionId('col-1');
      expect(items).toHaveLength(200);
    });

    it('should handle single collection with many items (150+)', async () => {
      await storage.createCollection({
        id: 'col-many',
        name: 'Many Items',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      for (let i = 0; i < 150; i++) {
        await storage.createItem({
          id: `item-${i}`,
          collectionId: 'col-many',
          type: i % 2 === 0 ? 'folder' : 'request',
          name: `Item ${i}`,
          data: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const items = await storage.getItemsByCollectionId('col-many');
      expect(items).toHaveLength(150);
    });

    it('should handle deeply nested items (5+ levels)', async () => {
      await storage.createCollection({
        id: 'col-nested',
        name: 'Nested',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      let parentId: string | null = null;
      for (let i = 0; i < 6; i++) {
        const item = await storage.createItem({
          id: `folder-${i}`,
          collectionId: 'col-nested',
          type: 'folder',
          name: `Level ${i}`,
          parentId,
          data: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        parentId = item.id;
      }

      const rootItems = await storage.getItemsByParentId(null);
      expect(rootItems).toHaveLength(1);
    });

    it('should handle item id collision - updates existing', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const item: StorageItem = {
        id: 'item-same',
        collectionId: 'col-1',
        type: 'request',
        name: 'First',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await storage.createItem(item);

      const created = await storage.createItem({ ...item, name: 'Second' });
      expect(created.name).toBe('Second');
    });

    it('should handle missing required fields in item - creates with available data', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await storage.createItem({ id: 'item-1' } as StorageItem);
      expect(result.id).toBe('item-1');
    });

    it('should handle invalid type value gracefully', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const item: StorageItem = {
        id: 'item-1',
        collectionId: 'col-1',
        type: 'invalid-type' as 'folder',
        name: 'Test',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const created = await storage.createItem(item);
      expect(created.type).toBe('invalid-type');
    });

    it('should update non-existent item returns null', async () => {
      const result = await storage.updateItem('non-existent', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should handle delete non-existent item - mock returns true', async () => {
      const result = await storage.deleteItem('non-existent');
      expect(result).toBe(true);
    });
  });

  describe('Query Boundaries', () => {
    it('should return empty array for non-existent collectionId', async () => {
      const items = await storage.getItemsByCollectionId('non-existent');
      expect(items).toHaveLength(0);
    });

    it('should return empty array for non-existent parentId', async () => {
      const items = await storage.getItemsByParentId('non-existent');
      expect(items).toHaveLength(0);
    });

    it('should return empty array when querying root items that do not exist', async () => {
      const items = await storage.getItemsByParentId(null);
      expect(items).toHaveLength(0);
    });

    it('should return empty array after all items deleted', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await storage.createItem({
        id: 'item-1',
        collectionId: 'col-1',
        type: 'request',
        name: 'Test',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await storage.deleteItem('item-1');

      const items = await storage.getItemsByCollectionId('col-1');
      expect(items).toHaveLength(0);
    });

    it('should handle query with null parentId correctly', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await storage.createItem({
        id: 'item-root',
        collectionId: 'col-1',
        type: 'request',
        name: 'Root',
        parentId: null,
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const rootItems = await storage.getItemsByParentId(null!);
      expect(rootItems).toHaveLength(1);
    });

    it('should filter items correctly by collectionId', async () => {
      await storage.createCollection({ id: 'col-1', name: 'Col 1', createdAt: Date.now(), updatedAt: Date.now() });
      await storage.createCollection({ id: 'col-2', name: 'Col 2', createdAt: Date.now(), updatedAt: Date.now() });

      for (let i = 0; i < 10; i++) {
        await storage.createItem({
          id: `item-c1-${i}`,
          collectionId: 'col-1',
          type: 'request',
          name: `Item ${i}`,
          data: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await storage.createItem({
          id: `item-c2-${i}`,
          collectionId: 'col-2',
          type: 'request',
          name: `Item ${i}`,
          data: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const col1Items = await storage.getItemsByCollectionId('col-1');
      const col2Items = await storage.getItemsByCollectionId('col-2');
      expect(col1Items).toHaveLength(10);
      expect(col2Items).toHaveLength(10);
    });
  });

  describe('Transaction Boundaries', () => {
    it('should rollback collection CRUD in transaction', async () => {
      await storage.createCollection({
        id: 'col-original',
        name: 'Original',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const tx = await storage.transaction();

      await storage.createCollection({
        id: 'col-new',
        name: 'New',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.updateCollection('col-original', { name: 'Modified' });
      await storage.deleteCollection('col-new');

      await tx.rollback();

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('Original');
    });

    it('should rollback item CRUD in transaction', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.createItem({
        id: 'item-original',
        collectionId: 'col-1',
        type: 'request',
        name: 'Original',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const tx = await storage.transaction();

      await storage.createItem({
        id: 'item-new',
        collectionId: 'col-1',
        type: 'request',
        name: 'New',
        data: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await storage.updateItem('item-original', { name: 'Modified' });
      await storage.deleteItem('item-new');

      await tx.rollback();

      const items = await storage.getAllItems();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Original');
    });

    it('should handle transaction on closed database throws error', async () => {
      await storage.close();
      await expect(storage.transaction()).rejects.toThrow('Database is not open');
    });

    it('should preserve original state after multiple rollbacks', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const tx1 = await storage.transaction();
      await storage.createCollection({ id: 'col-2', name: 'New', createdAt: Date.now(), updatedAt: Date.now() });
      await tx1.rollback();

      const tx2 = await storage.transaction();
      await storage.createCollection({ id: 'col-3', name: 'Another', createdAt: Date.now(), updatedAt: Date.now() });
      await tx2.rollback();

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].id).toBe('col-1');
    });

    it('should handle transaction with delete operations', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'To Delete',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const tx = await storage.transaction();
      await storage.deleteCollection('col-1');
      await tx.rollback();

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(1);
    });
  });

  describe('Batch Boundaries', () => {
    it('should handle empty operations array', async () => {
      const result = await storage.batch([]);
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
    });

    it('should handle batch with mixed valid and invalid operations', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Existing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const operations: BatchOperation[] = [
        { type: 'createCollection', id: 'col-2', data: { id: 'col-2', name: 'Valid', createdAt: Date.now(), updatedAt: Date.now() } },
        { type: 'createCollection' },
        { type: 'updateCollection', id: 'col-1', data: { name: 'Updated' } },
        { type: 'deleteCollection' },
        { type: 'updateItem', id: 'non-existent', data: { name: 'Test' } },
      ];

      const result = await storage.batch(operations);
      expect(result.success).toBe(false);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[2].success).toBe(true);
      expect(result.results[3].success).toBe(false);
    });

    it('should handle large batch operations (100+)', async () => {
      const operations: BatchOperation[] = [];
      for (let i = 0; i < 100; i++) {
        operations.push({
          type: 'createCollection',
          id: `col-${i}`,
          data: { id: `col-${i}`, name: `Collection ${i}`, createdAt: Date.now(), updatedAt: Date.now() },
        });
      }

      const result = await storage.batch(operations);
      expect(result.success).toBe(true);

      const collections = await storage.getAllCollections();
      expect(collections).toHaveLength(100);
    });

    it('should handle partial success in batch', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Existing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const operations: BatchOperation[] = [
        { type: 'createCollection', id: 'col-2', data: { id: 'col-2', name: 'New', createdAt: Date.now(), updatedAt: Date.now() } },
        { type: 'updateCollection', id: 'non-existent-1', data: { name: 'Fail 1' } },
        { type: 'updateCollection', id: 'non-existent-2', data: { name: 'Fail 2' } },
        { type: 'deleteCollection', id: 'non-existent-3' },
      ];

      const result = await storage.batch(operations);
      expect(result.success).toBe(false);
      expect(result.results.filter((r) => r.success)).toHaveLength(1);
      expect(result.results.filter((r) => !r.success)).toHaveLength(3);
    });

    it('should handle batch with unknown operation type', async () => {
      const operations = [{ type: 'unknown' as BatchOperationType, id: 'test' }];
      const result = await storage.batch(operations);
      expect(result.success).toBe(false);
      expect(result.results[0].error).toBe('Unknown operation type');
    });

    it('should handle batch item operations - mock allows creation without collection check', async () => {
      const operations: BatchOperation[] = [
        { type: 'createItem', id: 'item-1', data: { id: 'item-1', collectionId: 'non-existent', type: 'request' as const, name: 'Test', data: {}, createdAt: Date.now(), updatedAt: Date.now() } },
      ];
      const result = await storage.batch(operations);
      expect(result.success).toBe(true);
    });

    it('should handle large mixed batch', async () => {
      await storage.createCollection({ id: 'col-1', name: 'Base', createdAt: Date.now(), updatedAt: Date.now() });

      const operations: BatchOperation[] = [];
      for (let i = 0; i < 50; i++) {
        operations.push({
          type: 'createItem',
          id: `item-${i}`,
          data: { id: `item-${i}`, collectionId: 'col-1', type: 'request' as const, name: `Request ${i}`, data: {}, createdAt: Date.now(), updatedAt: Date.now() },
        });
      }
      operations.push({ type: 'deleteCollection', id: 'non-existent' });
      operations.push({ type: 'updateCollection', id: 'col-1', data: { name: 'Updated' } });

      const result = await storage.batch(operations);
      expect(result.success).toBe(false);
      expect(result.results.filter((r) => r.success)).toHaveLength(51);
    });
  });

  describe('Exception Handling', () => {
    it('should handle invalid data format for collection - stores as-is', async () => {
      const result = await storage.createCollection({} as StorageCollection);
      expect(result).toEqual({});
    });

    it('should handle invalid data format for item - stores as-is', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await storage.createItem({} as StorageItem);
      expect(result).toEqual({});
    });

    it('should handle undefined data in batch operations', async () => {
      const operations: BatchOperation[] = [
        { type: 'createCollection', id: 'col-1', data: undefined },
        { type: 'createItem', id: 'item-1', data: undefined },
      ];
      const result = await storage.batch(operations);
      expect(result.success).toBe(false);
    });

    it('should handle null data in update operations', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const result = await storage.updateCollection('col-1', null as unknown as Partial<StorageCollection>);
      expect(result).not.toBeNull();
    });

    it('should handle malformed collection data in batch', async () => {
      const operations: BatchOperation[] = [
        { type: 'createCollection', id: 'col-1', data: { id: 'col-1' } as StorageCollection },
      ];
      const result = await storage.batch(operations);
      expect(result.success).toBe(false);
    });

    it('should handle concurrent delete operations - both return true', async () => {
      await storage.createCollection({
        id: 'col-1',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const delete1 = storage.deleteCollection('col-1');
      const delete2 = storage.deleteCollection('col-1');

      const [result1, result2] = await Promise.all([delete1, delete2]);
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });
});