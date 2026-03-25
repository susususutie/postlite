import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollectionService } from './collection';
import { ItemRepository } from '../repositories/item';
import type { StorageStrategy, StorageItem, StorageCollection } from '../../storage/types';

describe('CollectionService', () => {
  let mockStorage: StorageStrategy;
  let itemRepository: ItemRepository;
  let service: CollectionService;

  const createMockStorageCollection = (overrides: Partial<StorageCollection> = {}): StorageCollection => ({
    id: 'collection-id-1',
    name: 'Test Collection',
    description: 'Test description',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  const createMockStorageItem = (overrides: Partial<StorageItem> = {}): StorageItem => ({
    id: 'item-id-1',
    collectionId: 'collection-id-1',
    parentId: null,
    type: 'folder',
    name: 'Test Item',
    data: { description: 'Item description' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    mockStorage = {
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      isOpen: vi.fn().mockReturnValue(true),
      getAllCollections: vi.fn().mockResolvedValue([]),
      getCollection: vi.fn().mockResolvedValue(null),
      createCollection: vi.fn(),
      updateCollection: vi.fn(),
      deleteCollection: vi.fn().mockResolvedValue(true),
      getAllItems: vi.fn().mockResolvedValue([]),
      getItem: vi.fn().mockResolvedValue(null),
      getItemsByCollectionId: vi.fn().mockResolvedValue([]),
      getItemsByParentId: vi.fn().mockResolvedValue([]),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn().mockResolvedValue(true),
      deleteItemsByCollectionId: vi.fn().mockResolvedValue(true),
      transaction: vi.fn().mockResolvedValue({
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
      }),
      batch: vi.fn().mockResolvedValue({ success: true, results: [] }),
    };
    itemRepository = new ItemRepository(mockStorage);
    service = new CollectionService(mockStorage, itemRepository);
  });

  describe('createCollection', () => {
    it('should create collection with default root folder', async () => {
      const storageCollection = createMockStorageCollection({ id: 'new-collection-id', name: 'My Collection', description: 'Description' });
      const rootFolder = createMockStorageItem({ id: 'root-folder-id', type: 'folder', name: 'root' });

      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.createItem = vi.fn().mockResolvedValue(rootFolder);

      const result = await service.createCollection('My Collection', 'Description');

      expect(result.id).toBe('new-collection-id');
      expect(result.name).toBe('My Collection');
      expect(result.description).toBe('Description');
      expect(result.folders).toHaveLength(1);
      expect(result.folders[0].name).toBe('root');
    });

    it('should create collection without description', async () => {
      const storageCollection = createMockStorageCollection({ id: 'new-id', name: 'Simple Collection', description: undefined });
      const rootFolder = createMockStorageItem({ id: 'root-id', type: 'folder', name: 'root' });

      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.createItem = vi.fn().mockResolvedValue(rootFolder);

      const result = await service.createCollection('Simple Collection');

      expect(result.name).toBe('Simple Collection');
      expect(result.description).toBeUndefined();
    });
  });

  describe('getCollection', () => {
    it('should return collection with nested tree structure', async () => {
      const storageCollection = createMockStorageCollection();
      const rootFolder = createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null });
      const childFolder = createMockStorageItem({ id: 'child-folder', type: 'folder', name: 'Child Folder', parentId: 'root' });
      const grandchildFolder = createMockStorageItem({ id: 'grandchild', type: 'folder', name: 'Grandchild', parentId: 'child-folder' });
      const request = createMockStorageItem({
        id: 'request-1',
        type: 'request',
        name: 'GET /users',
        parentId: 'child-folder',
        data: { method: 'GET', url: '/users' },
      });

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([
        rootFolder, childFolder, grandchildFolder, request
      ]);

      const result = await service.getCollection('collection-id-1');

      expect(result).not.toBeNull();
      expect(result!.folders).toHaveLength(1);
      expect(result!.folders[0].name).toBe('root');
      expect(result!.folders[0].folders).toHaveLength(1);
      expect(result!.folders[0].folders[0].name).toBe('Child Folder');
      expect(result!.folders[0].folders[0].folders).toHaveLength(1);
      expect(result!.folders[0].folders[0].folders[0].name).toBe('Grandchild');
    });

    it('should return null for non-existent collection', async () => {
      mockStorage.getCollection = vi.fn().mockResolvedValue(null);

      const result = await service.getCollection('non-existent');

      expect(result).toBeNull();
    });

    it('should include requests in correct folder', async () => {
      const storageCollection = createMockStorageCollection();
      const rootFolder = createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null });
      const request = createMockStorageItem({
        id: 'request-1',
        type: 'request',
        name: 'GET /users',
        parentId: 'root',
        data: { method: 'GET', url: '/users' },
      });

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([rootFolder, request]);

      const result = await service.getCollection('collection-id-1');

      expect(result!.folders[0].requests).toHaveLength(1);
      expect(result!.folders[0].requests[0].name).toBe('GET /users');
    });

    it('should include root-level requests', async () => {
      const storageCollection = createMockStorageCollection();
      const request = createMockStorageItem({
        id: 'request-1',
        type: 'request',
        name: 'Root Request',
        parentId: null,
        data: { method: 'GET', url: '/root' },
      });

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([request]);

      const result = await service.getCollection('collection-id-1');

      expect(result!.requests).toHaveLength(1);
      expect(result!.requests[0].name).toBe('Root Request');
    });
  });

  describe('getAllCollections', () => {
    it('should return all collections with tree structure', async () => {
      const collections = [
        createMockStorageCollection({ id: 'col-1' }),
        createMockStorageCollection({ id: 'col-2' }),
      ];
      const items1 = [createMockStorageItem({ id: 'folder-1', collectionId: 'col-1', parentId: null })];
      const items2 = [createMockStorageItem({ id: 'folder-2', collectionId: 'col-2', parentId: null })];

      mockStorage.getAllCollections = vi.fn().mockResolvedValue(collections);
      mockStorage.getItemsByCollectionId = vi.fn()
        .mockResolvedValueOnce(items1)
        .mockResolvedValueOnce(items2);

      const result = await service.getAllCollections();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('col-1');
      expect(result[1].id).toBe('col-2');
    });

    it('should return empty array when no collections', async () => {
      mockStorage.getAllCollections = vi.fn().mockResolvedValue([]);

      const result = await service.getAllCollections();

      expect(result).toEqual([]);
    });
  });

  describe('updateCollection', () => {
    it('should update collection metadata', async () => {
      const updatedCollection = createMockStorageCollection({
        id: 'col-1',
        name: 'Updated Name',
        description: 'Updated Description',
      });
      const items = [createMockStorageItem({ collectionId: 'col-1' })];

      mockStorage.updateCollection = vi.fn().mockResolvedValue(updatedCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.updateCollection('col-1', {
        name: 'Updated Name',
        description: 'Updated Description',
      });

      expect(result!.name).toBe('Updated Name');
      expect(result!.description).toBe('Updated Description');
    });

    it('should return null for non-existent collection', async () => {
      mockStorage.updateCollection = vi.fn().mockResolvedValue(null);

      const result = await service.updateCollection('non-existent', { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('deleteCollection', () => {
    it('should delete collection and all items', async () => {
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(true);
      mockStorage.deleteItemsByCollectionId = vi.fn().mockResolvedValue(true);

      const result = await service.deleteCollection('col-1');

      expect(result).toBe(true);
      expect(mockStorage.deleteCollection).toHaveBeenCalledWith('col-1');
      expect(mockStorage.deleteItemsByCollectionId).toHaveBeenCalledWith('col-1');
    });

    it('should return false for non-existent collection', async () => {
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(false);

      const result = await service.deleteCollection('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('createItem', () => {
    it('should create folder in collection', async () => {
      const collection = createMockStorageCollection();
      const folder = createMockStorageItem({
        id: 'new-folder',
        type: 'folder',
        name: 'New Folder',
        parentId: null,
      });

      mockStorage.getCollection = vi.fn().mockResolvedValue(collection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);
      mockStorage.createItem = vi.fn().mockResolvedValue(folder);

      const result = await service.createItem('collection-id-1', {
        type: 'folder',
        name: 'New Folder',
      });

      expect(result!.id).toBe('new-folder');
      expect(result!.type).toBe('folder');
    });

    it('should create folder in parent folder', async () => {
      const collection = createMockStorageCollection();
      const parentFolder = createMockStorageItem({
        id: 'parent-folder',
        type: 'folder',
        name: 'Parent',
        parentId: null,
      });
      const newFolder = createMockStorageItem({
        id: 'child-folder',
        type: 'folder',
        name: 'Child Folder',
        parentId: 'parent-folder',
      });

      mockStorage.getCollection = vi.fn().mockResolvedValue(collection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([parentFolder]);
      mockStorage.createItem = vi.fn().mockResolvedValue(newFolder);

      const result = await service.createItem('collection-id-1', {
        type: 'folder',
        name: 'Child Folder',
        parentId: 'parent-folder',
      });

      expect(result!.parentId).toBe('parent-folder');
    });

    it('should create request in collection', async () => {
      const collection = createMockStorageCollection();
      const request = createMockStorageItem({
        id: 'new-request',
        type: 'request',
        name: 'POST /create',
        parentId: null,
        data: { method: 'POST', url: '/create' },
      });

      mockStorage.getCollection = vi.fn().mockResolvedValue(collection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);
      mockStorage.createItem = vi.fn().mockResolvedValue(request);

      const result = await service.createItem('collection-id-1', {
        type: 'request',
        name: 'POST /create',
        data: { method: 'POST', url: '/create' },
      });

      expect(result!.type).toBe('request');
    });

    it('should return null for non-existent collection', async () => {
      mockStorage.getCollection = vi.fn().mockResolvedValue(null);

      const result = await service.createItem('non-existent', {
        type: 'folder',
        name: 'Test',
      });

      expect(result).toBeNull();
    });
  });

  describe('updateItem', () => {
    it('should update item name', async () => {
      const item = createMockStorageItem({
        id: 'item-1',
        name: 'Original Name',
        data: { method: 'GET' },
      });
      const updatedItem = { ...item, name: 'Updated Name' };

      mockStorage.getItem = vi.fn().mockResolvedValue(item);
      mockStorage.updateItem = vi.fn().mockResolvedValue(updatedItem as StorageItem);

      const result = await service.updateItem('item-1', { name: 'Updated Name' });

      expect(result!.name).toBe('Updated Name');
    });

    it('should return null for non-existent item', async () => {
      mockStorage.getItem = vi.fn().mockResolvedValue(null);

      const result = await service.updateItem('non-existent', { name: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('deleteItem', () => {
    it('should delete item', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(true);

      const result = await service.deleteItem('item-1');

      expect(result).toBe(true);
      expect(mockStorage.deleteItem).toHaveBeenCalledWith('item-1');
    });

    it('should return false for non-existent item', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(false);

      const result = await service.deleteItem('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('moveItem', () => {
    it('should move request to different folder', async () => {
      const item = createMockStorageItem({
        id: 'request-1',
        type: 'request',
        name: 'GET /test',
        parentId: 'old-parent',
        collectionId: 'col-1',
      });
      const targetFolder = createMockStorageItem({
        id: 'new-parent',
        type: 'folder',
        name: 'New Parent',
        parentId: null,
        collectionId: 'col-1',
      });
      const updatedItem = { ...item, parentId: 'new-parent' };

      mockStorage.getItem = vi.fn().mockResolvedValue(item);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([targetFolder]);
      mockStorage.updateItem = vi.fn().mockResolvedValue(updatedItem as StorageItem);

      const result = await service.moveItem('request-1', 'new-parent');

      expect(result!.parentId).toBe('new-parent');
    });

    it('should move item to root level', async () => {
      const item = createMockStorageItem({
        id: 'folder-1',
        type: 'folder',
        name: 'Folder',
        parentId: 'old-parent',
        collectionId: 'col-1',
      });
      const updatedItem = { ...item, parentId: null };

      mockStorage.getItem = vi.fn().mockResolvedValue(item);
      mockStorage.updateItem = vi.fn().mockResolvedValue(updatedItem as StorageItem);

      const result = await service.moveItem('folder-1', null);

      expect(result!.parentId).toBeNull();
    });

    it('should return null when item not found', async () => {
      mockStorage.getItem = vi.fn().mockResolvedValue(null);

      const result = await service.moveItem('non-existent', 'new-parent');

      expect(result).toBeNull();
    });
  });

  describe('tree structure', () => {
    it('should build correct tree from flat items', async () => {
      const storageCollection = createMockStorageCollection();
      const items: StorageItem[] = [
        { id: '1', collectionId: 'c1', parentId: null, type: 'folder', name: 'Root1', data: {}, createdAt: 1, updatedAt: 1 },
        { id: '2', collectionId: 'c1', parentId: '1', type: 'folder', name: 'Child1', data: {}, createdAt: 1, updatedAt: 1 },
        { id: '3', collectionId: 'c1', parentId: '2', type: 'folder', name: 'Grandchild', data: {}, createdAt: 1, updatedAt: 1 },
        { id: '4', collectionId: 'c1', parentId: '1', type: 'request', name: 'Req1', data: { method: 'GET' }, createdAt: 1, updatedAt: 1 },
        { id: '5', collectionId: 'c1', parentId: '3', type: 'request', name: 'Req2', data: { method: 'POST' }, createdAt: 1, updatedAt: 1 },
        { id: '6', collectionId: 'c1', parentId: null, type: 'request', name: 'RootReq', data: { method: 'PUT' }, createdAt: 1, updatedAt: 1 },
        { id: '7', collectionId: 'c1', parentId: null, type: 'folder', name: 'Root2', data: {}, createdAt: 1, updatedAt: 1 },
      ];

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.getCollection('c1');

      expect(result!.folders).toHaveLength(2);
      expect(result!.folders[0].name).toBe('Root1');
      expect(result!.folders[0].folders).toHaveLength(1);
      expect(result!.folders[0].folders[0].name).toBe('Child1');
      expect(result!.folders[0].folders[0].folders).toHaveLength(1);
      expect(result!.folders[0].folders[0].folders[0].name).toBe('Grandchild');
      expect(result!.folders[0].folders[0].folders[0].requests).toHaveLength(1);
      expect(result!.folders[0].folders[0].folders[0].requests[0].name).toBe('Req2');
      expect(result!.folders[0].requests).toHaveLength(1);
      expect(result!.folders[0].requests[0].name).toBe('Req1');
      expect(result!.requests).toHaveLength(1);
      expect(result!.requests[0].name).toBe('RootReq');
      expect(result!.folders[1].name).toBe('Root2');
    });
  });

  describe('createCollection - boundary tests', () => {
    it('should create collection with empty name', async () => {
      const storageCollection = createMockStorageCollection({ id: 'new-id', name: '', description: 'desc' });
      const rootFolder = createMockStorageItem({ id: 'root-id', type: 'folder', name: 'root' });

      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.createItem = vi.fn().mockResolvedValue(rootFolder);

      const result = await service.createCollection('', 'desc');

      expect(result.name).toBe('');
      expect(result.description).toBe('desc');
    });

    it('should create collection with whitespace-only name', async () => {
      const storageCollection = createMockStorageCollection({ id: 'new-id', name: '   ', description: '' });
      const rootFolder = createMockStorageItem({ id: 'root-id', type: 'folder', name: 'root' });

      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.createItem = vi.fn().mockResolvedValue(rootFolder);

      const result = await service.createCollection('   ', '');

      expect(result.name).toBe('   ');
    });

    it('should create collection with very long name (1000+ chars)', async () => {
      const longName = 'A'.repeat(1000);
      const storageCollection = createMockStorageCollection({ id: 'new-id', name: longName });
      const rootFolder = createMockStorageItem({ id: 'root-id', type: 'folder', name: 'root' });

      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.createItem = vi.fn().mockResolvedValue(rootFolder);

      const result = await service.createCollection(longName);

      expect(result.name).toHaveLength(1000);
    });

    it('should create collection with special characters in name', async () => {
      const specialName = 'Test <>&"\'Collection/\\:';
      const storageCollection = createMockStorageCollection({ id: 'new-id', name: specialName });
      const rootFolder = createMockStorageItem({ id: 'root-id', type: 'folder', name: 'root' });

      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.createItem = vi.fn().mockResolvedValue(rootFolder);

      const result = await service.createCollection(specialName);

      expect(result.name).toBe(specialName);
    });

    it('should create collection with only description', async () => {
      const storageCollection = createMockStorageCollection({ id: 'new-id', name: 'Collection', description: 'Only description here' });
      const rootFolder = createMockStorageItem({ id: 'root-id', type: 'folder', name: 'root' });

      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.createItem = vi.fn().mockResolvedValue(rootFolder);

      const result = await service.createCollection('Collection', 'Only description here');

      expect(result.name).toBe('Collection');
      expect(result.description).toBe('Only description here');
    });

    it('should create collection with empty name and empty description', async () => {
      const storageCollection = createMockStorageCollection({ id: 'new-id', name: '', description: undefined });
      const rootFolder = createMockStorageItem({ id: 'root-id', type: 'folder', name: 'root' });

      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.createItem = vi.fn().mockResolvedValue(rootFolder);

      const result = await service.createCollection('');

      expect(result.name).toBe('');
      expect(result.description).toBeUndefined();
    });

    it('should verify root folder is automatically created', async () => {
      const storageCollection = createMockStorageCollection({ id: 'new-id', name: 'Test' });
      const rootFolder = createMockStorageItem({ id: 'auto-root-id', type: 'folder', name: 'root', parentId: null });

      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.createItem = vi.fn().mockResolvedValue(rootFolder);

      const result = await service.createCollection('Test');

      expect(mockStorage.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'folder',
          name: 'root',
          parentId: null,
        })
      );
      expect(result.folders).toHaveLength(1);
      expect(result.folders[0].name).toBe('root');
      expect(result.folders[0].id).toBe('auto-root-id');
    });

    it('should create collection with unicode characters in name', async () => {
      const unicodeName = '集合测试 🎉 한국어';
      const storageCollection = createMockStorageCollection({ id: 'new-id', name: unicodeName });
      const rootFolder = createMockStorageItem({ id: 'root-id', type: 'folder', name: 'root' });

      mockStorage.createCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.createItem = vi.fn().mockResolvedValue(rootFolder);

      const result = await service.createCollection(unicodeName);

      expect(result.name).toBe(unicodeName);
    });
  });

  describe('getCollection - boundary tests', () => {
    it('should return null for non-existent collection id', async () => {
      mockStorage.getCollection = vi.fn().mockResolvedValue(null);

      const result = await service.getCollection('non-existent-id-12345');

      expect(result).toBeNull();
    });

    it('should return collection with empty folders and requests when no items', async () => {
      const storageCollection = createMockStorageCollection({ id: 'empty-col', name: 'Empty Collection' });

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);

      const result = await service.getCollection('empty-col');

      expect(result).not.toBeNull();
      expect(result!.folders).toHaveLength(0);
      expect(result!.requests).toHaveLength(0);
    });

    it('should handle collection with multiple folders and requests in complex tree', async () => {
      const storageCollection = createMockStorageCollection({ id: 'complex-col' });
      const rootFolder = createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null });
      const folder1 = createMockStorageItem({ id: 'f1', type: 'folder', name: 'Folder 1', parentId: 'root' });
      const folder2 = createMockStorageItem({ id: 'f2', type: 'folder', name: 'Folder 2', parentId: 'root' });
      const request1 = createMockStorageItem({ id: 'r1', type: 'request', name: 'Req 1', parentId: 'root', data: { method: 'GET', url: '/1' } });
      const request2 = createMockStorageItem({ id: 'r2', type: 'request', name: 'Req 2', parentId: 'f1', data: { method: 'POST', url: '/2' } });
      const request3 = createMockStorageItem({ id: 'r3', type: 'request', name: 'Req 3', parentId: 'f2', data: { method: 'PUT', url: '/3' } });

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([rootFolder, folder1, folder2, request1, request2, request3]);

      const result = await service.getCollection('complex-col');

      expect(result!.folders).toHaveLength(1);
      expect(result!.folders[0].folders).toHaveLength(2);
      expect(result!.folders[0].requests).toHaveLength(1);
      expect(result!.folders[0].folders[0].requests).toHaveLength(1);
      expect(result!.folders[0].folders[1].requests).toHaveLength(1);
    });

    it('should handle deep nested folders (3+ levels)', async () => {
      const storageCollection = createMockStorageCollection({ id: 'deep-col' });
      const items: StorageItem[] = [
        createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null }),
        createMockStorageItem({ id: 'l1', type: 'folder', name: 'Level 1', parentId: 'root' }),
        createMockStorageItem({ id: 'l2', type: 'folder', name: 'Level 2', parentId: 'l1' }),
        createMockStorageItem({ id: 'l3', type: 'folder', name: 'Level 3', parentId: 'l2' }),
        createMockStorageItem({ id: 'l4', type: 'folder', name: 'Level 4', parentId: 'l3' }),
      ];

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.getCollection('deep-col');

      expect(result!.folders[0].folders[0].folders[0].folders[0].folders[0].name).toBe('Level 4');
    });

    it('should handle single folder with no requests', async () => {
      const storageCollection = createMockStorageCollection({ id: 'single-folder-col' });
      const items: StorageItem[] = [
        createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null }),
        createMockStorageItem({ id: 'folder-only', type: 'folder', name: 'Empty Folder', parentId: 'root' }),
      ];

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.getCollection('single-folder-col');

      expect(result!.folders[0].folders[0].requests).toHaveLength(0);
    });

    it('should handle single request with no folders', async () => {
      const storageCollection = createMockStorageCollection({ id: 'single-req-col' });
      const request = createMockStorageItem({
        id: 'standalone-req',
        type: 'request',
        name: 'GET /standalone',
        parentId: null,
        data: { method: 'GET', url: '/standalone' },
      });

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([request]);

      const result = await service.getCollection('single-req-col');

      expect(result!.requests).toHaveLength(1);
      expect(result!.folders).toHaveLength(0);
    });

    it('should handle large number of items (50+)', async () => {
      const storageCollection = createMockStorageCollection({ id: 'large-col' });
      const items: StorageItem[] = [
        createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null }),
      ];
      for (let i = 0; i < 50; i++) {
        items.push(createMockStorageItem({
          id: `req-${i}`,
          type: 'request',
          name: `Request ${i}`,
          parentId: 'root',
          data: { method: 'GET', url: `/req-${i}` },
        }));
      }

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.getCollection('large-col');

      expect(result!.folders[0].requests).toHaveLength(50);
    });

    it('should handle orphan items with non-existent parent', async () => {
      const storageCollection = createMockStorageCollection({ id: 'orphan-col' });
      const orphanFolder = createMockStorageItem({ id: 'orphan', type: 'folder', name: 'Orphan', parentId: 'non-existent-parent' });
      const orphanRequest = createMockStorageItem({ id: 'orphan-req', type: 'request', name: 'Orphan Request', parentId: 'another-nonexistent', data: { method: 'GET' } });

      mockStorage.getCollection = vi.fn().mockResolvedValue(storageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([orphanFolder, orphanRequest]);

      const result = await service.getCollection('orphan-col');

      expect(result!.folders).toHaveLength(0);
      expect(result!.requests).toHaveLength(0);
    });
  });

  describe('getAllCollections - boundary tests', () => {
    it('should return empty array when database is empty', async () => {
      mockStorage.getAllCollections = vi.fn().mockResolvedValue([]);

      const result = await service.getAllCollections();

      expect(result).toEqual([]);
    });

    it('should handle 100+ collections', async () => {
      const collections: StorageCollection[] = [];
      for (let i = 0; i < 100; i++) {
        collections.push(createMockStorageCollection({ id: `col-${i}`, name: `Collection ${i}` }));
      }

      mockStorage.getAllCollections = vi.fn().mockResolvedValue(collections);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);

      const result = await service.getAllCollections();

      expect(result).toHaveLength(100);
    });

    it('should return all collections with items', async () => {
      const collections: StorageCollection[] = [
        createMockStorageCollection({ id: 'col-1', name: 'Col 1' }),
        createMockStorageCollection({ id: 'col-2', name: 'Col 2' }),
        createMockStorageCollection({ id: 'col-3', name: 'Col 3' }),
      ];
      const items1 = [createMockStorageItem({ id: 'f1', type: 'folder', name: 'folder', collectionId: 'col-1', parentId: null })];
      const items2 = [createMockStorageItem({ id: 'r1', type: 'request', name: 'req', collectionId: 'col-2', parentId: null, data: { method: 'GET' } })];
      const items3: StorageItem[] = [
        createMockStorageItem({ id: 'f2', type: 'folder', name: 'folder', collectionId: 'col-3', parentId: null }),
        createMockStorageItem({ id: 'r2', type: 'request', name: 'req', collectionId: 'col-3', parentId: null, data: { method: 'POST' } }),
      ];

      mockStorage.getAllCollections = vi.fn().mockResolvedValue(collections);
      mockStorage.getItemsByCollectionId = vi.fn()
        .mockResolvedValueOnce(items1)
        .mockResolvedValueOnce(items2)
        .mockResolvedValueOnce(items3);

      const result = await service.getAllCollections();

      expect(result).toHaveLength(3);
      expect(result[0].folders).toHaveLength(1);
      expect(result[1].requests).toHaveLength(1);
      expect(result[2].folders).toHaveLength(1);
      expect(result[2].requests).toHaveLength(1);
    });

    it('should handle collection with undefined description', async () => {
      const collections: StorageCollection[] = [
        { id: 'col-1', name: 'Test', description: undefined, createdAt: Date.now(), updatedAt: Date.now() },
      ];

      mockStorage.getAllCollections = vi.fn().mockResolvedValue(collections);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);

      const result = await service.getAllCollections();

      expect(result[0].description).toBeUndefined();
    });

    it('should handle mixed collections with and without items', async () => {
      const collections: StorageCollection[] = [
        createMockStorageCollection({ id: 'col-1', name: 'With Items' }),
        createMockStorageCollection({ id: 'col-2', name: 'Empty' }),
        createMockStorageCollection({ id: 'col-3', name: 'With More Items' }),
      ];
      const items1 = [createMockStorageItem({ id: 'f1', type: 'folder', name: 'f', collectionId: 'col-1', parentId: null })];
      const items3 = [
        createMockStorageItem({ id: 'f2', type: 'folder', name: 'f', collectionId: 'col-3', parentId: null }),
        createMockStorageItem({ id: 'r1', type: 'request', name: 'r', collectionId: 'col-3', parentId: null, data: { method: 'GET' } }),
      ];

      mockStorage.getAllCollections = vi.fn().mockResolvedValue(collections);
      mockStorage.getItemsByCollectionId = vi.fn()
        .mockResolvedValueOnce(items1)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(items3);

      const result = await service.getAllCollections();

      expect(result[0].folders).toHaveLength(1);
      expect(result[1].folders).toHaveLength(0);
      expect(result[2].folders).toHaveLength(1);
      expect(result[2].requests).toHaveLength(1);
    });
  });

  describe('updateCollection - boundary tests', () => {
    it('should return null for non-existent collection id', async () => {
      mockStorage.updateCollection = vi.fn().mockResolvedValue(null);

      const result = await service.updateCollection('non-existent', { name: 'New Name' });

      expect(result).toBeNull();
    });

    it('should clear name when empty string provided', async () => {
      const updatedCollection = createMockStorageCollection({ id: 'col-1', name: '', description: 'desc' });
      const items = [createMockStorageItem({ collectionId: 'col-1' })];

      mockStorage.updateCollection = vi.fn().mockResolvedValue(updatedCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.updateCollection('col-1', { name: '' });

      expect(result!.name).toBe('');
    });

    it('should clear description when empty string provided', async () => {
      const updatedCollection = createMockStorageCollection({ id: 'col-1', name: 'Name', description: '' });
      const items = [createMockStorageItem({ collectionId: 'col-1' })];

      mockStorage.updateCollection = vi.fn().mockResolvedValue(updatedCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.updateCollection('col-1', { description: '' });

      expect(result!.description).toBe('');
    });

    it('should update both name and description simultaneously', async () => {
      const updatedCollection = createMockStorageCollection({ id: 'col-1', name: 'New Name', description: 'New Desc' });
      const items = [createMockStorageItem({ collectionId: 'col-1' })];

      mockStorage.updateCollection = vi.fn().mockResolvedValue(updatedCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.updateCollection('col-1', { name: 'New Name', description: 'New Desc' });

      expect(result!.name).toBe('New Name');
      expect(result!.description).toBe('New Desc');
    });

    it('should update collection with undefined description to remove it', async () => {
      const updatedCollection = createMockStorageCollection({ id: 'col-1', name: 'Name', description: undefined });
      const items = [createMockStorageItem({ collectionId: 'col-1' })];

      mockStorage.updateCollection = vi.fn().mockResolvedValue(updatedCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.updateCollection('col-1', { description: undefined });

      expect(result!.description).toBeUndefined();
    });

    it('should preserve existing values when only partial update', async () => {
      const existingCollection = createMockStorageCollection({ id: 'col-1', name: 'Existing Name', description: 'Existing Desc' });
      const updatedCollection = { ...existingCollection, name: 'New Name' };
      const items = [createMockStorageItem({ collectionId: 'col-1' })];

      mockStorage.getCollection = vi.fn().mockResolvedValue(existingCollection);
      mockStorage.updateCollection = vi.fn().mockResolvedValue(updatedCollection as StorageCollection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.updateCollection('col-1', { name: 'New Name' });

      expect(result!.name).toBe('New Name');
      expect(result!.description).toBe('Existing Desc');
    });
  });

  describe('deleteCollection - boundary tests', () => {
    it('should return false for non-existent collection id', async () => {
      mockStorage.deleteItemsByCollectionId = vi.fn().mockResolvedValue(true);
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(false);

      const result = await service.deleteCollection('non-existent');

      expect(result).toBe(false);
    });

    it('should delete collection with many items', async () => {
      const items: StorageItem[] = [];
      for (let i = 0; i < 100; i++) {
        items.push(createMockStorageItem({ id: `item-${i}`, collectionId: 'col-1' }));
      }

      mockStorage.deleteItemsByCollectionId = vi.fn().mockResolvedValue(true);
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(true);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.deleteCollection('col-1');

      expect(result).toBe(true);
      expect(mockStorage.deleteItemsByCollectionId).toHaveBeenCalledWith('col-1');
      expect(mockStorage.deleteCollection).toHaveBeenCalledWith('col-1');
    });

    it('should return result from deleteCollection regardless of deleteItems result', async () => {
      mockStorage.deleteItemsByCollectionId = vi.fn().mockResolvedValue(false);
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(true);

      const result = await service.deleteCollection('col-1');

      expect(result).toBe(true);
    });

    it('should handle multiple delete attempts for same id', async () => {
      mockStorage.deleteItemsByCollectionId = vi.fn().mockResolvedValue(true);
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(true);

      const result1 = await service.deleteCollection('col-1');
      const result2 = await service.deleteCollection('col-1');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should delete nested folder structure', async () => {
      const items: StorageItem[] = [
        createMockStorageItem({ id: 'root', collectionId: 'col-1', parentId: null }),
        createMockStorageItem({ id: 'f1', collectionId: 'col-1', parentId: 'root', type: 'folder' }),
        createMockStorageItem({ id: 'f2', collectionId: 'col-1', parentId: 'f1', type: 'folder' }),
        createMockStorageItem({ id: 'r1', collectionId: 'col-1', parentId: 'f2', type: 'request' }),
      ];

      mockStorage.deleteItemsByCollectionId = vi.fn().mockResolvedValue(true);
      mockStorage.deleteCollection = vi.fn().mockResolvedValue(true);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue(items);

      const result = await service.deleteCollection('col-1');

      expect(result).toBe(true);
      expect(mockStorage.deleteItemsByCollectionId).toHaveBeenCalledWith('col-1');
    });
  });

  describe('createItem - boundary tests', () => {
    it('should create folder in root', async () => {
      const collection = createMockStorageCollection();
      const folder = createMockStorageItem({ id: 'root-folder', type: 'folder', name: 'root', parentId: null });
      const newFolder = createMockStorageItem({ id: 'new-root-folder', type: 'folder', name: 'New Root Folder', parentId: null });

      mockStorage.getCollection = vi.fn().mockResolvedValue(collection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([folder]);
      mockStorage.createItem = vi.fn().mockResolvedValue(newFolder);

      const result = await service.createItem('collection-id-1', { type: 'folder', name: 'New Root Folder', parentId: null });

      expect(result!.name).toBe('New Root Folder');
      expect(result!.parentId).toBeNull();
    });

    it('should create request in root', async () => {
      const collection = createMockStorageCollection();
      const rootFolder = createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null });
      const newRequest = createMockStorageItem({ id: 'new-req', type: 'request', name: 'GET /new', parentId: null, data: { method: 'GET', url: '/new' } });

      mockStorage.getCollection = vi.fn().mockResolvedValue(collection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([rootFolder]);
      mockStorage.createItem = vi.fn().mockResolvedValue(newRequest);

      const result = await service.createItem('collection-id-1', { type: 'request', name: 'GET /new', data: { method: 'GET', url: '/new' } });

      expect(result!.type).toBe('request');
      expect(result!.parentId).toBeNull();
    });

    it('should create nested folder in folder', async () => {
      const collection = createMockStorageCollection();
      const rootFolder = createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null });
      const parentFolder = createMockStorageItem({ id: 'parent', type: 'folder', name: 'Parent Folder', parentId: null });
      const nestedFolder = createMockStorageItem({ id: 'nested', type: 'folder', name: 'Nested Folder', parentId: 'parent' });

      mockStorage.getCollection = vi.fn().mockResolvedValue(collection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([rootFolder, parentFolder]);
      mockStorage.createItem = vi.fn().mockResolvedValue(nestedFolder);

      const result = await service.createItem('collection-id-1', { type: 'folder', name: 'Nested Folder', parentId: 'parent' });

      expect(result!.name).toBe('Nested Folder');
      expect(result!.parentId).toBe('parent');
    });

    it('should create request in folder', async () => {
      const collection = createMockStorageCollection();
      const rootFolder = createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null });
      const folder = createMockStorageItem({ id: 'folder-1', type: 'folder', name: 'Folder 1', parentId: null });
      const request = createMockStorageItem({ id: 'req-in-folder', type: 'request', name: 'POST /in-folder', parentId: 'folder-1', data: { method: 'POST', url: '/in-folder' } });

      mockStorage.getCollection = vi.fn().mockResolvedValue(collection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([rootFolder, folder]);
      mockStorage.createItem = vi.fn().mockResolvedValue(request);

      const result = await service.createItem('collection-id-1', { type: 'request', name: 'POST /in-folder', parentId: 'folder-1', data: { method: 'POST', url: '/in-folder' } });

      expect(result!.parentId).toBe('folder-1');
    });

    it('should return null for non-existent collectionId', async () => {
      mockStorage.getCollection = vi.fn().mockResolvedValue(null);

      const result = await service.createItem('non-existent-col', { type: 'folder', name: 'Test' });

      expect(result).toBeNull();
    });

    it('should create item even for non-existent parentId (service does not validate parentId)', async () => {
      const collection = createMockStorageCollection();
      const newItem = createMockStorageItem({ id: 'new-item', type: 'folder', name: 'Test', parentId: 'non-existent-parent' });

      mockStorage.getCollection = vi.fn().mockResolvedValue(collection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([]);
      mockStorage.createItem = vi.fn().mockResolvedValue(newItem);

      const result = await service.createItem('collection-id-1', { type: 'folder', name: 'Test', parentId: 'non-existent-parent' });

      expect(result).not.toBeNull();
    });

    it('should create item with very long name', async () => {
      const longName = 'B'.repeat(1000);
      const collection = createMockStorageCollection();
      const rootFolder = createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null });
      const newItem = createMockStorageItem({ id: 'long-name-item', type: 'request', name: longName, parentId: null, data: { method: 'GET' } });

      mockStorage.getCollection = vi.fn().mockResolvedValue(collection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([rootFolder]);
      mockStorage.createItem = vi.fn().mockResolvedValue(newItem);

      const result = await service.createItem('collection-id-1', { type: 'request', name: longName, data: { method: 'GET' } });

      expect(result!.name).toHaveLength(1000);
    });

    it('should create item with empty data', async () => {
      const collection = createMockStorageCollection();
      const rootFolder = createMockStorageItem({ id: 'root', type: 'folder', name: 'root', parentId: null });
      const newItem = createMockStorageItem({ id: 'empty-data', type: 'folder', name: 'Empty Data', parentId: null, data: {} });

      mockStorage.getCollection = vi.fn().mockResolvedValue(collection);
      mockStorage.getItemsByCollectionId = vi.fn().mockResolvedValue([rootFolder]);
      mockStorage.createItem = vi.fn().mockResolvedValue(newItem);

      const result = await service.createItem('collection-id-1', { type: 'folder', name: 'Empty Data', data: {} });

      expect(result!.data).toEqual({});
    });
  });

  describe('updateItem - boundary tests', () => {
    it('should return null for non-existent item id', async () => {
      mockStorage.getItem = vi.fn().mockResolvedValue(null);

      const result = await service.updateItem('non-existent', { name: 'New Name' });

      expect(result).toBeNull();
    });

    it('should rename item', async () => {
      const item = createMockStorageItem({ id: 'item-1', name: 'Original Name' });
      const updatedItem = { ...item, name: 'Renamed' };

      mockStorage.getItem = vi.fn().mockResolvedValue(item);
      mockStorage.updateItem = vi.fn().mockResolvedValue(updatedItem as StorageItem);

      const result = await service.updateItem('item-1', { name: 'Renamed' });

      expect(result!.name).toBe('Renamed');
    });

    it('should move item to root level', async () => {
      const item = createMockStorageItem({ id: 'item-1', name: 'Item', parentId: 'old-parent' });
      const updatedItem = { ...item, parentId: null };

      mockStorage.getItem = vi.fn().mockResolvedValue(item);
      mockStorage.updateItem = vi.fn().mockResolvedValue(updatedItem as StorageItem);

      const result = await service.updateItem('item-1', { parentId: null });

      expect(result!.parentId).toBeNull();
    });

    it('should move item to deep folder', async () => {
      const item = createMockStorageItem({ id: 'item-1', name: 'Item', parentId: null });
      const updatedItem = { ...item, parentId: 'deep-folder' };

      mockStorage.getItem = vi.fn().mockResolvedValue(item);
      mockStorage.updateItem = vi.fn().mockResolvedValue(updatedItem as StorageItem);

      const result = await service.updateItem('item-1', { parentId: 'deep-folder' });

      expect(result!.parentId).toBe('deep-folder');
    });

    it('should move item to non-existent parent', async () => {
      const item = createMockStorageItem({ id: 'item-1', name: 'Item', parentId: null });
      const updatedItem = { ...item, parentId: 'non-existent' };

      mockStorage.getItem = vi.fn().mockResolvedValue(item);
      mockStorage.updateItem = vi.fn().mockResolvedValue(updatedItem as StorageItem);

      const result = await service.updateItem('item-1', { parentId: 'non-existent' });

      expect(result!.parentId).toBe('non-existent');
    });

    it('should update item data', async () => {
      const item = createMockStorageItem({ id: 'item-1', name: 'Item', data: { method: 'GET' } });
      const updatedItem = { ...item, data: { method: 'POST', url: '/new' } };

      mockStorage.getItem = vi.fn().mockResolvedValue(item);
      mockStorage.updateItem = vi.fn().mockResolvedValue(updatedItem as StorageItem);

      const result = await service.updateItem('item-1', { data: { method: 'POST', url: '/new' } });

      expect(result!.data).toEqual({ method: 'POST', url: '/new' });
    });
  });

  describe('deleteItem - boundary tests', () => {
    it('should return false for non-existent item', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(false);

      const result = await service.deleteItem('non-existent');

      expect(result).toBe(false);
    });

    it('should delete folder with child items', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(true);

      const result = await service.deleteItem('folder-with-children');

      expect(result).toBe(true);
      expect(mockStorage.deleteItem).toHaveBeenCalledWith('folder-with-children');
    });

    it('should delete request in root', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(true);

      const result = await service.deleteItem('root-request');

      expect(result).toBe(true);
    });

    it('should handle delete failure', async () => {
      mockStorage.deleteItem = vi.fn().mockResolvedValue(false);

      const result = await service.deleteItem('item-1');

      expect(result).toBe(false);
    });
  });
});
