import { IndexedDBStorage } from '../storage/strategies/indexeddb';
import { CollectionRepository } from './repositories/collection';
import { ItemRepository } from './repositories/item';
import { CollectionService } from './services/collection';

let storageInstance: IndexedDBStorage | null = null;
let collectionRepository: CollectionRepository | null = null;
let itemRepository: ItemRepository | null = null;
let collectionService: CollectionService | null = null;

export async function initializeStorage(): Promise<void> {
  if (storageInstance) return;
  
  storageInstance = new IndexedDBStorage();
  await storageInstance.open();
  
  collectionRepository = new CollectionRepository(storageInstance);
  itemRepository = new ItemRepository(storageInstance);
  collectionService = new CollectionService(storageInstance, itemRepository);
}

export function getStorage(): IndexedDBStorage | null {
  return storageInstance;
}

export function getCollectionRepository(): CollectionRepository | null {
  return collectionRepository;
}

export function getCollectionService(): CollectionService | null {
  return collectionService;
}
