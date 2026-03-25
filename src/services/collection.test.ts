import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  createFolder,
  updateFolder,
  deleteFolder,
  createRequest,
  updateRequest,
  deleteRequest,
  getCollectionById,
  getRequestById,
  moveRequest,
  importCollection,
} from './collection';
import type { Collection, Folder, HttpRequest } from '../types';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

// In-memory mock storage
interface MockItem {
  id: string;
  type: 'folder' | 'request';
  name: string;
  collectionId: string;
  parentId: string | null;
  data: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

interface MockCollection {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

let mockCollections: MockCollection[] = [];
let mockItems: MockItem[] = [];

const resetMock = () => {
  mockCollections = [];
  mockItems = [];
};

const mockCollectionService = {
  getAllCollections: vi.fn().mockImplementation(async (): Promise<Collection[]> => {
    const result: Collection[] = [];
    for (const sc of mockCollections) {
      const items = mockItems.filter(i => i.collectionId === sc.id);
      const { folders, requests } = buildTreeStructure(items);
      result.push({
        id: sc.id,
        name: sc.name,
        description: sc.description,
        folders,
        requests,
        createdAt: sc.createdAt,
        updatedAt: sc.updatedAt,
      });
    }
    return result;
  }),
  createCollection: vi.fn().mockImplementation(async (name: string, description?: string): Promise<Collection> => {
    const now = Date.now();
    const id = 'mock-uuid-' + Math.random().toString(36).substr(2, 9);
    const collection: MockCollection = { id, name, description, createdAt: now, updatedAt: now };
    mockCollections.push(collection);
    const rootFolder: Folder = { id: 'root-' + id, name: 'root', folders: [], requests: [], createdAt: now, updatedAt: now };
    return { id: collection.id, name: collection.name, description: collection.description, folders: [rootFolder], requests: [], createdAt: collection.createdAt, updatedAt: collection.updatedAt };
  }),
  updateCollection: vi.fn().mockImplementation(async (id: string, updates: { name?: string; description?: string }): Promise<Collection | null> => {
    const idx = mockCollections.findIndex(c => c.id === id);
    if (idx === -1) return null;
    mockCollections[idx] = { ...mockCollections[idx], ...updates, updatedAt: Date.now() };
    const items = mockItems.filter(i => i.collectionId === id);
    const { folders, requests } = buildTreeStructure(items);
    return { ...mockCollections[idx], folders, requests };
  }),
  deleteCollection: vi.fn().mockImplementation(async (id: string): Promise<boolean> => {
    const len = mockCollections.length;
    mockCollections = mockCollections.filter(c => c.id !== id);
    mockItems = mockItems.filter(i => i.collectionId !== id);
    return mockCollections.length < len;
  }),
  getCollection: vi.fn().mockImplementation(async (id: string): Promise<Collection | null> => {
    const sc = mockCollections.find(c => c.id === id);
    if (!sc) return null;
    const items = mockItems.filter(i => i.collectionId === id);
    // 如果没有 items（只有 root folder），返回直接构造的 collection
    if (items.length === 0) {
      const rootFolder: Folder = { id: 'root-' + sc.id, name: 'root', folders: [], requests: [], createdAt: sc.createdAt, updatedAt: sc.updatedAt };
      return { ...sc, folders: [rootFolder], requests: [] };
    }
    const { folders, requests } = buildTreeStructure(items);
    return { ...sc, folders, requests };
  }),
  createItem: vi.fn().mockImplementation(async (collectionId: string, input: { type: 'folder' | 'request'; name: string; parentId?: string; data?: Record<string, unknown> }): Promise<MockItem> => {
    const now = Date.now();
    const id = 'mock-uuid-' + Math.random().toString(36).substr(2, 9);
    const item: MockItem = { id, type: input.type, name: input.name, collectionId, parentId: input.parentId || null, data: input.data || {}, createdAt: now, updatedAt: now };
    mockItems.push(item);
    return item;
  }),
  updateItem: vi.fn().mockImplementation(async (id: string, input: { name?: string; data?: Record<string, unknown> }): Promise<MockItem | null> => {
    const idx = mockItems.findIndex(i => i.id === id);
    if (idx === -1) return null;
    mockItems[idx] = { ...mockItems[idx], ...input, updatedAt: Date.now() };
    return mockItems[idx];
  }),
  deleteItem: vi.fn().mockImplementation(async (id: string): Promise<boolean> => {
    const len = mockItems.length;
    mockItems = mockItems.filter(i => i.id !== id);
    return mockItems.length < len;
  }),
  moveItem: vi.fn().mockImplementation(async (id: string, newParentId: string | null): Promise<MockItem | null> => {
    const idx = mockItems.findIndex(i => i.id === id);
    if (idx === -1) return null;
    mockItems[idx] = { ...mockItems[idx], parentId: newParentId, updatedAt: Date.now() };
    return mockItems[idx];
  }),
};

function buildTreeStructure(items: MockItem[]): { folders: Folder[]; requests: HttpRequest[] } {
  const folderMap = new Map<string, Folder>();
  const rootFolders: Folder[] = [];
  const rootRequests: HttpRequest[] = [];
  const folderItems = items.filter(i => i.type === 'folder');
  const requestItems = items.filter(i => i.type === 'request');
  for (const item of folderItems) {
    folderMap.set(item.id, { id: item.id, name: item.name, description: (item.data && item.data.description) as string | undefined, folders: [], requests: [], createdAt: item.createdAt, updatedAt: item.updatedAt });
  }
  for (const item of folderItems) {
    const folder = folderMap.get(item.id)!;
    if (item.parentId === null) {
      rootFolders.push(folder);
    } else {
      const parent = folderMap.get(item.parentId);
      if (parent) parent.folders.push(folder);
    }
  }
  for (const item of requestItems) {
    const request: HttpRequest = { 
      id: item.id, 
      name: (item.data && item.data.name as string) || item.name, 
      method: (item.data && item.data.method as HttpRequest['method']) || 'GET', 
      url: (item.data && item.data.url as string) || '', 
      headers: (item.data && item.data.headers as { key: string; value: string; enabled: boolean }[]) || [], 
      params: (item.data && item.data.params as { key: string; value: string; enabled: boolean }[]) || [], 
      body: (item.data && item.data.body) ? { mode: 'json' as const, content: '' } : undefined, 
      description: (item.data && item.data.description) as string | undefined 
    };
    if (item.parentId === null) {
      rootRequests.push(request);
    } else {
      const parent = folderMap.get(item.parentId);
      if (parent) parent.requests.push(request);
    }
  }
  return { folders: rootFolders, requests: rootRequests };
}

vi.mock('./storageBridge', () => ({
  initStorage: vi.fn().mockResolvedValue(undefined),
  getService: vi.fn(() => mockCollectionService),
}));

describe('Collection Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMock();
  });

