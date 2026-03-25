import type { StorageStrategy, StorageCollection, StorageItem, StorageTransaction, StorageOptions, BatchOperation, BatchResult, BatchOperationResult } from '../types';

export class IndexedDBStorage implements StorageStrategy {
  private db: IDBDatabase | null = null;
  private dbName: string;
  private version: number;

  constructor(options: StorageOptions = {}) {
    this.dbName = options.dbName || 'postlite_db';
    this.version = options.version || 1;
  }

  async open(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('collections')) {
          db.createObjectStore('collections', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('by-collection', 'collectionId', { unique: false });
          itemStore.createIndex('by-parent', 'parentId', { unique: false });
        }
      };
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isOpen(): boolean {
    return this.db !== null;
  }

  private getStore(storeName: 'collections' | 'items', mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database is not open');
    }
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  private toPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCollections(): Promise<StorageCollection[]> {
    const store = this.getStore('collections');
    const request = store.getAll();
    return this.toPromise(request) || [];
  }

  async getCollection(id: string): Promise<StorageCollection | null> {
    const store = this.getStore('collections');
    const request = store.get(id);
    const result = await this.toPromise(request);
    return result || null;
  }

  async createCollection(collection: StorageCollection): Promise<StorageCollection> {
    const store = this.getStore('collections', 'readwrite');
    const request = store.add(collection);
    await this.toPromise(request);
    return collection;
  }

  async updateCollection(id: string, data: Partial<StorageCollection>): Promise<StorageCollection | null> {
    const store = this.getStore('collections', 'readwrite');
    const getRequest = store.get(id);
    const existing = await this.toPromise(getRequest);

    if (!existing) return null;

    const updated = { ...existing, ...data, updatedAt: Date.now() };
    const putRequest = store.put(updated);
    await this.toPromise(putRequest);
    return updated;
  }

  async deleteCollection(id: string): Promise<boolean> {
    try {
      const store = this.getStore('collections', 'readwrite');
      const getRequest = store.get(id);
      const existing = await this.toPromise(getRequest);

      if (!existing) return false;

      await this.deleteItemsByCollectionId(id);

      const request = store.delete(id);
      await this.toPromise(request);
      return true;
    } catch {
      return false;
    }
  }

  async getAllItems(): Promise<StorageItem[]> {
    const store = this.getStore('items');
    const request = store.getAll();
    return this.toPromise(request) || [];
  }

  async getItem(id: string): Promise<StorageItem | null> {
    const store = this.getStore('items');
    const request = store.get(id);
    const result = await this.toPromise(request);
    return result || null;
  }

  async getItemsByCollectionId(collectionId: string): Promise<StorageItem[]> {
    const store = this.getStore('items');
    const request = store.getAll();
    const result = await this.toPromise(request);
    return (result || []).filter((item: StorageItem) => item.collectionId === collectionId);
  }

  async getItemsByParentId(parentId: string | null): Promise<StorageItem[]> {
    const store = this.getStore('items');
    const request = store.getAll();
    const result = await this.toPromise(request);
    return (result || []).filter((item: StorageItem) => item.parentId === parentId);
  }

  async createItem(item: StorageItem): Promise<StorageItem> {
    const store = this.getStore('items', 'readwrite');
    const request = store.add(item);
    await this.toPromise(request);
    return item;
  }

  async updateItem(id: string, data: Partial<StorageItem>): Promise<StorageItem | null> {
    const store = this.getStore('items', 'readwrite');
    const getRequest = store.get(id);
    const existing = await this.toPromise(getRequest);

    if (!existing) return null;

    const updated = { ...existing, ...data, updatedAt: Date.now() };
    const putRequest = store.put(updated);
    await this.toPromise(putRequest);
    return updated;
  }

  async deleteItem(id: string): Promise<boolean> {
    const store = this.getStore('items', 'readwrite');
    const request = store.delete(id);
    try {
      await this.toPromise(request);
      return true;
    } catch {
      return false;
    }
  }

