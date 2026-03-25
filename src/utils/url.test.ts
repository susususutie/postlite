import { describe, it, expect } from 'vitest';
import {
  hasProtocol,
  normalizeUrl,
  isValidUrl,
  isAbsolutePath,
  weakConcatenateBaseUrl,
} from './url';

describe('URL Utilities', () => {
  describe('hasProtocol', () => {
    it('should detect http protocol', () => {
      expect(hasProtocol('http://example.com')).toBe(true);
      expect(hasProtocol('http://localhost:3000')).toBe(true);
    });

    it('should detect https protocol', () => {
      expect(hasProtocol('https://example.com')).toBe(true);
      expect(hasProtocol('https://api.example.com/v1')).toBe(true);
    });

    it('should detect other protocols', () => {
      expect(hasProtocol('ftp://ftp.example.com')).toBe(true);
      expect(hasProtocol('ws://localhost:8080')).toBe(true);
      expect(hasProtocol('wss://secure.example.com')).toBe(true);
      expect(hasProtocol('file:///path/to/file')).toBe(true);
    });

    it('should detect protocol-relative URLs (//)', () => {
      expect(hasProtocol('//cdn.example.com')).toBe(true);
      expect(hasProtocol('//api.example.com/v1')).toBe(true);
    });

    it('should return false for URLs without protocol', () => {
      expect(hasProtocol('example.com')).toBe(false);
      expect(hasProtocol('api.example.com/v1')).toBe(false);
      expect(hasProtocol('/api/users')).toBe(false);
      expect(hasProtocol('users')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasProtocol('')).toBe(false);
    });

    it('should handle URLs with variables', () => {
      expect(hasProtocol('{{baseUrl}}/users')).toBe(false);
      expect(hasProtocol('https://{{host}}/api')).toBe(true);
    });
  });

  describe('normalizeUrl', () => {
    it('should normalize double slashes in pathname', () => {
      expect(normalizeUrl('https://api.com//v1//users')).toBe('https://api.com/v1/users');
    });

    it('should normalize triple slashes', () => {
      expect(normalizeUrl('https://api.com///v1///users')).toBe('https://api.com/v1/users');
    });

    it('should preserve query parameters', () => {
      const url = 'https://api.com//v1//users?foo=bar&baz=qux';
      const result = normalizeUrl(url);
      expect(result).toBe('https://api.com/v1/users?foo=bar&baz=qux');
    });

    it('should preserve hash fragments', () => {
      const url = 'https://api.com//v1//users#section';
      const result = normalizeUrl(url);
      expect(result).toBe('https://api.com/v1/users#section');
    });

    it('should preserve query and hash together', () => {
      const url = 'https://api.com//v1//users?foo=bar#section';
      const result = normalizeUrl(url);
      expect(result).toBe('https://api.com/v1/users?foo=bar#section');
    });

    it('should handle URLs without protocol', () => {
      expect(normalizeUrl('/api//users')).toBe('/api/users');
      expect(normalizeUrl('api//users')).toBe('/api/users');
    });

    it('should handle URLs with special characters in query', () => {
      const url = 'https://api.com//v1?search=hello world&special=a+b';
      const result = normalizeUrl(url);
      expect(result).toContain('search=hello');
      expect(result).toContain('special=a+b');
    });

    it('should normalize URLs that can be parsed as relative paths', () => {
      // URLs without protocol are parsed as relative paths with dummy base
      // The URL constructor normalizes them, so they get encoded
      const result = normalizeUrl('not a valid url at all !!!');
      // The space gets encoded to %20 and it's treated as a pathname
      expect(result).toBe('/not%20a%20valid%20url%20at%20all%20!!!');
    });

    it('should handle empty string', () => {
      expect(normalizeUrl('')).toBe('');
    });

    it('should handle root path', () => {
      expect(normalizeUrl('https://api.com/')).toBe('https://api.com/');
    });

    it('should normalize URLs with ports', () => {
      expect(normalizeUrl('https://api.com:8080//v1//users')).toBe('https://api.com:8080/v1/users');
    });

    it('should handle protocol-relative URLs', () => {
      expect(normalizeUrl('//cdn.example.com//path//file.js')).toBe('//cdn.example.com/path/file.js');
    });

    it('should preserve encoded characters in query', () => {
      const url = 'https://api.com//v1?encoded=%2F%2F';
      const result = normalizeUrl(url);
      expect(result).toBe('https://api.com/v1?encoded=%2F%2F');
    });
  });

  describe('isValidUrl', () => {
    it('should validate http URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('should validate https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://api.example.com/v1/users')).toBe(true);
    });

    it('should validate URLs with query strings', () => {
      expect(isValidUrl('https://example.com?foo=bar')).toBe(true);
    });

    it('should validate URLs with hash fragments', () => {
      expect(isValidUrl('https://example.com#section')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });

    it('should return false for URLs without protocol', () => {
      expect(isValidUrl('example.com')).toBe(false);
      expect(isValidUrl('/api/users')).toBe(false);
    });

    it('should not validate protocol-relative URLs as standalone', () => {
      // Protocol-relative URLs need a base URL to be valid
      expect(isValidUrl('//example.com')).toBe(false);
    });

    it('should validate file URLs', () => {
      expect(isValidUrl('file:///path/to/file')).toBe(true);
    });
  });

  describe('isAbsolutePath', () => {
    it('should return true for paths starting with /', () => {
      expect(isAbsolutePath('/api/users')).toBe(true);
      expect(isAbsolutePath('/')).toBe(true);
    });

    it('should return false for relative paths', () => {
      expect(isAbsolutePath('api/users')).toBe(false);
      expect(isAbsolutePath('users')).toBe(false);
    });

    it('should return false for URLs with protocol', () => {
      expect(isAbsolutePath('https://example.com')).toBe(false);
      expect(isAbsolutePath('http://example.com')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isAbsolutePath('')).toBe(false);
    });

    it('should return false for URLs with variables', () => {
      expect(isAbsolutePath('{{baseUrl}}/users')).toBe(false);
    });
  });

  describe('weakConcatenateBaseUrl', () => {
    it('should concatenate when all conditions met', () => {
      const result = weakConcatenateBaseUrl('users', 'https://api.example.com');
      expect(result).toBe('https://api.example.comusers');
    });

    it('should concatenate with trailing slash in base', () => {
      const result = weakConcatenateBaseUrl('users', 'https://api.example.com/');
      expect(result).toBe('https://api.example.com/users');
    });

    it('should NOT concatenate when request URL has protocol', () => {
      const result = weakConcatenateBaseUrl('https://other.com/users', 'https://api.example.com');
      expect(result).toBe('https://other.com/users');
    });

    it('should NOT concatenate when request URL has template variables', () => {
      const result = weakConcatenateBaseUrl('{{baseUrl}}/users', 'https://api.example.com');
      expect(result).toBe('{{baseUrl}}/users');
    });

    it('should NOT concatenate when request URL is absolute path', () => {
      const result = weakConcatenateBaseUrl('/api/users', 'https://api.example.com');
      expect(result).toBe('/api/users');
    });

    it('should return original when no base URL provided', () => {
      const result = weakConcatenateBaseUrl('users', undefined);
      expect(result).toBe('users');
    });

    it('should return original when base URL is empty', () => {
      const result = weakConcatenateBaseUrl('users', '');
      expect(result).toBe('users');
    });

    it('should NOT concatenate protocol-relative URLs', () => {
      const result = weakConcatenateBaseUrl('//cdn.example.com/file.js', 'https://api.example.com');
      expect(result).toBe('//cdn.example.com/file.js');
    });

    it('should handle edge cases', () => {
      // Empty request URL
      expect(weakConcatenateBaseUrl('', 'https://api.example.com')).toBe('https://api.example.com');
      
      // Both empty
      expect(weakConcatenateBaseUrl('', '')).toBe('');
      
      // Request URL with only template
      expect(weakConcatenateBaseUrl('{{baseUrl}}', 'https://api.example.com')).toBe('{{baseUrl}}');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete URL workflow', () => {
      // Simulate: baseUrl = https://api.com/, requestUrl = //v1//users?foo=bar
      const baseUrl = 'https://api.com/';
      const requestUrl = 'v1//users';
      
      // Step 1: Weak concatenate
      const concatenated = weakConcatenateBaseUrl(requestUrl, baseUrl);
      expect(concatenated).toBe('https://api.com/v1//users');
      
      // Step 2: Normalize
      const normalized = normalizeUrl(concatenated);
      expect(normalized).toBe('https://api.com/v1/users');
      
      // Step 3: Validate
      expect(isValidUrl(normalized)).toBe(true);
    });

    it('should handle template variable workflow', () => {
      // When request has template, it should NOT concatenate
      const requestUrl = '{{baseUrl}}/users';
      const baseUrl = 'https://api.example.com';
      
      const concatenated = weakConcatenateBaseUrl(requestUrl, baseUrl);
      expect(concatenated).toBe('{{baseUrl}}/users');
    });

    it('should handle absolute path workflow', () => {
      // When request is absolute path, it should NOT concatenate
      const requestUrl = '/api/users';
      const baseUrl = 'https://api.example.com';
      
      const concatenated = weakConcatenateBaseUrl(requestUrl, baseUrl);
      expect(concatenated).toBe('/api/users');
    });
  });
});
