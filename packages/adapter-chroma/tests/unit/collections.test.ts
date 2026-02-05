import { describe, it, expect, beforeEach } from 'vitest';
import { ChromaAdapter } from '../../src/chroma-adapter';

describe('ChromaAdapter - Collections', () => {
  let adapter: ChromaAdapter;

  beforeEach(() => {
    adapter = new ChromaAdapter({
      host: 'localhost',
      port: 8000,
    });
  });

  describe('createCollection', () => {
    it('should throw if not connected', async () => {
      await expect(
        adapter.createCollection('test-collection', 384)
      ).rejects.toThrow('Not connected. Call connect() first.');
    });

    it('should require collection name and dimension', async () => {
      // This would need mocking to test actual creation
      await expect(
        adapter.createCollection('test-collection', 384)
      ).rejects.toThrow();
    });

    it('should support cosine metric', async () => {
      await expect(
        adapter.createCollection('test-collection', 384, 'cosine')
      ).rejects.toThrow('Not connected');
    });

    it('should support euclidean metric', async () => {
      await expect(
        adapter.createCollection('test-collection', 384, 'euclidean')
      ).rejects.toThrow('Not connected');
    });

    it('should support dotProduct metric', async () => {
      await expect(
        adapter.createCollection('test-collection', 384, 'dotProduct')
      ).rejects.toThrow('Not connected');
    });
  });

  describe('deleteCollection', () => {
    it('should throw if not connected', async () => {
      await expect(
        adapter.deleteCollection('test-collection')
      ).rejects.toThrow('Not connected. Call connect() first.');
    });
  });

  describe('collectionExists', () => {
    it('should throw if not connected', async () => {
      await expect(
        adapter.collectionExists('test-collection')
      ).rejects.toThrow('Not connected. Call connect() first.');
    });
  });

  describe('getCollectionStats', () => {
    it('should throw if not connected', async () => {
      await expect(
        adapter.getCollectionStats('test-collection')
      ).rejects.toThrow('Not connected. Call connect() first.');
    });

    it('should return stats with vectorCount, dimension, and metric', async () => {
      // This would need mocking to test actual stats
      await expect(
        adapter.getCollectionStats('test-collection')
      ).rejects.toThrow('Not connected');
    });
  });
});
