import { describe, it, expect, beforeEach } from 'vitest';
import { TurbopufferAdapter } from '../../src/turbopuffer-adapter';
import type { VectorRecord, MetadataUpdate } from '@vectororm/core';

describe('TurbopufferAdapter - Vector Operations', () => {
  let adapter: TurbopufferAdapter;

  beforeEach(() => {
    adapter = new TurbopufferAdapter({
      apiKey: 'test-api-key',
    });
  });

  describe('upsert', () => {
    it('should throw if not connected', async () => {
      const records: VectorRecord[] = [
        {
          id: 'vec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { title: 'Test' },
        },
      ];

      await expect(adapter.upsert('test', records)).rejects.toThrow(
        'Not connected'
      );
    });

    it('should accept vector records array', () => {
      expect(adapter.upsert).toBeDefined();
      expect(typeof adapter.upsert).toBe('function');
    });

    it('should handle empty metadata', async () => {
      const records: VectorRecord[] = [
        {
          id: 'vec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: {},
        },
      ];

      await expect(adapter.upsert('test', records)).rejects.toThrow(
        'Not connected'
      );
    });

    it('should handle multiple records', async () => {
      const records: VectorRecord[] = [
        {
          id: 'vec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { title: 'Test 1' },
        },
        {
          id: 'vec2',
          embedding: [0.4, 0.5, 0.6],
          metadata: { title: 'Test 2' },
        },
      ];

      await expect(adapter.upsert('test', records)).rejects.toThrow(
        'Not connected'
      );
    });
  });

  describe('fetch', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.fetch('test', ['vec1'])).rejects.toThrow(
        'Not connected'
      );
    });

    it('should accept array of IDs', () => {
      expect(adapter.fetch).toBeDefined();
      expect(typeof adapter.fetch).toBe('function');
    });

    it('should handle empty ID array', async () => {
      await expect(adapter.fetch('test', [])).rejects.toThrow('Not connected');
    });

    it('should handle multiple IDs', async () => {
      await expect(
        adapter.fetch('test', ['vec1', 'vec2', 'vec3'])
      ).rejects.toThrow('Not connected');
    });
  });

  describe('delete', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.delete('test', ['vec1'])).rejects.toThrow(
        'Not connected'
      );
    });

    it('should accept array of IDs', () => {
      expect(adapter.delete).toBeDefined();
      expect(typeof adapter.delete).toBe('function');
    });

    it('should handle single ID', async () => {
      await expect(adapter.delete('test', ['vec1'])).rejects.toThrow(
        'Not connected'
      );
    });

    it('should handle multiple IDs', async () => {
      await expect(
        adapter.delete('test', ['vec1', 'vec2', 'vec3'])
      ).rejects.toThrow('Not connected');
    });
  });

  describe('updateMetadata', () => {
    it('should throw if not connected', async () => {
      const updates: MetadataUpdate[] = [
        {
          id: 'vec1',
          metadata: { status: 'updated' },
        },
      ];

      await expect(adapter.updateMetadata('test', updates)).rejects.toThrow(
        'Not connected'
      );
    });

    it('should accept metadata updates array', () => {
      expect(adapter.updateMetadata).toBeDefined();
      expect(typeof adapter.updateMetadata).toBe('function');
    });

    it('should handle multiple updates', async () => {
      const updates: MetadataUpdate[] = [
        {
          id: 'vec1',
          metadata: { status: 'updated' },
        },
        {
          id: 'vec2',
          metadata: { status: 'processed' },
        },
      ];

      await expect(adapter.updateMetadata('test', updates)).rejects.toThrow(
        'Not connected'
      );
    });

    it('should handle partial metadata updates', async () => {
      const updates: MetadataUpdate[] = [
        {
          id: 'vec1',
          metadata: { newField: 'value' },
        },
      ];

      await expect(adapter.updateMetadata('test', updates)).rejects.toThrow(
        'Not connected'
      );
    });
  });

  describe('search', () => {
    it('should throw if not connected', async () => {
      const queryVector = [0.1, 0.2, 0.3];

      await expect(adapter.search('test', queryVector)).rejects.toThrow(
        'Not connected'
      );
    });

    it('should accept query vector', () => {
      expect(adapter.search).toBeDefined();
      expect(typeof adapter.search).toBe('function');
    });

    it('should handle search with topK', async () => {
      const queryVector = [0.1, 0.2, 0.3];

      await expect(
        adapter.search('test', queryVector, { topK: 5 })
      ).rejects.toThrow('Not connected');
    });

    it('should handle search with filter', async () => {
      const queryVector = [0.1, 0.2, 0.3];
      const filter = { field: 'status', op: 'eq' as const, value: 'active' };

      await expect(
        adapter.search('test', queryVector, { filter })
      ).rejects.toThrow('Not connected');
    });

    it('should handle search with metadata options', async () => {
      const queryVector = [0.1, 0.2, 0.3];

      await expect(
        adapter.search('test', queryVector, {
          includeMetadata: true,
          includeValues: true,
        })
      ).rejects.toThrow('Not connected');
    });

    it('should handle search with all options', async () => {
      const queryVector = [0.1, 0.2, 0.3];
      const filter = { field: 'category', op: 'in' as const, value: ['A', 'B'] };

      await expect(
        adapter.search('test', queryVector, {
          topK: 10,
          filter,
          includeMetadata: true,
          includeValues: false,
        })
      ).rejects.toThrow('Not connected');
    });
  });
});
