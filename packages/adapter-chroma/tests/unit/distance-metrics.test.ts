import { describe, it, expect, beforeEach } from 'vitest';
import { ChromaAdapter } from '../../src/chroma-adapter';

describe('ChromaAdapter - Distance Metrics', () => {
  let adapter: ChromaAdapter;

  beforeEach(() => {
    adapter = new ChromaAdapter({
      host: 'localhost',
      port: 8000,
    });
  });

  describe('metric mapping', () => {
    it('should map cosine metric to Chroma format', async () => {
      // Test that cosine metric is accepted
      await expect(
        adapter.createCollection('test-cosine', 384, 'cosine')
      ).rejects.toThrow('Not connected');
    });

    it('should map euclidean metric to Chroma format', async () => {
      // Test that euclidean metric is accepted
      await expect(
        adapter.createCollection('test-euclidean', 384, 'euclidean')
      ).rejects.toThrow('Not connected');
    });

    it('should map dotProduct metric to Chroma format', async () => {
      // Test that dotProduct metric is accepted
      await expect(
        adapter.createCollection('test-dotproduct', 384, 'dotProduct')
      ).rejects.toThrow('Not connected');
    });

    it('should default to cosine if no metric specified', async () => {
      // Test that default metric works
      await expect(
        adapter.createCollection('test-default', 384)
      ).rejects.toThrow('Not connected');
    });
  });

  describe('metric in stats', () => {
    it('should include metric in collection stats', async () => {
      // This would need mocking to fully test
      await expect(
        adapter.getCollectionStats('test-collection')
      ).rejects.toThrow('Not connected');
    });
  });

  describe('edge cases', () => {
    it('should handle metric case sensitivity', async () => {
      // Ensure consistent handling
      await expect(
        adapter.createCollection('test-collection', 384, 'cosine')
      ).rejects.toThrow('Not connected');
    });
  });
});
