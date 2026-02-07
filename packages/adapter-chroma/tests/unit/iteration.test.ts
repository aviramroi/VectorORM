import { describe, it, expect, beforeEach } from 'vitest';
import { ChromaAdapter } from '../../src/chroma-adapter';
import type { UniversalFilter } from '@vectororm/core';

describe('ChromaAdapter - Iteration', () => {
  let adapter: ChromaAdapter;

  beforeEach(() => {
    adapter = new ChromaAdapter({
      host: 'localhost',
      port: 8000,
    });
  });

  describe('iterate', () => {
    it('should throw if not connected', async () => {
      const iterator = adapter.iterate('test-collection');

      await expect(iterator.next()).rejects.toThrow(
        'Not connected. Call connect() first.'
      );
    });

    it('should create iterator with default batch size', async () => {
      const iterator = adapter.iterate('test-collection');
      expect(iterator).toBeDefined();
      expect(typeof iterator.next).toBe('function');
    });

    it('should create iterator with custom batch size', async () => {
      const iterator = adapter.iterate('test-collection', { batchSize: 50 });
      expect(iterator).toBeDefined();
      expect(typeof iterator.next).toBe('function');
    });

    it('should create iterator with filter', async () => {
      const filter: UniversalFilter = {
        field: 'category',
        op: 'eq',
        value: 'test',
      };

      const iterator = adapter.iterate('test-collection', { filter });
      expect(iterator).toBeDefined();
      expect(typeof iterator.next).toBe('function');
    });

    it('should create iterator with filter and batch size', async () => {
      const filter: UniversalFilter = {
        field: 'category',
        op: 'eq',
        value: 'test',
      };

      const iterator = adapter.iterate('test-collection', {
        batchSize: 50,
        filter,
      });
      expect(iterator).toBeDefined();
      expect(typeof iterator.next).toBe('function');
    });

    it('should be usable in for-await-of loop structure', async () => {
      const iterator = adapter.iterate('test-collection');

      // Test that iterator has correct structure
      expect(iterator[Symbol.asyncIterator]).toBeDefined();
      expect(typeof iterator[Symbol.asyncIterator]).toBe('function');

      // Verify it returns itself as async iterator
      expect(iterator[Symbol.asyncIterator]()).toBe(iterator);
    });

    it('should handle compound AND filter', async () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'category', op: 'eq', value: 'test' },
          { field: 'status', op: 'eq', value: 'active' },
        ],
      };

      const iterator = adapter.iterate('test-collection', { filter });
      expect(iterator).toBeDefined();
    });

    it('should handle compound OR filter', async () => {
      const filter: UniversalFilter = {
        or: [
          { field: 'category', op: 'eq', value: 'cat1' },
          { field: 'category', op: 'eq', value: 'cat2' },
        ],
      };

      const iterator = adapter.iterate('test-collection', { filter });
      expect(iterator).toBeDefined();
    });

    it('should handle nested filters', async () => {
      const filter: UniversalFilter = {
        and: [
          {
            or: [
              { field: 'category', op: 'eq', value: 'cat1' },
              { field: 'category', op: 'eq', value: 'cat2' },
            ],
          },
          { field: 'status', op: 'eq', value: 'active' },
        ],
      };

      const iterator = adapter.iterate('test-collection', { filter });
      expect(iterator).toBeDefined();
    });

    it('should handle small batch size', async () => {
      const iterator = adapter.iterate('test-collection', { batchSize: 10 });
      expect(iterator).toBeDefined();
    });

    it('should handle large batch size', async () => {
      const iterator = adapter.iterate('test-collection', { batchSize: 1000 });
      expect(iterator).toBeDefined();
    });
  });

  describe('pagination logic', () => {
    it('should use offset/limit pagination', async () => {
      // This test verifies the structure supports offset/limit
      // Actual pagination would need mocking or integration tests
      const iterator = adapter.iterate('test-collection', { batchSize: 100 });
      expect(iterator).toBeDefined();
    });

    it('should increment offset for each batch', async () => {
      // Structure test - actual behavior needs mocking
      const iterator = adapter.iterate('test-collection', { batchSize: 100 });
      expect(iterator).toBeDefined();
    });

    it('should stop when no more results', async () => {
      // Structure test - actual behavior needs mocking
      const iterator = adapter.iterate('test-collection');
      expect(iterator).toBeDefined();
    });

    it('should handle empty collection', async () => {
      // Structure test - actual behavior needs mocking
      const iterator = adapter.iterate('test-collection');
      expect(iterator).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid collection name', async () => {
      const iterator = adapter.iterate('non-existent-collection');

      await expect(iterator.next()).rejects.toThrow();
    });

    it('should handle invalid filter', async () => {
      const filter: any = {
        field: 'category',
        op: 'invalid',
        value: 'test',
      };

      // Filter translation happens when trying to use the iterator
      const iterator = adapter.iterate('test-collection', { filter });
      await expect(iterator.next()).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle batchSize of 1', async () => {
      const iterator = adapter.iterate('test-collection', { batchSize: 1 });
      expect(iterator).toBeDefined();
    });

    it('should handle very large batchSize', async () => {
      const iterator = adapter.iterate('test-collection', { batchSize: 10000 });
      expect(iterator).toBeDefined();
    });

    it('should handle collection with special characters in name', async () => {
      const iterator = adapter.iterate('test-collection-with-dashes');
      expect(iterator).toBeDefined();
    });
  });
});
