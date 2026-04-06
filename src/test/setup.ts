import '@testing-library/jest-dom';
import { vi, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// Ensure jsdom has a body element
beforeAll(() => {
  if (!document.body) {
    document.body = document.createElement('body');
  }
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root: Document | Element | null = null;
  rootMargin: string = '';
  thresholds: readonly number[] = [];
}
global.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

// Mock fetch
global.fetch = vi.fn();

// Mock navigator.serviceWorker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: vi.fn().mockResolvedValue({
      scope: '/',
      active: null,
      installing: null,
      waiting: null,
    }),
    ready: Promise.resolve({
      active: {
        postMessage: vi.fn(),
      },
    }),
    controller: null,
  },
  writable: true,
});

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();


// Mock IndexedDB with proper async handling
const indexedDBStores: Record<string, Record<string, unknown>[]> = {
  collections: [],
  items: [],
};

function createMockIDBRequest<T>(result: T): { onsuccess: (() => void) | null; onerror: ((e: Error) => void) | null; result: T } {
  return {
    onsuccess: null,
    onerror: null,
    result,
  };
}

function createMockIndex(getStore: () => Record<string, unknown>[], indexName: string) {
  return {
    getAll: vi.fn((key?: string | null) => {
      let result = getStore();
      if (key !== undefined) {
        result = result.filter((item) => {
          const itemValue = item[indexName];
          if (key === null) {
            return itemValue === null || itemValue === undefined;
          }
          return itemValue === key;
        });
      }
      const req = createMockIDBRequest(result);
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
  };
}

function createMockIDBObjectStore(storeName: string, indexes: Record<string, string> = {}) {
  const getStore = () => indexedDBStores[storeName] || [];
  const setStore = (data: Record<string, unknown>[]) => { indexedDBStores[storeName] = data; };
  
  const objStore = {
    getAll: vi.fn(() => {
      const req = createMockIDBRequest(getStore());
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
    get: vi.fn((key: string) => {
      const item = getStore().find((i) => (i as { id: string }).id === key);
      const req = createMockIDBRequest(item);
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
    add: vi.fn((data: unknown) => {
      const store = getStore();
      store.push(data as Record<string, unknown>);
      setStore(store);
      const req = createMockIDBRequest((data as { id: string }).id);
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
    put: vi.fn((data: unknown) => {
      const store = getStore();
      const idx = store.findIndex((i) => (i as { id: string }).id === (data as { id: string }).id);
      if (idx >= 0) {
        store[idx] = data as Record<string, unknown>;
      } else {
        store.push(data as Record<string, unknown>);
      }
      setStore(store);
      const req = createMockIDBRequest((data as { id: string }).id);
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
    delete: vi.fn((key: string) => {
      const store = getStore().filter((i) => (i as { id: string }).id !== key);
      setStore(store);
      const req = createMockIDBRequest(undefined);
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
    clear: vi.fn(() => {
      setStore([]);
      const req = createMockIDBRequest(undefined);
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
    createIndex: vi.fn((indexName: string, _keyPath: string) => {
      indexes[indexName] = _keyPath;
      return createMockIndex(getStore, indexName);
    }),
    index: vi.fn((indexName: string) => {
      return createMockIndex(getStore, indexName);
    }),
  };
  return objStore;
}

const mockIndexedDB = {
  open: vi.fn((_dbName: string, _version?: number) => {
    const stores: Record<string, ReturnType<typeof createMockIDBObjectStore>> = {
      collections: createMockIDBObjectStore('collections'),
      items: createMockIDBObjectStore('items'),
    };

    const db = {
      objectStoreNames: { contains: (name: string) => ['collections', 'items'].includes(name) },
      objectStore: vi.fn((name: string) => {
        if (!stores[name]) {
          stores[name] = createMockIDBObjectStore(name);
        }
        return stores[name];
      }),
      transaction: vi.fn((_storeNames: string | string[], _mode?: IDBTransactionMode) => {
        return {
          objectStore: (name: string) => stores[name] || createMockIDBObjectStore(name),
          oncomplete: null,
          onerror: null,
          onabort: null,
          commit: vi.fn(),
        };
      }),
      close: vi.fn(),
      createObjectStore: vi.fn((name: string) => {
        stores[name] = createMockIDBObjectStore(name);
        return stores[name];
      }),
    };

    const req = {
      onsuccess: null as (() => void) | null,
      onerror: null as ((e: Error) => void) | null,
      onupgradeneeded: null as ((e: Event) => void) | null,
      result: db,
    };

    setTimeout(() => {
      if (req.onupgradeneeded) {
        req.onupgradeneeded({ target: req } as unknown as Event);
      }
      if (req.onsuccess) {
        req.onsuccess();
      }
    }, 0);

    return req;
  }),
  deleteDatabase: vi.fn((_dbName: string) => {
    const req = createMockIDBRequest(undefined);
    setTimeout(() => req.onsuccess?.(), 0);
    return req;
  }),
  databases: vi.fn(async () => []),
};

(global as { indexedDB: typeof indexedDB }).indexedDB = mockIndexedDB as unknown as typeof indexedDB;

// Mock storageBridge for all tests
const mockCollections: Map<string, ReturnType<typeof createCollectionWithRoot>> = new Map();
const mockItems: Map<string, unknown> = new Map();

function createCollectionWithRoot(id: string, name: string, description: string = '') {
  const rootFolderId = `folder-root-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    name,
    description,
    folders: [{
      id: rootFolderId,
      name: 'root',
      description: undefined,
      folders: [],
      requests: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }],
    requests: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function findFolderInCollection(collection: ReturnType<typeof createCollectionWithRoot>, folderId: string): { parent: { folders: unknown[] }; folder: unknown } | null {
  function search(folders: unknown[], parent: { folders: unknown[] }): { parent: { folders: unknown[] }; folder: unknown } | null {
    for (const folder of folders as { id: string; folders: unknown[] }[]) {
      if (folder.id === folderId) {
        return { parent, folder };
      }
      const found = search(folder.folders as unknown[], folder);
      if (found) return found;
    }
    return null;
  }
  return search(collection.folders, collection);
}

const mockCollectionServiceMinimal = {
  getAllCollections: vi.fn().mockImplementation(() => {
    const collections = Array.from(mockCollections.values());
    const result: unknown[] = [];
    for (const collection of collections) {
      const items = Array.from(mockItems.values()) as { id: string; type: string; name: string; collectionId: string; parentId: string | null; data: unknown; createdAt: number; updatedAt: number }[];
      const collectionItems = items.filter(item => item.collectionId === collection.id);
      
      type FolderType = { id: string; name: string; description?: string; folders: unknown[]; requests: unknown[]; createdAt: number; updatedAt: number };
      
      function cloneFolder(folder: FolderType): FolderType {
        const cloned: FolderType = { ...folder, folders: [], requests: [] };
        for (const subFolder of folder.folders as FolderType[]) {
          cloned.folders.push(cloneFolder(subFolder));
        }
        return cloned;
      }
      
      const rootFolder = collection.folders.length > 0 ? cloneFolder(collection.folders[0]) : null;
      const folderMap = new Map<string, FolderType>();
      if (rootFolder) {
        folderMap.set(rootFolder.id, rootFolder);
      }
      
      const allRequests: unknown[] = [];
      
      for (const item of collectionItems) {
        if (item.type === 'folder') {
          const folder: FolderType = {
            id: item.id,
            name: item.name,
            description: (item.data as { description?: string })?.description,
            folders: [],
            requests: [],
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          };
          if (item.parentId && folderMap.has(item.parentId)) {
            const parent = folderMap.get(item.parentId)!;
            parent.folders.push(folder);
          } else if (rootFolder) {
            rootFolder.folders.push(folder);
          }
          folderMap.set(item.id, folder);
        }
      }
      
      for (const item of collectionItems) {
        if (item.type === 'request') {
          const request = {
            id: item.id,
            name: item.name,
            ...(item.data as { method: string; url: string; headers: unknown[]; params: unknown[]; body?: unknown; description?: string }),
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          };
          if (item.parentId && folderMap.has(item.parentId)) {
            const parent = folderMap.get(item.parentId)!;
            parent.requests.push(request);
          } else if (rootFolder) {
            rootFolder.requests.push(request);
          }
          allRequests.push(request);
        }
      }
      
      result.push({
        ...collection,
        folders: rootFolder ? [rootFolder] : [],
        requests: allRequests
      });
    }
    return Promise.resolve(result);
  }),
  createCollection: vi.fn().mockImplementation((name, description) => {
    const id = `collection-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const collection = createCollectionWithRoot(id, name, description || '');
    mockCollections.set(id, collection);
    return Promise.resolve(collection);
  }),
  updateCollection: vi.fn().mockImplementation((id, updates) => {
    const existing = mockCollections.get(id);
    if (!existing) {
      return Promise.resolve(null);
    }
    const updated = { ...existing, name: updates.name || existing.name, description: updates.description ?? existing.description, updatedAt: Date.now() };
    mockCollections.set(id, updated);
    return Promise.resolve(updated);
  }),
  deleteCollection: vi.fn().mockImplementation((id) => {
    if (!mockCollections.has(id)) {
      return Promise.resolve(false);
    }
    mockCollections.delete(id);
    return Promise.resolve(true);
  }),
  getCollection: vi.fn().mockImplementation((id) => {
    const collection = mockCollections.get(id);
    if (!collection) {
      return Promise.resolve(null);
    }
    const items = Array.from(mockItems.values()) as { id: string; type: string; name: string; collectionId: string; parentId: string | null; data: unknown; createdAt: number; updatedAt: number }[];
    const collectionItems = items.filter(item => item.collectionId === id);
    const folderMap = new Map<string, { id: string; name: string; description?: string; folders: unknown[]; requests: unknown[]; createdAt: number; updatedAt: number }>();
    
    type FolderType = { id: string; name: string; description?: string; folders: unknown[]; requests: unknown[]; createdAt: number; updatedAt: number };
    
    function cloneFolder(folder: FolderType): FolderType {
      const cloned: FolderType = { ...folder, folders: [], requests: [] };
      folderMap.set(cloned.id, cloned);
      for (const subFolder of folder.folders as FolderType[]) {
        const clonedSub = cloneFolder(subFolder);
        cloned.folders.push(clonedSub);
      }
      return cloned;
    }
    
    const rootFolder = collection.folders.length > 0 ? cloneFolder(collection.folders[0]) : null;
    const allFolders: FolderType[] = rootFolder ? [rootFolder] : [];
    const allRequests: unknown[] = [];
    
    for (const item of collectionItems) {
      if (item.type === 'folder') {
        const folder = {
          id: item.id,
          name: item.name,
          description: (item.data as { description?: string })?.description,
          folders: [],
          requests: [],
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        };
        if (item.parentId && folderMap.has(item.parentId)) {
          const parent = folderMap.get(item.parentId)!;
          (parent.folders as unknown[]).push(folder);
        } else {
          allFolders.push(folder);
        }
        folderMap.set(item.id, folder);
      }
    }
    for (const item of collectionItems) {
      if (item.type === 'request') {
        const request = {
          id: item.id,
          name: item.name,
          ...(item.data as { method: string; url: string; headers: unknown[]; params: unknown[]; body?: unknown; description?: string }),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        };
        if (item.parentId && folderMap.has(item.parentId)) {
          const parent = folderMap.get(item.parentId)!;
          (parent.requests as unknown[]).push(request);
        } else if (rootFolder) {
          rootFolder.requests.push(request);
        }
        allRequests.push(request);
      }
    }
    const result: Record<string, unknown> = { 
      ...collection, 
      folders: allFolders, 
      requests: allRequests 
    };
    return Promise.resolve(result as { id: string; name: string; description?: string; folders: unknown[]; requests: unknown[]; createdAt: number; updatedAt: number });
  }),
  createItem: vi.fn().mockImplementation((collectionId, input) => {
    const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item = {
      id,
      type: input.type,
      name: input.name,
      collectionId,
      parentId: input.parentId || null,
      data: input.data || {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    mockItems.set(id, item);
    return Promise.resolve(item);
  }),
  updateItem: vi.fn().mockImplementation((id, input) => {
    const existing = mockItems.get(id);
    if (!existing) {
      return Promise.resolve({ id, type: 'folder' as const, name: input.name || 'Test', collectionId: 'test', parentId: null, data: input.data || {}, createdAt: Date.now(), updatedAt: Date.now() });
    }
    const updated = { ...existing as Record<string, unknown>, ...input, id, updatedAt: Date.now() };
    mockItems.set(id, updated);
    return Promise.resolve(updated);
  }),
  deleteItem: vi.fn().mockImplementation((id) => {
    mockItems.delete(id);
    return Promise.resolve(true);
  }),
  moveItem: vi.fn().mockImplementation((id, parentId) => {
    const existing = mockItems.get(id);
    if (!existing) {
      return Promise.resolve(null);
    }
    const updated = { ...existing as Record<string, unknown>, parentId, updatedAt: Date.now() };
    mockItems.set(id, updated);
    return Promise.resolve(updated);
  }),
};

vi.mock('../services/storageBridge', () => ({
  initStorage: vi.fn().mockResolvedValue(undefined),
  getService: vi.fn(() => mockCollectionServiceMinimal),
}));

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorageMock.clear();
  // Reset IndexedDB stores
  indexedDBStores.collections = [];
  indexedDBStores.items = [];
  // Reset mock collections and items
  mockCollections.clear();
  mockItems.clear();
  
  // Reset mock to clear any stored state
  if ((mockIndexedDB.open as ReturnType<typeof vi.fn>).mock) {
    (mockIndexedDB.open as ReturnType<typeof vi.fn>).mock.results.length = 0;
  }
});
