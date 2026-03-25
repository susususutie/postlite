import { initializeStorage, getCollectionService } from '../core/initialize';

let isInitialized = false;

export async function initStorage(): Promise<void> {
  if (isInitialized) return;
  await initializeStorage();
  isInitialized = true;
}

export function getService() {
  if (!isInitialized) {
    throw new Error('Storage not initialized. Call initStorage() first.');
  }
  return getCollectionService();
}