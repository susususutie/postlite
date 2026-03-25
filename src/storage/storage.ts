import type { StorageStrategy, StorageOptions, StorageStrategyType } from './types';
import { IndexedDBStorage } from './strategies/indexeddb';

export * from './types';

export function createStorageStrategy(type: StorageStrategyType = 'indexeddb', options?: StorageOptions): StorageStrategy {
  switch (type) {
    case 'indexeddb':
      return new IndexedDBStorage(options);
    case 'memory':
      throw new Error('Memory storage not implemented yet');
    case 'remote':
      throw new Error('Remote storage not implemented yet');
    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}

export function createDefaultStorage(): StorageStrategy {
  return createStorageStrategy('indexeddb', { dbName: 'postlite_db', version: 1 });
}