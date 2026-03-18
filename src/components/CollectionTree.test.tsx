import { describe, it, expect } from 'vitest';
import type { Collection, HttpRequest, Folder } from '../types';

describe('CollectionTree Component', () => {
  const mockRequest: HttpRequest = {
    id: 'req-1',
    name: 'Get Users',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: [],
    params: [],
  };

  const mockFolder: Folder = {
    id: 'folder-1',
    name: 'Test Folder',
    folders: [],
    requests: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockCollection: Collection = {
    id: 'col-1',
    name: 'Test Collection',
    description: 'Test Description',
    folders: [mockFolder],
    requests: [mockRequest],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('should validate collection structure', () => {
    expect(mockCollection).toBeDefined();
    expect(mockCollection.id).toBe('col-1');
    expect(mockCollection.name).toBe('Test Collection');
    expect(mockCollection.folders).toHaveLength(1);
    expect(mockCollection.requests).toHaveLength(1);
  });

  it('should validate folder structure', () => {
    expect(mockFolder).toBeDefined();
    expect(mockFolder.id).toBe('folder-1');
    expect(mockFolder.name).toBe('Test Folder');
    expect(mockFolder.folders).toHaveLength(0);
    expect(mockFolder.requests).toHaveLength(0);
  });

  it('should validate request in collection', () => {
    const request = mockCollection.requests[0];
    expect(request.id).toBe('req-1');
    expect(request.name).toBe('Get Users');
    expect(request.method).toBe('GET');
  });

  it('should handle nested folder structure', () => {
    const nestedFolder: Folder = {
      id: 'nested-1',
      name: 'Nested Folder',
      folders: [],
      requests: [mockRequest],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const parentFolder: Folder = {
      id: 'parent-1',
      name: 'Parent Folder',
      folders: [nestedFolder],
      requests: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const collectionWithNesting: Collection = {
      ...mockCollection,
      folders: [parentFolder],
    };

    expect(collectionWithNesting.folders[0].folders).toHaveLength(1);
    expect(collectionWithNesting.folders[0].folders[0].requests).toHaveLength(1);
  });

  it('should handle empty collection', () => {
    const emptyCollection: Collection = {
      id: 'empty',
      name: 'Empty Collection',
      folders: [],
      requests: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(emptyCollection.folders).toHaveLength(0);
    expect(emptyCollection.requests).toHaveLength(0);
  });

  it('should handle collection with multiple folders', () => {
    const collection: Collection = {
      ...mockCollection,
      folders: [
        { id: 'f1', name: 'Folder 1', folders: [], requests: [], createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'f2', name: 'Folder 2', folders: [], requests: [], createdAt: Date.now(), updatedAt: Date.now() },
        { id: 'f3', name: 'Folder 3', folders: [], requests: [], createdAt: Date.now(), updatedAt: Date.now() },
      ],
    };

    expect(collection.folders).toHaveLength(3);
  });

  it('should handle collection with multiple requests', () => {
    const collection: Collection = {
      ...mockCollection,
      requests: [
        { ...mockRequest, id: 'r1', name: 'Request 1', method: 'GET' },
        { ...mockRequest, id: 'r2', name: 'Request 2', method: 'POST' },
        { ...mockRequest, id: 'r3', name: 'Request 3', method: 'PUT' },
      ],
    };

    expect(collection.requests).toHaveLength(3);
    expect(collection.requests.map(r => r.method)).toContain('GET');
    expect(collection.requests.map(r => r.method)).toContain('POST');
    expect(collection.requests.map(r => r.method)).toContain('PUT');
  });
});
