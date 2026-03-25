import { describe, it, expect, beforeEach } from 'vitest';
import { swaggerAdapter } from '../../adapters/swagger';
import { initStorage, getService } from '../../services/storageBridge';
import type { Collection, HttpRequest, Folder } from '../../types';

import swaggerJson from './swagger.json';

describe('Real Swagger Import Tests', () => {
  let service: ReturnType<typeof getService>;
  let createdCollection: Collection | null = null;

  beforeEach(async () => {
    await initStorage();
    service = getService();
    expect(service).not.toBeNull();
  });

  it('should parse real swagger.json from 192.168.110.234', () => {
    const ir = swaggerAdapter.parse(swaggerJson);
    
    expect(ir.name).toBeDefined();
    expect(ir.name.length).toBeGreaterThan(0);
    expect(ir.items.length).toBeGreaterThan(0);
    
    console.log('Parsed IR:', {
      name: ir.name,
      description: ir.description,
      itemCount: ir.items.length,
      folders: ir.items.filter(i => i.type === 'folder').map(f => ({ name: f.name, childrenCount: f.children?.length || 0 })),
    });
  });

  it('should import swagger.json to IndexedDB and retrieve', async () => {
    const ir = swaggerAdapter.parse(swaggerJson);
    
    createdCollection = await service!.createCollection(ir.name, ir.description!);
    expect(createdCollection).not.toBeNull();
    expect(createdCollection!.name).toBe(ir.name);
    
    const rootFolder = createdCollection!.folders[0];
    expect(rootFolder).toBeDefined();
    
    const folderMap = new Map<string, string>();
    folderMap.set('root', rootFolder.id);
    
    for (const item of ir.items) {
      if (item.type === 'folder') {
        const folderItem = await service!.createItem(createdCollection!.id, {
          type: 'folder',
          name: item.name,
          parentId: rootFolder.id,
          data: { description: item.description },
        });
        expect(folderItem).not.toBeNull();
        folderMap.set(item.name, folderItem!.id);
        
        if (item.children) {
          for (const child of item.children) {
            await service!.createItem(createdCollection!.id, {
              type: 'request',
              name: child.name,
              parentId: folderItem!.id,
              data: {
                method: child.method,
                url: child.url,
                headers: child.headers,
                params: child.params,
                body: child.body,
                description: child.description,
              },
            });
          }
        }
      } else {
        await service!.createItem(createdCollection!.id, {
          type: 'request',
          name: item.name,
          parentId: rootFolder.id,
          data: {
            method: item.method,
            url: item.url,
            headers: item.headers,
            params: item.params,
            body: item.body,
            description: item.description,
          },
        });
      }
    }
    
    const retrieved = await service!.getCollection(createdCollection!.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBeDefined();
    
    const allFolders = extractAllFolders(retrieved!);
    const allRequests = extractAllRequests(retrieved!);
    
    console.log('Retrieved collection:', {
      name: retrieved!.name,
      folderCount: allFolders.length,
      requestCount: allRequests.length,
    });
    
    expect(allFolders.length).toBeGreaterThan(0);
    expect(allRequests.length).toBeGreaterThan(0);
  });

  it('should export imported collection back to swagger format', async () => {
    const ir = swaggerAdapter.parse(swaggerJson);
    
    createdCollection = await service!.createCollection(ir.name + ' Exported', ir.description || undefined);
    const rootFolder = createdCollection!.folders[0];
    
    for (const item of ir.items.slice(0, 3)) {
      if (item.type === 'folder' && item.children) {
        const folderItem = await service!.createItem(createdCollection!.id, {
          type: 'folder',
          name: item.name,
          parentId: rootFolder.id,
          data: {},
        });
        
        for (const child of item.children.slice(0, 2)) {
          await service!.createItem(createdCollection!.id, {
            type: 'request',
            name: child.name,
            parentId: folderItem!.id,
            data: { method: child.method, url: child.url },
          });
        }
      }
    }
    
    const retrieved = await service!.getCollection(createdCollection!.id);
    expect(retrieved).not.toBeNull();
    
    const exportedIr = collectionToIr(retrieved!);
    expect(exportedIr.name).toBe(ir.name + ' Exported');
    expect(exportedIr.items.length).toBeGreaterThan(0);
    
    console.log('Exported IR:', JSON.stringify(exportedIr, null, 2).slice(0, 500));
  });

  it('should handle large swagger.json with many endpoints', () => {
    const ir = swaggerAdapter.parse(swaggerJson);
    
    let totalRequests = 0;
    for (const item of ir.items) {
      if (item.type === 'folder') {
        totalRequests += item.children?.length || 0;
      } else {
        totalRequests += 1;
      }
    }
    
    console.log('Total endpoints in swagger.json:', totalRequests);
    expect(totalRequests).toBeGreaterThan(10);
  });
});

function extractAllFolders(collection: Collection): Folder[] {
  const result: Folder[] = [];
  
  function collect(inputFolders: Folder[]) {
    for (const folder of inputFolders) {
      result.push(folder);
      if (folder.folders.length > 0) {
        collect(folder.folders);
      }
    }
  }
  
  collect(collection.folders);
  return result;
}

function extractAllRequests(collection: Collection): HttpRequest[] {
  const result: HttpRequest[] = [];
  
  function collect(inputFolders: Folder[]) {
    for (const folder of inputFolders) {
      result.push(...folder.requests);
      if (folder.folders.length > 0) {
        collect(folder.folders);
      }
    }
  }
  
  result.push(...collection.requests);
  collect(collection.folders);
  return result;
}

function collectionToIr(collection: Collection): { name: string; description?: string; items: unknown[] } {
  const items: unknown[] = [];
  
  function convertFolder(folder: Folder, parentItems: unknown[]) {
    const folderItem: unknown = {
      id: folder.id,
      type: 'folder' as const,
      name: folder.name,
      description: folder.description,
      children: [],
    };
    parentItems.push(folderItem);
    
    for (const req of folder.requests) {
      (folderItem as { children: unknown[] }).children.push({
        id: req.id,
        type: 'request' as const,
        name: req.name,
        method: req.method,
        url: req.url,
        headers: req.headers,
        params: req.params,
        body: req.body,
        description: req.description,
      });
    }
    
    for (const subFolder of folder.folders) {
      convertFolder(subFolder, (folderItem as { children: unknown[] }).children);
    }
  }
  
  for (const req of collection.requests) {
    items.push({
      id: req.id,
      type: 'request' as const,
      name: req.name,
      method: req.method,
      url: req.url,
    });
  }
  
  for (const folder of collection.folders) {
    convertFolder(folder, items);
  }
  
  return {
    name: collection.name,
    description: collection.description,
    items,
  };
}