  describe('getCollections', () => {
    it('should return empty array when no collections exist', async () => {
      const collections = await getCollections();
      expect(collections).toEqual([]);
    });

    it('should return all collections', async () => {
      await createCollection('Collection 1');
      await createCollection('Collection 2');
      const collections = await getCollections();
      expect(collections).toHaveLength(2);
    });
  });

  describe('createCollection', () => {
    it('should create a new collection', async () => {
      const collection = await createCollection('Test Collection', 'Test Description');
      expect(collection).toMatchObject({
        name: 'Test Collection',
        description: 'Test Description',
        folders: expect.any(Array),
        requests: [],
      });
      expect(collection.id).toMatch(/^mock-uuid-/);
      expect(collection.createdAt).toBeDefined();
      expect(collection.updatedAt).toBeDefined();
    });

    it('should save collection to storage', async () => {
      await createCollection('Test Collection');
      const collections = await getCollections();
      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('Test Collection');
    });

    it('should handle collection without description', async () => {
      const collection = await createCollection('Test Collection');
      expect(collection.description).toBeUndefined();
    });
  });

  describe('updateCollection', () => {
    it('should update collection name and description', async () => {
      const collection = await createCollection('Original Name');
      const originalUpdatedAt = collection.updatedAt;
      const start = Date.now();
      // Small delay to ensure timestamp changes
      while (Date.now() - start < 10) { /* busy wait */ }
      const updated = await updateCollection(collection.id, {
        name: 'Updated Name',
        description: 'Updated Description',
      });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.description).toBe('Updated Description');
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });

    it('should return null for non-existent collection', async () => {
      const result = await updateCollection('non-existent-id', { name: 'New Name' });
      expect(result).toBeNull();
    });

    it('should partial update collection', async () => {
      const collection = await createCollection('Name', 'Description');
      const updated = await updateCollection(collection.id, { name: 'New Name' });
      expect(updated!.name).toBe('New Name');
      expect(updated!.description).toBe('Description');
    });
  });

  describe('deleteCollection', () => {
    it('should delete existing collection', async () => {
      const collection = await createCollection('To Delete');
      const result = await deleteCollection(collection.id);
      expect(result).toBe(true);
      const collections = await getCollections();
      expect(collections).toHaveLength(0);
    });

    it('should return false for non-existent collection', async () => {
      const result = await deleteCollection('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('createFolder', () => {
    it('should create folder in collection root', async () => {
      const collection = await createCollection('Test Collection');
      const folder = await createFolder(collection.id, 'Test Folder');
      expect(folder).not.toBeNull();
      expect(folder!.name).toBe('Test Folder');
    });

    it('should create nested folder', async () => {
      const collection = await createCollection('Test Collection');
      const parentFolder = await createFolder(collection.id, 'Parent Folder');
      const childFolder = await createFolder(collection.id, 'Child Folder', parentFolder!.id);
      expect(childFolder).not.toBeNull();
    });

    it('should return null for non-existent collection', async () => {
      const folder = await createFolder('non-existent-id', 'Test Folder');
      expect(folder).toBeNull();
    });

    it('should return null for non-existent parent folder', async () => {
      const collection = await createCollection('Test Collection');
      const folder = await createFolder(collection.id, 'Test Folder', 'non-existent-folder');
      expect(folder).toBeNull();
    });
  });

  describe('updateFolder', () => {
    it('should update folder name', async () => {
      const collection = await createCollection('Test Collection');
      const folder = await createFolder(collection.id, 'Original Name');
      const updated = await updateFolder(collection.id, folder!.id, { name: 'Updated Name' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
    });

    it('should update nested folder', async () => {
      const collection = await createCollection('Test Collection');
      const parentFolder = await createFolder(collection.id, 'Parent');
      const childFolder = await createFolder(collection.id, 'Child', parentFolder!.id);
      const updated = await updateFolder(collection.id, childFolder!.id, { name: 'Updated Child' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Child');
    });

    it('should return null for non-existent collection', async () => {
      const result = await updateFolder('non-existent', 'folder-id', { name: 'New Name' });
      expect(result).toBeNull();
    });

    it('should return null for non-existent folder', async () => {
      const collection = await createCollection('Test Collection');
      const result = await updateFolder(collection.id, 'non-existent', { name: 'New Name' });
      expect(result).toBeNull();
    });
  });

  describe('deleteFolder', () => {
    it('should delete folder from collection', async () => {
      const collection = await createCollection('Test Collection');
      const folder = await createFolder(collection.id, 'To Delete');
      const result = await deleteFolder(collection.id, folder!.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent collection', async () => {
      const result = await deleteFolder('non-existent', 'folder-id');
      expect(result).toBe(false);
    });

    it('should return false for non-existent folder', async () => {
      const collection = await createCollection('Test Collection');
      const result = await deleteFolder(collection.id, 'non-existent');
      expect(result).toBe(false);
    });
  });

  describe('createRequest', () => {
    it('should create request in collection root', async () => {
      const collection = await createCollection('Test Collection');
      const request = await createRequest(collection.id, {
        name: 'Test Request',
        method: 'GET',
        url: 'https://api.example.com',
        headers: [],
        params: [],
      });
      expect(request).not.toBeNull();
      expect(request!.name).toBe('Test Request');
      expect(request!.method).toBe('GET');
    });

    it('should create request in folder', async () => {
      const collection = await createCollection('Test Collection');
      const folder = await createFolder(collection.id, 'Test Folder');
      const request = await createRequest(
        collection.id,
        { name: 'Folder Request', method: 'POST', url: 'https://api.example.com', headers: [], params: [], body: { mode: 'json', content: '{}' } },
        folder!.id
      );
      expect(request).not.toBeNull();
    });

    it('should return null for non-existent collection', async () => {
      const request = await createRequest('non-existent', { name: 'Test', method: 'GET', url: 'https://api.example.com', headers: [], params: [] });
      expect(request).toBeNull();
    });

    it('should return null for non-existent folder', async () => {
      const collection = await createCollection('Test Collection');
      const request = await createRequest(collection.id, { name: 'Test', method: 'GET', url: 'https://api.example.com', headers: [], params: [] }, 'non-existent-folder');
      expect(request).toBeNull();
    });
  });

  describe('updateRequest', () => {
    it('should update request in collection root', async () => {
      const collection = await createCollection('Test Collection');
      const request = await createRequest(collection.id, { name: 'Original Name', method: 'GET', url: 'https://api.example.com', headers: [], params: [] });
      const updated = await updateRequest(collection.id, request!.id, { name: 'Updated Name', method: 'POST' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.method).toBe('POST');
    });

    it('should update request in folder', async () => {
      const collection = await createCollection('Test Collection');
      const folder = await createFolder(collection.id, 'Test Folder');
      const request = await createRequest(collection.id, { name: 'Test', method: 'GET', url: 'https://api.example.com', headers: [], params: [] }, folder!.id);
      const updated = await updateRequest(collection.id, request!.id, { name: 'Updated' }, folder!.id);
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated');
    });

    it('should return null for non-existent request', async () => {
      const collection = await createCollection('Test Collection');
      const result = await updateRequest(collection.id, 'non-existent', { name: 'New Name' });
      expect(result).toBeNull();
    });

    it('should return null when collection does not exist', async () => {
      const result = await updateRequest('non-existent-collection', 'some-request-id', { name: 'New Name' });
      expect(result).toBeNull();
    });
  });

  describe('deleteRequest', () => {
    it('should delete request from collection', async () => {
      const collection = await createCollection('Test Collection');
      const request = await createRequest(collection.id, { name: 'To Delete', method: 'GET', url: 'https://api.example.com', headers: [], params: [] });
      const result = await deleteRequest(collection.id, request!.id);
      expect(result).toBe(true);
    });

    it('should delete request from folder', async () => {
      const collection = await createCollection('Test Collection');
      const folder = await createFolder(collection.id, 'Test Folder');
      const request = await createRequest(collection.id, { name: 'To Delete', method: 'GET', url: 'https://api.example.com', headers: [], params: [] }, folder!.id);
      const result = await deleteRequest(collection.id, request!.id, folder!.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent request', async () => {
      const collection = await createCollection('Test Collection');
      const result = await deleteRequest(collection.id, 'non-existent');
      expect(result).toBe(false);
    });

    it('should return false when folder does not exist', async () => {
      const collection = await createCollection('Test Collection');
      const result = await deleteRequest(collection.id, 'request-id', 'non-existent-folder');
      expect(result).toBe(false);
    });

    it('should return false when collection does not exist', async () => {
      const result = await deleteRequest('non-existent-collection', 'request-id');
      expect(result).toBe(false);
    });
  });

  describe('getCollectionById', () => {
    it('should return null for non-existent id', async () => {
      const result = await getCollectionById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getRequestById', () => {
    it('should return null for non-existent request', async () => {
      const collection = await createCollection('Test Collection');
      const result = await getRequestById(collection.id, 'non-existent');
      expect(result).toBeNull();
    });

    it('should return null when collection does not exist', async () => {
      const result = await getRequestById('non-existent-collection', 'request-id');
      expect(result).toBeNull();
    });

    it('should return null when folder does not exist', async () => {
      const collection = await createCollection('Test Collection');
      const result = await getRequestById(collection.id, 'request-id', 'non-existent-folder');
      expect(result).toBeNull();
    });
  });

  describe('moveRequest', () => {
    it('should move request from root to folder', async () => {
      const collection = await createCollection('Test Collection');
      const folder = await createFolder(collection.id, 'Target Folder');
      const request = await createRequest(collection.id, { name: 'Test', method: 'GET', url: 'https://api.example.com', headers: [], params: [] });
      const result = await moveRequest(collection.id, request!.id, undefined, folder!.id);
      expect(result).toBe(true);
    });

    it('should move request from folder to root', async () => {
      const collection = await createCollection('Test Collection');
      const folder = await createFolder(collection.id, 'Source Folder');
      const request = await createRequest(collection.id, { name: 'Test', method: 'GET', url: 'https://api.example.com', headers: [], params: [] }, folder!.id);
      const result = await moveRequest(collection.id, request!.id, folder!.id, undefined);
      expect(result).toBe(true);
    });

    it('should return false for non-existent collection', async () => {
      const result = await moveRequest('non-existent', 'request-id', undefined, 'folder-id');
      expect(result).toBe(false);
    });

    it('should return false for non-existent source request', async () => {
      const collection = await createCollection('Test Collection');
      const result = await moveRequest(collection.id, 'non-existent', undefined, undefined);
      expect(result).toBe(false);
    });
  });

  describe('importCollection', () => {
    it('should import collection with new id', async () => {
      const collection: Collection = { id: 'original-id', name: 'Imported Collection', folders: [], requests: [], createdAt: 12345, updatedAt: 12345 };
      const imported = await importCollection(collection);
      expect(imported.id).toMatch(/^mock-uuid-/);
      expect(imported.name).toBe('Imported Collection');
      expect(imported.folders).toHaveLength(1); // 新架构会自动创建 root folder
    });

    it('should save imported collection to storage', async () => {
      const collection: Collection = { id: 'original-id', name: 'Imported Collection', folders: [], requests: [], createdAt: 12345, updatedAt: 12345 };
      await importCollection(collection);
      const collections = await getCollections();
      expect(collections).toHaveLength(1);
    });
  });
});