  async deleteItemsByCollectionId(collectionId: string): Promise<boolean> {
    const items = await this.getItemsByCollectionId(collectionId);
    const store = this.getStore('items', 'readwrite');

    for (const item of items) {
      const request = store.delete(item.id);
      await this.toPromise(request);
    }

    return true;
  }

  async transaction(): Promise<StorageTransaction> {
    if (!this.db) {
      throw new Error('Database is not open');
    }

    const originalCollections = [...(await this.getAllCollections())];
    const originalItems = [...(await this.getAllItems())];

    let rolledBack = false;

    return {
      commit: async () => {
        // Transaction automatically commits on success
      },
      rollback: async () => {
        if (rolledBack) return;
        rolledBack = true;

        const transaction = this.db!.transaction(['collections', 'items'], 'readwrite');
        const collectionsStore = transaction.objectStore('collections');
        const itemsStore = transaction.objectStore('items');

        await this.toPromise(collectionsStore.clear());
        await this.toPromise(itemsStore.clear());

        for (const collection of originalCollections) {
          await this.toPromise(collectionsStore.add(collection));
        }

        for (const item of originalItems) {
          await this.toPromise(itemsStore.add(item));
        }
      },
    };
  }

  async batch(operations: BatchOperation[]): Promise<BatchResult> {
    const results: BatchOperationResult[] = [];
    let hasFailure = false;

    for (const op of operations) {
      try {
        switch (op.type) {
          case 'createCollection':
            if (op.data && 'name' in op.data) {
              await this.createCollection(op.data as StorageCollection);
              results.push({ success: true, id: op.id });
            } else {
              results.push({ success: false, id: op.id, error: 'Invalid collection data' });
              hasFailure = true;
            }
            break;

          case 'updateCollection':
            if (op.id && op.data) {
              const updated = await this.updateCollection(op.id, op.data as Partial<StorageCollection>);
              results.push({ success: updated !== null, id: op.id, error: updated ? undefined : 'Not found' });
              if (!updated) hasFailure = true;
            } else {
              results.push({ success: false, id: op.id, error: 'Missing id or data' });
              hasFailure = true;
            }
            break;

          case 'deleteCollection':
            if (op.id) {
              const deleted = await this.deleteCollection(op.id);
              results.push({ success: deleted, id: op.id, error: deleted ? undefined : 'Not found' });
              if (!deleted) hasFailure = true;
            } else {
              results.push({ success: false, error: 'Missing id' });
              hasFailure = true;
            }
            break;

          case 'createItem':
            if (op.data && 'collectionId' in op.data) {
              await this.createItem(op.data as StorageItem);
              results.push({ success: true, id: op.id });
            } else {
              results.push({ success: false, id: op.id, error: 'Invalid item data' });
              hasFailure = true;
            }
            break;

          case 'updateItem':
            if (op.id && op.data) {
              const updated = await this.updateItem(op.id, op.data as Partial<StorageItem>);
              results.push({ success: updated !== null, id: op.id, error: updated ? undefined : 'Not found' });
              if (!updated) hasFailure = true;
            } else {
              results.push({ success: false, id: op.id, error: 'Missing id or data' });
              hasFailure = true;
            }
            break;

          case 'deleteItem':
            if (op.id) {
              const deleted = await this.deleteItem(op.id);
              results.push({ success: deleted, id: op.id, error: deleted ? undefined : 'Not found' });
              if (!deleted) hasFailure = true;
            } else {
              results.push({ success: false, error: 'Missing id' });
              hasFailure = true;
            }
            break;

          default:
            results.push({ success: false, error: 'Unknown operation type' });
            hasFailure = true;
        }
      } catch (error) {
        results.push({ success: false, id: op.id, error: error instanceof Error ? error.message : 'Unknown error' });
        hasFailure = true;
      }
    }

    return {
      success: !hasFailure,
      results,
      error: hasFailure ? 'Some operations failed' : undefined,
    };
  }
}