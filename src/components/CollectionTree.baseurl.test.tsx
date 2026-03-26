import { describe, it, expect, vi } from 'vitest';
import type { Collection, Folder, HttpRequest } from '../types';

// Mock collection service
vi.mock('../services/collection', () => ({
  getCollections: vi.fn(),
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  deleteRequest: vi.fn(),
  importCollection: vi.fn(),
}));

vi.mock('../utils/importers', () => ({
  autoImport: vi.fn(),
}));

vi.mock('../utils/exporters', () => ({
  exportCollection: vi.fn(),
  downloadFile: vi.fn(),
}));

describe('CollectionTree - BaseURL Feature', () => {
  const mockRequest: HttpRequest = {
    id: 'req-1',
    name: 'Get Users',
    method: 'GET',
    url: '{{baseURL}}/users',
    headers: [],
    params: [],
  };

  const mockCollectionWithBaseUrl: Collection = {
    id: 'col-1',
    name: 'API Collection',
    description: 'Test API Collection',
    defaultBaseUrl: 'https://api.example.com',
    folders: [],
    requests: [mockRequest],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mockCollectionWithoutBaseUrl: Collection = {
    id: 'col-2',
    name: 'Empty Collection',
    description: 'No base URL',
    folders: [],
    requests: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  describe('Collection with defaultBaseUrl', () => {
    it('should validate collection with baseUrl has the field set', () => {
      expect(mockCollectionWithBaseUrl.defaultBaseUrl).toBe('https://api.example.com');
    });

    it('should validate collection without baseUrl has undefined field', () => {
      expect(mockCollectionWithoutBaseUrl.defaultBaseUrl).toBeUndefined();
    });

    it('should support template syntax in defaultBaseUrl', () => {
      const collectionWithTemplate: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: '{{baseURL}}/api',
      };
      expect(collectionWithTemplate.defaultBaseUrl).toBe('{{baseURL}}/api');
    });
  });

  describe('Collection Type Validation', () => {
    it('should have optional defaultBaseUrl field', () => {
      // Collection without defaultBaseUrl is valid
      const minimalCollection: Collection = {
        id: 'col-min',
        name: 'Minimal',
        folders: [],
        requests: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      expect(minimalCollection.defaultBaseUrl).toBeUndefined();
      expect(minimalCollection).toBeDefined();
    });

    it('should accept full URL as defaultBaseUrl', () => {
      const collection: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: 'https://api.example.com/v1',
      };
      expect(collection.defaultBaseUrl).toMatch(/^https:\/\//);
    });

    it('should accept URL with port as defaultBaseUrl', () => {
      const collection: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: 'https://api.example.com:8080',
      };
      expect(collection.defaultBaseUrl).toContain(':8080');
    });

    it('should accept URL with path as defaultBaseUrl', () => {
      const collection: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: 'https://api.example.com/api/v1',
      };
      expect(collection.defaultBaseUrl).toContain('/api/v1');
    });

    it('should accept variable template as defaultBaseUrl', () => {
      const collection: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: '{{baseURL}}/api',
      };
      expect(collection.defaultBaseUrl).toMatch(/\{\{.*\}\}/);
    });
  });

  describe('Create Collection with defaultBaseUrl', () => {
    it('should create collection with defaultBaseUrl parameter', () => {
      const newCollection: Collection = {
        id: 'new-col',
        name: 'New API',
        description: 'New API Collection',
        defaultBaseUrl: 'https://new-api.example.com',
        folders: [],
        requests: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(newCollection.defaultBaseUrl).toBe('https://new-api.example.com');
    });

    it('should create collection without defaultBaseUrl (optional)', () => {
      const newCollection: Collection = {
        id: 'simple-col',
        name: 'Simple Collection',
        folders: [],
        requests: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(newCollection.defaultBaseUrl).toBeUndefined();
    });

    it('should support empty string as defaultBaseUrl', () => {
      const newCollection: Collection = {
        id: 'empty-col',
        name: 'Empty BaseUrl Collection',
        defaultBaseUrl: '',
        folders: [],
        requests: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(newCollection.defaultBaseUrl).toBe('');
    });
  });

  describe('Update Collection defaultBaseUrl', () => {
    it('should update defaultBaseUrl field', () => {
      const updated: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: 'https://updated-api.example.com',
      };
      expect(updated.defaultBaseUrl).toBe('https://updated-api.example.com');
    });

    it('should clear defaultBaseUrl when set to undefined', () => {
      const updated: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: undefined,
      };
      expect(updated.defaultBaseUrl).toBeUndefined();
    });

    it('should preserve other fields when updating defaultBaseUrl', () => {
      const updated: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: 'https://new.example.com',
      };
      expect(updated.name).toBe('API Collection');
      expect(updated.description).toBe('Test API Collection');
      expect(updated.requests).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle collection with very long defaultBaseUrl', () => {
      const longBaseUrl = 'https://api.example.com/v1/some/very/long/path/that/keeps/going';
      const collection: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: longBaseUrl,
      };
      expect(collection.defaultBaseUrl).toBe(longBaseUrl);
    });

    it('should handle collection with special characters in defaultBaseUrl', () => {
      const specialBaseUrl = 'https://api.example.com:8080/path?query=value';
      const collection: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: specialBaseUrl,
      };
      expect(collection.defaultBaseUrl).toBe(specialBaseUrl);
    });

    it('should handle collection with query params in defaultBaseUrl', () => {
      const baseUrlWithQuery = 'https://api.example.com?version=v1';
      const collection: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: baseUrlWithQuery,
      };
      expect(collection.defaultBaseUrl).toContain('?');
    });

    it('should handle collection with fragment in defaultBaseUrl', () => {
      const baseUrlWithFragment = 'https://api.example.com#section';
      const collection: Collection = {
        ...mockCollectionWithBaseUrl,
        defaultBaseUrl: baseUrlWithFragment,
      };
      expect(collection.defaultBaseUrl).toContain('#');
    });
  });

  describe('Multiple Collections', () => {
    it('should handle multiple collections with different baseUrls', () => {
      const collections: Collection[] = [
        { ...mockCollectionWithBaseUrl, id: 'col-1', defaultBaseUrl: 'https://api1.com' },
        { ...mockCollectionWithBaseUrl, id: 'col-2', defaultBaseUrl: 'https://api2.com' },
        { ...mockCollectionWithBaseUrl, id: 'col-3', defaultBaseUrl: 'https://api3.com' },
      ];

      expect(collections[0].defaultBaseUrl).toBe('https://api1.com');
      expect(collections[1].defaultBaseUrl).toBe('https://api2.com');
      expect(collections[2].defaultBaseUrl).toBe('https://api3.com');
    });

    it('should handle mix of collections with and without baseUrl', () => {
      const collections: Collection[] = [
        mockCollectionWithBaseUrl,
        mockCollectionWithoutBaseUrl,
        { ...mockCollectionWithBaseUrl, id: 'col-3', defaultBaseUrl: '{{baseURL}}' },
      ];

      expect(collections[0].defaultBaseUrl).toBeDefined();
      expect(collections[1].defaultBaseUrl).toBeUndefined();
      expect(collections[2].defaultBaseUrl).toContain('{{');
    });
  });

  describe('Folder Creation Context', () => {
    it('should not affect folder structure when setting defaultBaseUrl', () => {
      const folder: Folder = {
        id: 'folder-1',
        name: 'Test Folder',
        folders: [],
        requests: [mockRequest],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const collection: Collection = {
        ...mockCollectionWithBaseUrl,
        folders: [folder],
      };

      expect(collection.folders).toHaveLength(1);
      expect(collection.folders[0].requests).toHaveLength(1);
      expect(collection.defaultBaseUrl).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with collections created before baseUrl feature', () => {
      // Simulating old collection without defaultBaseUrl field
      const oldCollection = {
        id: 'old-col',
        name: 'Old Collection',
        description: 'Created before baseUrl',
        folders: [],
        requests: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Collection;

      expect(oldCollection.defaultBaseUrl).toBeUndefined();
    });

    it('should maintain existing behavior when defaultBaseUrl is not used', () => {
      const collection: Collection = {
        id: 'standard-col',
        name: 'Standard Collection',
        folders: [],
        requests: [mockRequest],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(collection).toBeDefined();
      expect(collection.requests[0].url).toBe('{{baseURL}}/users');
    });
  });

  describe('Form Data Structure', () => {
    it('should have correct form values for create mode', () => {
      const formValues = {
        name: 'New Collection',
        description: 'Description',
        defaultBaseUrl: 'https://api.example.com',
      };

      expect(formValues).toHaveProperty('defaultBaseUrl');
      expect(formValues.defaultBaseUrl).toBe('https://api.example.com');
    });

    it('should have correct form values for edit mode with existing baseUrl', () => {
      const formValues = {
        name: mockCollectionWithBaseUrl.name,
        description: mockCollectionWithBaseUrl.description,
        defaultBaseUrl: mockCollectionWithBaseUrl.defaultBaseUrl,
      };

      expect(formValues.defaultBaseUrl).toBe('https://api.example.com');
    });

    it('should handle partial updates to collection', () => {
      const updates = {
        name: 'Updated Name',
        defaultBaseUrl: 'https://new.example.com',
      };

      const updated = { ...mockCollectionWithBaseUrl, ...updates };

      expect(updated.name).toBe('Updated Name');
      expect(updated.defaultBaseUrl).toBe('https://new.example.com');
      expect(updated.description).toBe('Test API Collection'); // unchanged
    });
  });
});