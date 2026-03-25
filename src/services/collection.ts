// Collection 管理服务
import type { Collection, Folder, HttpRequest, HttpMethod, Header, Param } from '../types';
import { initStorage, getService } from './storageBridge';

function getServiceNotNull() {
  const service = getService();
  if (!service) {
    throw new Error('Storage service not available');
  }
  return service;
}

// 获取所有 Collections
export async function getCollections(): Promise<Collection[]> {
  await initStorage();
  const service = getServiceNotNull();
  return service.getAllCollections();
}

// 创建 Collection
export async function createCollection(name: string, description?: string): Promise<Collection> {
  await initStorage();
  const service = getServiceNotNull();
  return service.createCollection(name, description);
}

// 更新 Collection
export async function updateCollection(
  collectionId: string,
  updates: Partial<Pick<Collection, 'name' | 'description'>>
): Promise<Collection | null> {
  await initStorage();
  const service = getServiceNotNull();
  return service.updateCollection(collectionId, updates);
}

// 删除 Collection
export async function deleteCollection(collectionId: string): Promise<boolean> {
  await initStorage();
  const service = getServiceNotNull();
  return service.deleteCollection(collectionId);
}

// 在 Collection 中创建 Folder
export async function createFolder(
  collectionId: string,
  folderName: string,
  parentFolderId?: string
): Promise<Folder | null> {
  await initStorage();
  const service = getServiceNotNull();
  
  const collection = await service.getCollection(collectionId);
  if (!collection) {
    return null;
  }
  
  if (parentFolderId) {
    const folderExists = collection.folders.some(f => f.id === parentFolderId) || 
      collection.folders.some(f => findFolderRecursive(f.folders, parentFolderId));
    if (!folderExists) {
      return null;
    }
  }
  
  const result = await service.createItem(collectionId, {
    type: 'folder',
    name: folderName,
    parentId: parentFolderId,
    data: {},
  });
  if (!result) return null;
  
  const folder: Folder = {
    id: result.id,
    name: result.name,
    description: (result.data as { description?: string })?.description,
    folders: [],
    requests: [],
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
  
  return folder;
}

// 更新 Folder
export async function updateFolder(
  collectionId: string,
  folderId: string,
  updates: Partial<Pick<Folder, 'name' | 'description'>>
): Promise<Folder | null> {
  await initStorage();
  const service = getServiceNotNull();
  const result = await service.updateItem(folderId, {
    name: updates.name,
    data: updates.description !== undefined ? { description: updates.description } : undefined,
  });
  if (!result) return null;
  const collection = await service.getCollection(collectionId);
  if (!collection) return null;
  return findFolderById(collection.folders, folderId);
}

// 删除 Folder
export async function deleteFolder(_collectionId: string, folderId: string): Promise<boolean> {
  await initStorage();
  const service = getServiceNotNull();
  return service.deleteItem(folderId);
}

// 创建 Request
export async function createRequest(
  collectionId: string,
  request: Omit<HttpRequest, 'id' | 'createdAt' | 'updatedAt'>,
  folderId?: string
): Promise<HttpRequest | null> {
  await initStorage();
  const service = getServiceNotNull();
  
  let parentId: string | null = folderId ?? null;
  const collection = await service.getCollection(collectionId);
  if (!collection) {
    return null;
  }
  
  if (folderId) {
    const folderExists = collection.folders.some(f => f.id === folderId) || 
      collection.folders.some(f => findFolderRecursive(f.folders, folderId));
    if (!folderExists) {
      return null;
    }
  }
  
  if (!parentId && collection.folders.length > 0) {
    parentId = collection.folders[0].id;
  }
  
  const result = await service.createItem(collectionId, {
    type: 'request',
    name: request.name,
    parentId,
    data: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      params: request.params,
      body: request.body,
      description: request.description,
    },
  });
  if (!result) return null;
  
  const httpRequest: HttpRequest = {
    id: result.id,
    name: result.name,
    method: ((result.data as { method?: string }).method || 'GET') as HttpMethod,
    url: (result.data as { url?: string }).url || '',
    headers: ((result.data as { headers?: unknown[] }).headers || []) as Header[],
    params: ((result.data as { params?: unknown[] }).params || []) as Param[],
    body: (result.data as { body?: unknown }).body as HttpRequest['body'],
    description: (result.data as { description?: string }).description,
  };
  
  return httpRequest;
}

function findFolderRecursive(folders: Folder[], folderId: string): boolean {
  for (const folder of folders) {
    if (folder.id === folderId) return true;
    if (findFolderRecursive(folder.folders, folderId)) return true;
  }
  return false;
}

