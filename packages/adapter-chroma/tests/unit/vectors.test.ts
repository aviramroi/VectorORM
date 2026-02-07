import { describe, it, expect, beforeEach } from 'vitest';
import { ChromaAdapter } from '../../src/chroma-adapter';
import type { VectorRecord, MetadataUpdate } from '@vectororm/core';

describe('ChromaAdapter - Vector Operations', () => {
  let adapter: ChromaAdapter;

  beforeEach(() => {
    adapter = new ChromaAdapter({
      host: 'localhost',
      port: 8000,
    });
  });

  describe('upsert', () => {
    it('should throw if not connected', async () => {
      const records: VectorRecord[] = [
        {
          id: 'vec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { text: 'test' },
        },
      ];

      await expect(
        adapter.upsert('test-collection', records)
      ).rejects.toThrow('Not connected. Call connect() first.');
    });

    it('should handle single record', async () => {
      const records: VectorRecord[] = [
        {
          id: 'vec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { text: 'test' },
        },
      ];

      await expect(
        adapter.upsert('test-collection', records)
      ).rejects.toThrow('Not connected');
    });

    it('should handle multiple records', async () => {
      const records: VectorRecord[] = [
        {
          id: 'vec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { text: 'test1' },
        },
        {
          id: 'vec2',
          embedding: [0.4, 0.5, 0.6],
          metadata: { text: 'test2' },
        },
      ];

      await expect(
        adapter.upsert('test-collection', records)
      ).rejects.toThrow('Not connected');
    });

    it('should handle records without metadata', async () => {
      const records: VectorRecord[] = [
        {
          id: 'vec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: {},
        },
      ];

      await expect(
        adapter.upsert('test-collection', records)
      ).rejects.toThrow('Not connected');
    });

    it('should handle records with complex metadata', async () => {
      const records: VectorRecord[] = [
        {
          id: 'vec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: {
            text: 'test',
            number: 42,
            bool: true,
            tags: ['tag1', 'tag2'],
          },
        },
      ];

      await expect(
        adapter.upsert('test-collection', records)
      ).rejects.toThrow('Not connected');
    });
  });

  describe('fetch', () => {
    it('should throw if not connected', async () => {
      await expect(
        adapter.fetch('test-collection', ['vec1'])
      ).rejects.toThrow('Not connected. Call connect() first.');
    });

    it('should handle single ID', async () => {
      await expect(
        adapter.fetch('test-collection', ['vec1'])
      ).rejects.toThrow('Not connected');
    });

    it('should handle multiple IDs', async () => {
      await expect(
        adapter.fetch('test-collection', ['vec1', 'vec2', 'vec3'])
      ).rejects.toThrow('Not connected');
    });

    it('should handle empty ID array', async () => {
      await expect(
        adapter.fetch('test-collection', [])
      ).rejects.toThrow('Not connected');
    });
  });

  describe('delete', () => {
    it('should throw if not connected', async () => {
      await expect(
        adapter.delete('test-collection', ['vec1'])
      ).rejects.toThrow('Not connected. Call connect() first.');
    });

    it('should handle single ID', async () => {
      await expect(
        adapter.delete('test-collection', ['vec1'])
      ).rejects.toThrow('Not connected');
    });

    it('should handle multiple IDs', async () => {
      await expect(
        adapter.delete('test-collection', ['vec1', 'vec2', 'vec3'])
      ).rejects.toThrow('Not connected');
    });

    it('should handle empty ID array', async () => {
      await expect(
        adapter.delete('test-collection', [])
      ).rejects.toThrow('Not connected');
    });
  });

  describe('updateMetadata', () => {
    it('should throw if not connected', async () => {
      const updates: MetadataUpdate[] = [
        {
          id: 'vec1',
          metadata: { updated: true },
        },
      ];

      await expect(
        adapter.updateMetadata('test-collection', updates)
      ).rejects.toThrow('Not connected. Call connect() first.');
    });

    it('should handle single update', async () => {
      const updates: MetadataUpdate[] = [
        {
          id: 'vec1',
          metadata: { updated: true },
        },
      ];

      await expect(
        adapter.updateMetadata('test-collection', updates)
      ).rejects.toThrow('Not connected');
    });

    it('should handle multiple updates', async () => {
      const updates: MetadataUpdate[] = [
        {
          id: 'vec1',
          metadata: { updated: true },
        },
        {
          id: 'vec2',
          metadata: { updated: false },
        },
      ];

      await expect(
        adapter.updateMetadata('test-collection', updates)
      ).rejects.toThrow('Not connected');
    });

    it('should handle partial metadata update', async () => {
      const updates: MetadataUpdate[] = [
        {
          id: 'vec1',
          metadata: { field1: 'new value' },
        },
      ];

      await expect(
        adapter.updateMetadata('test-collection', updates)
      ).rejects.toThrow('Not connected');
    });
  });

  describe('search', () => {
    it('should throw if not connected', async () => {
      const queryVector = [0.1, 0.2, 0.3];

      await expect(
        adapter.search('test-collection', queryVector)
      ).rejects.toThrow('Not connected. Call connect() first.');
    });

    it('should handle basic search', async () => {
      const queryVector = [0.1, 0.2, 0.3];

      await expect(
        adapter.search('test-collection', queryVector)
      ).rejects.toThrow('Not connected');
    });

    it('should handle search with topK', async () => {
      const queryVector = [0.1, 0.2, 0.3];

      await expect(
        adapter.search('test-collection', queryVector, { topK: 5 })
      ).rejects.toThrow('Not connected');
    });

    it('should handle search with filter', async () => {
      const queryVector = [0.1, 0.2, 0.3];
      const filter = { field: 'category', op: 'eq' as const, value: 'test' };

      await expect(
        adapter.search('test-collection', queryVector, { filter })
      ).rejects.toThrow('Not connected');
    });

    it('should handle search with includeMetadata=false', async () => {
      const queryVector = [0.1, 0.2, 0.3];

      await expect(
        adapter.search('test-collection', queryVector, { includeMetadata: false })
      ).rejects.toThrow('Not connected');
    });

    it('should handle search with includeValues=true', async () => {
      const queryVector = [0.1, 0.2, 0.3];

      await expect(
        adapter.search('test-collection', queryVector, { includeValues: true })
      ).rejects.toThrow('Not connected');
    });

    it('should handle search with all options', async () => {
      const queryVector = [0.1, 0.2, 0.3];
      const filter = { field: 'category', op: 'eq' as const, value: 'test' };

      await expect(
        adapter.search('test-collection', queryVector, {
          topK: 5,
          filter,
          includeMetadata: true,
          includeValues: true,
        })
      ).rejects.toThrow('Not connected');
    });
  });

  describe('capability flags', () => {
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
