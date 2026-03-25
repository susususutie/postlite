import { v4 as uuidv4 } from 'uuid';
import type { StorageStrategy, StorageItem } from '../../storage/types';

export interface ItemData {
  method?: string;
  url?: string;
  headers?: { key: string; value: string; enabled: boolean }[];
  params?: { key: string; value: string; enabled: boolean }[];
  body?: { mode: string; content?: string };
  description?: string;
}

interface CreateItemInput {
  type: 'folder' | 'request';
  name: string;
  collectionId: string;
  parentId: string | null;
  data: ItemData;
}

interface UpdateItemInput {
  name?: string;
  parentId?: string | null;
  data?: ItemData;
}

export interface Item {
  id: string;
  type: 'folder' | 'request';
  name: string;
  collectionId: string;
  parentId: string | null;
  data: ItemData;
  createdAt: number;
  updatedAt: number;
}

export class ItemRepository {
  private storage: StorageStrategy;
  
  constructor(storage: StorageStrategy) {
    this.storage = storage;
  }

  async create(input: CreateItemInput): Promise<Item> {
    const now = Date.now();
    const storageItem: StorageItem = {
      id: uuidv4(),
      type: input.type,
      name: input.name,
      collectionId: input.collectionId,
      parentId: input.parentId,
      data: input.data,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.storage.createItem(storageItem);

    return this.toDomainModel(created);
  }

  async findById(id: string): Promise<Item | null> {
    const storageItem = await this.storage.getItem(id);
    if (!storageItem) {
      return null;
    }

    return this.toDomainModel(storageItem);
  }

  async findByCollectionId(collectionId: string): Promise<Item[]> {
    const storageItems = await this.storage.getItemsByCollectionId(collectionId);
    return storageItems.map((item) => this.toDomainModel(item));
  }

  async findByParentId(parentId: string | null): Promise<Item[]> {
    if (parentId === null) {
      const allItems = await this.storage.getAllItems();
      return allItems
        .filter((item) => item.parentId === null || item.parentId === undefined)
        .map((item) => this.toDomainModel(item));
    }
    const storageItems = await this.storage.getItemsByParentId(parentId);
    return storageItems.map((item) => this.toDomainModel(item));
  }

  async update(id: string, input: UpdateItemInput): Promise<Item | null> {
    const updated = await this.storage.updateItem(id, input);
    if (!updated) {
      return null;
    }

    return this.toDomainModel(updated);
  }

  async delete(id: string): Promise<boolean> {
    return this.storage.deleteItem(id);
  }

  async deleteByCollectionId(collectionId: string): Promise<boolean> {
    return this.storage.deleteItemsByCollectionId(collectionId);
  }

  async createMany(inputs: CreateItemInput[]): Promise<Item[]> {
    const results: Item[] = [];
    for (const input of inputs) {
      const item = await this.create(input);
      results.push(item);
    }
    return results;
  }

  async updateMany(updates: { id: string; name?: string; parentId?: string | null; data?: ItemData }[]): Promise<(Item | null)[]> {
    const results: (Item | null)[] = [];
    for (const update of updates) {
      const item = await this.update(update.id, update);
      results.push(item);
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

  private toDomainModel(storage: StorageItem): Item {
    return {
      id: storage.id,
      type: storage.type,
      name: storage.name,
      collectionId: storage.collectionId,
      parentId: storage.parentId ?? null,
      data: storage.data as ItemData,
      createdAt: storage.createdAt,
      updatedAt: storage.updatedAt,
    };
  }
}