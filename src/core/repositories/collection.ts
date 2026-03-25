import { v4 as uuidv4 } from 'uuid';
import type { StorageStrategy, StorageCollection, StorageItem } from '../../storage/types';
import type { Collection, HttpRequest, Folder, RequestBody } from '../../types';

interface CreateCollectionInput {
  name: string;
  description?: string;
}

interface UpdateCollectionInput {
  name?: string;
  description?: string;
}

export class CollectionRepository {
  private storage: StorageStrategy;
  
  constructor(storage: StorageStrategy) {
    this.storage = storage;
  }

  async create(input: CreateCollectionInput): Promise<Collection> {
    const now = Date.now();
    const storageCollection: StorageCollection = {
      id: uuidv4(),
      name: input.name,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.storage.createCollection(storageCollection);

    return this.toDomainModel(created, [], []);
  }

  async findById(id: string): Promise<Collection | null> {
    const storageCollection = await this.storage.getCollection(id);
    if (!storageCollection) {
      return null;
    }

    const items = await this.storage.getItemsByCollectionId(id);
    const folders = this.extractFolders(items);
    const requests = this.extractRequests(items);

    return this.toDomainModel(storageCollection, folders, requests);
  }

  async findAll(): Promise<Collection[]> {
    const storageCollections = await this.storage.getAllCollections();
    const result: Collection[] = [];

    for (const storageCollection of storageCollections) {
      const items = await this.storage.getItemsByCollectionId(storageCollection.id);
      const folders = this.extractFolders(items);
      const requests = this.extractRequests(items);
      result.push(this.toDomainModel(storageCollection, folders, requests));
    }

    return result;
  }

  async update(id: string, input: UpdateCollectionInput): Promise<Collection | null> {
    const updated = await this.storage.updateCollection(id, input);
    if (!updated) {
      return null;
    }

    const items = await this.storage.getItemsByCollectionId(id);
    const folders = this.extractFolders(items);
    const requests = this.extractRequests(items);

    return this.toDomainModel(updated, folders, requests);
  }

  async delete(id: string): Promise<boolean> {
    return this.storage.deleteCollection(id);
  }

  async createMany(inputs: CreateCollectionInput[]): Promise<Collection[]> {
    const results: Collection[] = [];
    for (const input of inputs) {
      const collection = await this.create(input);
      results.push(collection);
    }
    return results;
  }

  async updateMany(updates: { id: string; name?: string; description?: string }[]): Promise<(Collection | null)[]> {
    const results: (Collection | null)[] = [];
    for (const update of updates) {
      const collection = await this.update(update.id, update);
      results.push(collection);
    }
    return results;
  }

  async deleteMany(ids: string[]): Promise<boolean[]> {
    const results: boolean[] = [];
    for (const id of ids) {
      const deleted = await this.delete(id);
      results.push(deleted);
    }
    return results;
  }

  async getAllStorageCollections(): Promise<StorageCollection[]> {
    return this.storage.getAllCollections();
  }

  async getStorageCollection(id: string): Promise<StorageCollection | null> {
    return this.storage.getCollection(id);
  }

  async createStorageCollection(data: StorageCollection): Promise<StorageCollection> {
    return this.storage.createCollection(data);
  }

  async updateStorageCollection(id: string, data: Partial<StorageCollection>): Promise<StorageCollection | null> {
    return this.storage.updateCollection(id, data);
  }

  async deleteStorageCollection(id: string): Promise<boolean> {
    return this.storage.deleteCollection(id);
  }

  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    const transaction = await this.storage.transaction();
    try {
      const result = await fn();
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private toDomainModel(
    storage: StorageCollection,
    folders: Folder[],
    requests: HttpRequest[]
  ): Collection {
    return {
      id: storage.id,
      name: storage.name,
      description: storage.description,
      folders,
      requests,
      createdAt: storage.createdAt,
      updatedAt: storage.updatedAt,
    };
  }

  private extractFolders(items: StorageItem[]): Folder[] {
    const folderItems = items.filter((item) => item.type === 'folder');
    return folderItems.map((item) => {
      const data = item.data as { description?: string };
      return {
        id: item.id,
        name: item.name,
        description: data.description,
        folders: [],
        requests: [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
  }

  private extractRequests(items: StorageItem[]): HttpRequest[] {
    const requestItems = items.filter((item) => item.type === 'request');
    return requestItems.map((item) => {
      const data = item.data as {
        method?: string;
        url?: string;
        headers?: { key: string; value: string; enabled: boolean }[];
        params?: { key: string; value: string; enabled: boolean }[];
        body?: { mode: string; content?: string };
        description?: string;
      };
      const bodyContent = data.body;
      return {
        id: item.id,
        name: item.name,
        method: (data.method || 'GET') as HttpRequest['method'],
        url: data.url || '',
        headers: data.headers || [],
        params: data.params || [],
        body: bodyContent
          ? {
              mode: bodyContent.mode as RequestBody['mode'],
              content: bodyContent.content,
            }
          : undefined,
        description: data.description,
      };
    });
  }
}