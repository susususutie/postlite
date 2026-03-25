// Storage Strategy Types

export interface StorageItem {
  id: string;
  collectionId: string;
  parentId?: string | null;
  type: 'folder' | 'request';
  name: string;
  data: unknown;
  createdAt: number;
  updatedAt: number;
}

export interface StorageCollection {
  id: string;
  name: string;
  description?: string;
  defaultBaseUrl?: string;      // Default baseURL for new requests
  createdAt: number;
  updatedAt: number;
}

export interface StorageTransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface StorageStrategy {
  open(): Promise<void>;
  close(): Promise<void>;
  isOpen(): boolean;

  // Collection CRUD
  getAllCollections(): Promise<StorageCollection[]>;
  getCollection(id: string): Promise<StorageCollection | null>;
  createCollection(collection: StorageCollection): Promise<StorageCollection>;
  updateCollection(id: string, data: Partial<StorageCollection>): Promise<StorageCollection | null>;
  deleteCollection(id: string): Promise<boolean>;

  // Item CRUD
  getAllItems(): Promise<StorageItem[]>;
  getItem(id: string): Promise<StorageItem | null>;
  getItemsByCollectionId(collectionId: string): Promise<StorageItem[]>;
  getItemsByParentId(parentId: string): Promise<StorageItem[]>;
  createItem(item: StorageItem): Promise<StorageItem>;
  updateItem(id: string, data: Partial<StorageItem>): Promise<StorageItem | null>;
  deleteItem(id: string): Promise<boolean>;
  deleteItemsByCollectionId(collectionId: string): Promise<boolean>;

  // Transaction support
  transaction(): Promise<StorageTransaction>;

  // Batch operations
  batch(operations: BatchOperation[]): Promise<BatchResult>;
}

export type BatchOperationType = 'createCollection' | 'updateCollection' | 'deleteCollection' |
                                  'createItem' | 'updateItem' | 'deleteItem';

export interface BatchOperation {
  type: BatchOperationType;
  id?: string;
  data?: StorageCollection | StorageItem | Partial<StorageCollection> | Partial<StorageItem>;
  collectionId?: string;
}

export interface BatchResult {
  success: boolean;
  results: BatchOperationResult[];
  error?: string;
}

export interface BatchOperationResult {
  success: boolean;
  id?: string;
  error?: string;
}

export type StorageStrategyType = 'indexeddb' | 'memory' | 'remote';

export interface StorageOptions {
  dbName?: string;
  version?: number;
}