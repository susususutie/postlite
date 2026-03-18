// Collection 管理服务
import { v4 as uuidv4 } from 'uuid';
import type { Collection, Folder, HttpRequest } from '../types';
import {
  loadCollections,
  saveCollections,
} from '../store/storage';

// 获取所有 Collections
export function getCollections(): Collection[] {
  return loadCollections();
}

// 创建 Collection
export function createCollection(name: string, description?: string): Collection {
  const collections = loadCollections();
  const now = Date.now();

  const newCollection: Collection = {
    id: uuidv4(),
    name,
    description,
    folders: [],
    requests: [],
    createdAt: now,
    updatedAt: now,
  };

  collections.push(newCollection);
  saveCollections(collections);

  return newCollection;
}

// 更新 Collection
export function updateCollection(
  collectionId: string,
  updates: Partial<Pick<Collection, 'name' | 'description'>>
): Collection | null {
  const collections = loadCollections();
  const index = collections.findIndex(c => c.id === collectionId);

  if (index === -1) {
    return null;
  }

  collections[index] = {
    ...collections[index],
    ...updates,
    updatedAt: Date.now(),
  };

  saveCollections(collections);
  return collections[index];
}

// 删除 Collection
export function deleteCollection(collectionId: string): boolean {
  const collections = loadCollections();
  const filtered = collections.filter(c => c.id !== collectionId);

  if (filtered.length === collections.length) {
    return false;
  }

  saveCollections(filtered);
  return true;
}

// 在 Collection 中创建 Folder
export function createFolder(
  collectionId: string,
  folderName: string,
  parentFolderId?: string
): Folder | null {
  const collections = loadCollections();
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    return null;
  }

  const now = Date.now();
  const newFolder: Folder = {
    id: uuidv4(),
    name: folderName,
    folders: [],
    requests: [],
    createdAt: now,
    updatedAt: now,
  };

  if (parentFolderId) {
    // 递归查找父文件夹
    const parentFolder = findFolderById(collection.folders, parentFolderId);
    if (parentFolder) {
      parentFolder.folders.push(newFolder);
      parentFolder.updatedAt = now;
    } else {
      return null;
    }
  } else {
    collection.folders.push(newFolder);
  }

  collection.updatedAt = now;
  saveCollections(collections);

  return newFolder;
}

// 更新 Folder
export function updateFolder(
  collectionId: string,
  folderId: string,
  updates: Partial<Pick<Folder, 'name' | 'description'>>
): Folder | null {
  const collections = loadCollections();
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    return null;
  }

  const folder = findFolderById(collection.folders, folderId);

  if (!folder) {
    return null;
  }

  Object.assign(folder, updates);
  folder.updatedAt = Date.now();
  collection.updatedAt = Date.now();

  saveCollections(collections);
  return folder;
}

// 删除 Folder
export function deleteFolder(collectionId: string, folderId: string): boolean {
  const collections = loadCollections();
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    return false;
  }

  const removed = removeFolderById(collection.folders, folderId);

  if (!removed) {
    return false;
  }

  collection.updatedAt = Date.now();
  saveCollections(collections);
  return true;
}

// 创建 Request
export function createRequest(
  collectionId: string,
  request: Omit<HttpRequest, 'id' | 'createdAt' | 'updatedAt'>,
  folderId?: string
): HttpRequest | null {
  const collections = loadCollections();
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    return null;
  }

  const now = Date.now();
  const newRequest: HttpRequest = {
    ...request,
    id: uuidv4(),
  };

  if (folderId) {
    const folder = findFolderById(collection.folders, folderId);
    if (folder) {
      folder.requests.push(newRequest);
      folder.updatedAt = now;
    } else {
      return null;
    }
  } else {
    collection.requests.push(newRequest);
  }

  collection.updatedAt = now;
  saveCollections(collections);

  return newRequest;
}

