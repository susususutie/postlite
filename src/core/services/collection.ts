import { v4 as uuidv4 } from 'uuid';
import type { StorageStrategy, StorageCollection } from '../../storage/types';
import type { Collection, HttpRequest, Folder } from '../../types';
import { CollectionRepository } from '../repositories/collection';
import { ItemRepository, type Item, type ItemData } from '../repositories/item';

export interface CreateCollectionInput {
  name: string;
  description?: string;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string;
}

export interface CreateItemInput {
  type: 'folder' | 'request';
  name: string;
  parentId?: string | null;
  data?: ItemData;
}

export interface UpdateItemInput {
  name?: string;
  parentId?: string | null;
  data?: ItemData;
}

export class CollectionService {
  private collectionRepo: CollectionRepository;
  private itemRepo: ItemRepository;

  constructor(
    storage: StorageStrategy,
    itemRepo: ItemRepository
  ) {
    this.collectionRepo = new CollectionRepository(storage);
    this.itemRepo = itemRepo;
  }

  async initAsync(): Promise<void> {
    // Async initialization hook - repositories are already initialized
  }

  async createCollection(name: string, description?: string, defaultBaseUrl?: string): Promise<Collection> {
    const now = Date.now();
    const storageCollection: StorageCollection = {
      id: uuidv4(),
      name,
      description,
      defaultBaseUrl,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.collectionRepo.createStorageCollection(storageCollection);

    const rootFolder = await this.itemRepo.create({
      type: 'folder',
      name: 'root',
      collectionId: created.id,
      parentId: null,
      data: {},
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      defaultBaseUrl: created.defaultBaseUrl,
      folders: [this.toFolder(rootFolder)],
      requests: [],
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async getCollection(id: string): Promise<Collection | null> {
    const storageCollection = await this.collectionRepo.getStorageCollection(id);
    if (!storageCollection) {
      return null;
    }

    const items = await this.itemRepo.findByCollectionId(id);
    const { folders, requests } = this.buildTreeStructure(items);

    return {
      id: storageCollection.id,
      name: storageCollection.name,
      description: storageCollection.description,
      defaultBaseUrl: storageCollection.defaultBaseUrl,
      folders,
      requests,
      createdAt: storageCollection.createdAt,
      updatedAt: storageCollection.updatedAt,
    };
  }

  async getAllCollections(): Promise<Collection[]> {
    const storageCollections = await this.collectionRepo.getAllStorageCollections();
    const result: Collection[] = [];

    for (const storageCollection of storageCollections) {
      const items = await this.itemRepo.findByCollectionId(storageCollection.id);
      const { folders, requests } = this.buildTreeStructure(items);
      result.push({
        id: storageCollection.id,
        name: storageCollection.name,
        description: storageCollection.description,
        defaultBaseUrl: storageCollection.defaultBaseUrl,
        folders,
        requests,
        createdAt: storageCollection.createdAt,
        updatedAt: storageCollection.updatedAt,
      });
    }

    return result;
  }

  async updateCollection(id: string, input: UpdateCollectionInput): Promise<Collection | null> {
    const updated = await this.collectionRepo.updateStorageCollection(id, input);
    if (!updated) {
      return null;
    }

    const items = await this.itemRepo.findByCollectionId(id);
    const { folders, requests } = this.buildTreeStructure(items);

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      defaultBaseUrl: updated.defaultBaseUrl,
      folders,
      requests,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteCollection(id: string): Promise<boolean> {
    await this.itemRepo.deleteByCollectionId(id);
    return this.collectionRepo.deleteStorageCollection(id);
  }

  async createItem(collectionId: string, input: CreateItemInput): Promise<Item | null> {
    const collection = await this.collectionRepo.getStorageCollection(collectionId);
    if (!collection) {
      return null;
    }

    return this.itemRepo.create({
      type: input.type,
      name: input.name,
      collectionId,
      parentId: input.parentId ?? null,
      data: input.data ?? {},
    });
  }

  async updateItem(id: string, input: UpdateItemInput): Promise<Item | null> {
    const item = await this.itemRepo.findById(id);
    if (!item) {
      return null;
    }

    return this.itemRepo.update(id, {
      name: input.name,
      parentId: input.parentId,
      data: input.data,
    });
  }

  async deleteItem(id: string): Promise<boolean> {
    return this.itemRepo.delete(id);
  }

  async moveItem(id: string, newParentId: string | null): Promise<Item | null> {
    const item = await this.itemRepo.findById(id);
    if (!item) {
      return null;
    }

    return this.itemRepo.update(id, { parentId: newParentId });
  }

  private buildTreeStructure(items: Item[]): { folders: Folder[]; requests: HttpRequest[] } {
    const folderMap = new Map<string, Folder>();
    const rootFolders: Folder[] = [];
    const rootRequests: HttpRequest[] = [];

    const folderItems = items.filter((item) => item.type === 'folder');
    const requestItems = items.filter((item) => item.type === 'request');

    for (const item of folderItems) {
      folderMap.set(item.id, this.toFolder(item));
    }

    for (const item of folderItems) {
      const folder = folderMap.get(item.id)!;
      if (item.parentId === null) {
        rootFolders.push(folder);
      } else {
        const parent = folderMap.get(item.parentId);
        if (parent) {
          parent.folders.push(folder);
        }
      }
    }

    for (const item of requestItems) {
      const request = this.toRequest(item);
      if (item.parentId === null) {
        rootRequests.push(request);
      } else {
        const parent = folderMap.get(item.parentId);
        if (parent) {
          parent.requests.push(request);
        }
      }
    }

    return { folders: rootFolders, requests: rootRequests };
  }

  private toFolder(item: Item): Folder {
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
  }

  private toRequest(item: Item): HttpRequest {
    const data = item.data as {
      method?: string;
      url?: string;
      headers?: { key: string; value: string; enabled: boolean }[];
      params?: { key: string; value: string; enabled: boolean }[];
      body?: { mode: string; content?: string };
      description?: string;
    };
    return {
      id: item.id,
      name: item.name,
      method: (data.method || 'GET') as HttpRequest['method'],
      url: data.url || '',
      headers: data.headers || [],
      params: data.params || [],
      body: data.body
        ? {
            mode: data.body.mode as 'none' | 'json' | 'text' | 'formdata' | 'urlencoded',
            content: data.body.content,
          }
        : undefined,
      description: data.description,
    };
  }
}
