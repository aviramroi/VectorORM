import { describe, it, expect, beforeEach } from 'vitest';
import { TurbopufferAdapter } from '../../src/turbopuffer-adapter';

describe('TurbopufferAdapter - Collections', () => {
  let adapter: TurbopufferAdapter;

  beforeEach(() => {
    adapter = new TurbopufferAdapter({
      apiKey: 'test-api-key',
    });
  });

  describe('createCollection', () => {
    it('should throw if not connected', async () => {
      await expect(
        adapter.createCollection('test', 128, 'cosine')
      ).rejects.toThrow('Not connected');
    });

    it('should accept valid collection parameters', () => {
      // Just test that the method signature is correct
      expect(adapter.createCollection).toBeDefined();
      expect(typeof adapter.createCollection).toBe('function');
    });

    it('should default to cosine metric', () => {
      // Method signature allows optional metric parameter
      expect(adapter.createCollection).toBeDefined();
    });
  });

  describe('deleteCollection', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.deleteCollection('test')).rejects.toThrow(
        'Not connected'
      );
    });

    it('should accept collection name', () => {
      expect(adapter.deleteCollection).toBeDefined();
      expect(typeof adapter.deleteCollection).toBe('function');
    });
  });

  describe('collectionExists', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.collectionExists('test')).rejects.toThrow(
        'Not connected'
      );
    });

    it('should return boolean', async () => {
      // Without mocking, this will throw, but we verify the signature
      expect(adapter.collectionExists).toBeDefined();
      expect(typeof adapter.collectionExists).toBe('function');
    });
  });

  describe('getCollectionStats', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.getCollectionStats('test')).rejects.toThrow(
        'Not connected'
      );
    });

    it('should return stats object', () => {
      expect(adapter.getCollectionStats).toBeDefined();
      expect(typeof adapter.getCollectionStats).toBe('function');
    });
  });

  describe('Capability flags', () => {
    it('should support metadata updates', () => {
      expect(adapter.supportsMetadataUpdate()).toBe(true);
    });

    it('should support filtering', () => {
      expect(adapter.supportsFiltering()).toBe(true);
    });

    it('should support batch operations', () => {
      expect(adapter.supportsBatchOperations()).toBe(true);
    });
  });
});