// 更新 Request
export function updateRequest(
  collectionId: string,
  requestId: string,
  updates: Partial<Omit<HttpRequest, 'id'>>,
  folderId?: string
): HttpRequest | null {
  const collections = loadCollections();
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    return null;
  }

  let request: HttpRequest | undefined;
  let parent: { requests: HttpRequest[]; updatedAt: number } | null = null;

  if (folderId) {
    const folder = findFolderById(collection.folders, folderId);
    if (folder) {
      request = folder.requests.find(r => r.id === requestId);
      parent = folder;
    }
  } else {
    request = collection.requests.find(r => r.id === requestId);
    parent = collection;
  }

  if (!request || !parent) {
    return null;
  }

  Object.assign(request, updates);
  const now = Date.now();
  parent.updatedAt = now;
  collection.updatedAt = now;

  saveCollections(collections);
  return request;
}

// 删除 Request
export function deleteRequest(
  collectionId: string,
  requestId: string,
  folderId?: string
): boolean {
  const collections = loadCollections();
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    return false;
  }

  if (folderId) {
    const folder = findFolderById(collection.folders, folderId);
    if (folder) {
      const index = folder.requests.findIndex(r => r.id === requestId);
      if (index !== -1) {
        folder.requests.splice(index, 1);
        folder.updatedAt = Date.now();
        collection.updatedAt = Date.now();
        saveCollections(collections);
        return true;
      }
    }
  } else {
    const index = collection.requests.findIndex(r => r.id === requestId);
    if (index !== -1) {
      collection.requests.splice(index, 1);
      collection.updatedAt = Date.now();
      saveCollections(collections);
      return true;
    }
  }

  return false;
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

// 根据 ID 删除 Folder（递归）
function removeFolderById(folders: Folder[], id: string): boolean {
  const index = folders.findIndex(f => f.id === id);
  if (index !== -1) {
    folders.splice(index, 1);
    return true;
  }

  for (const folder of folders) {
    if (removeFolderById(folder.folders, id)) {
      return true;
    }
  }

  return false;
}

// 获取单个 Collection
export function getCollectionById(collectionId: string): Collection | null {
  const collections = loadCollections();
  return collections.find(c => c.id === collectionId) || null;
}

// 获取单个 Request
export function getRequestById(
  collectionId: string,
  requestId: string,
  folderId?: string
): HttpRequest | null {
  const collection = getCollectionById(collectionId);
  if (!collection) {
    return null;
  }

  if (folderId) {
    const folder = findFolderById(collection.folders, folderId);
    if (folder) {
      return folder.requests.find(r => r.id === requestId) || null;
    }
  } else {
    return collection.requests.find(r => r.id === requestId) || null;
  }

  return null;
}

// 移动 Request 到另一个位置
export function moveRequest(
  collectionId: string,
  requestId: string,
  sourceFolderId: string | undefined,
  targetFolderId: string | undefined
): boolean {
  const collections = loadCollections();
  const collection = collections.find(c => c.id === collectionId);

  if (!collection) {
    return false;
  }

  // 找到源位置的请求
  let request: HttpRequest | undefined;
  let sourceList: HttpRequest[];

  if (sourceFolderId) {
    const sourceFolder = findFolderById(collection.folders, sourceFolderId);
    if (!sourceFolder) return false;
    sourceList = sourceFolder.requests;
  } else {
    sourceList = collection.requests;
  }

  const requestIndex = sourceList.findIndex(r => r.id === requestId);
  if (requestIndex === -1) return false;

  request = sourceList[requestIndex];
  sourceList.splice(requestIndex, 1);

  // 添加到目标位置
  let targetList: HttpRequest[];
  if (targetFolderId) {
    const targetFolder = findFolderById(collection.folders, targetFolderId);
    if (!targetFolder) {
      // 恢复源位置
      sourceList.splice(requestIndex, 0, request);
      return false;
    }
    targetList = targetFolder.requests;
  } else {
    targetList = collection.requests;
  }

  targetList.push(request);

  const now = Date.now();
  collection.updatedAt = now;
  saveCollections(collections);

  return true;
}

// 导入 Collection
export function importCollection(collection: Collection): Collection {
  const collections = loadCollections();
  // 生成新的 ID 避免冲突
  collection.id = uuidv4();
  collection.createdAt = Date.now();
  collection.updatedAt = Date.now();
  collections.push(collection);
  saveCollections(collections);
  return collection;
}