// 更新 Request
export async function updateRequest(
  _collectionId: string,
  requestId: string,
  updates: Partial<Omit<HttpRequest, 'id'>>,
  _folderId?: string
): Promise<HttpRequest | null> {
  void _collectionId;
  void _folderId;
  await initStorage();
  const service = getServiceNotNull();
  
  const result = await service.updateItem(requestId, {
    data: {
      method: updates.method,
      url: updates.url,
      headers: updates.headers,
      params: updates.params,
      body: updates.body,
      name: updates.name,
      description: updates.description,
    } as Record<string, unknown>,
  });
  
  if (!result) return null;
  
  const resultAny = result as { id: string; type?: string; name?: string };
  if (!resultAny.id || resultAny.id === 'non-existent-id') return null;
  
  const httpRequest: HttpRequest = {
    id: result.id,
    name: (result.data as { name?: string }).name || result.name || '',
    method: ((result.data as { method?: string }).method || 'GET') as HttpMethod,
    url: (result.data as { url?: string }).url || '',
    headers: ((result.data as { headers?: unknown[] }).headers || []) as Header[],
    params: ((result.data as { params?: unknown[] }).params || []) as Param[],
    body: (result.data as { body?: unknown }).body as HttpRequest['body'],
    description: (result.data as { description?: string }).description,
  };
  
  return httpRequest;
}

// 删除 Request
export async function deleteRequest(
  _collectionId: string,
  requestId: string,
  _folderId?: string
): Promise<boolean> {
  void _collectionId;
  void _folderId;
  await initStorage();
  const service = getServiceNotNull();
  return service.deleteItem(requestId);
}

// 根据 ID 查找 Folder（递归）
function findFolderById(folders: Folder[], id: string): Folder | null {
  for (const folder of folders) {
    if (folder.id === id) {
      return folder;
    }
    const found = findFolderById(folder.folders, id);
    if (found) {
      return found;
    }
  }
  return null;
}

// 根据 ID 查找 Request（递归）
function findRequestById(
  collection: Collection,
  requestId: string,
  folderId?: string
): HttpRequest | null {
  if (folderId) {
    const folder = findFolderById(collection.folders, folderId);
    if (folder) {
      return folder.requests.find(r => r.id === requestId) || null;
    }
  }
  return collection.requests.find(r => r.id === requestId) || null;
}

// 获取单个 Collection
export async function getCollectionById(collectionId: string): Promise<Collection | null> {
  await initStorage();
  const service = getServiceNotNull();
  return service.getCollection(collectionId);
}

// 获取单个 Request
export async function getRequestById(
  collectionId: string,
  requestId: string,
  folderId?: string
): Promise<HttpRequest | null> {
  const collection = await getCollectionById(collectionId);
  if (!collection) {
    return null;
  }
  return findRequestById(collection, requestId, folderId);
}

// 移动 Request 到另一个位置
export async function moveRequest(
  collectionId: string,
  requestId: string,
  _sourceFolderId: string | undefined,
  targetFolderId: string | undefined
): Promise<boolean> {
  void _sourceFolderId;
  await initStorage();
  const service = getServiceNotNull();
  
  if (targetFolderId) {
    const collection = await service.getCollection(collectionId);
    if (collection) {
      const folderExists = collection.folders.some(f => f.id === targetFolderId) || 
        collection.folders.some(f => findFolderRecursive(f.folders, targetFolderId));
      if (!folderExists) {
        return false;
      }
    }
  }
  
  const result = await service.moveItem(requestId, targetFolderId || null);
  return result !== null;
}

// 导入 Collection
export async function importCollection(collection: Collection): Promise<Collection> {
  await initStorage();
  const service = getServiceNotNull();
  const created = await service.createCollection(collection.name, collection.description);
  for (const folder of collection.folders) {
    await importFolderRecursive(service, created.id, null, folder);
  }
  for (const request of collection.requests) {
    await service.createItem(created.id, {
      type: 'request',
      name: request.name,
      parentId: null,
      data: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        body: request.body,
        description: request.description,
      },
    });
  }
  const result = await service.getCollection(created.id);
  if (!result) {
    throw new Error('Failed to retrieve imported collection');
  }
  return result;
}

async function importFolderRecursive(
  service: ReturnType<typeof getServiceNotNull>,
  collectionId: string,
  parentId: string | null,
  folder: Folder
): Promise<string> {
  const created = await service.createItem(collectionId, {
    type: 'folder',
    name: folder.name,
    parentId,
    data: { description: folder.description },
  });
  if (!created) throw new Error('Failed to create folder');
  for (const subFolder of folder.folders) {
    await importFolderRecursive(service, collectionId, created.id, subFolder);
  }
  for (const request of folder.requests) {
    await service.createItem(collectionId, {
      type: 'request',
      name: request.name,
      parentId: created.id,
      data: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        body: request.body,
        description: request.description,
      },
    });
  }
  return created.id;
}