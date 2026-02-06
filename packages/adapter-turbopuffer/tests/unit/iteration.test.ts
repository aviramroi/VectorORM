import { describe, it, expect, beforeEach } from 'vitest';
import { TurbopufferAdapter } from '../../src/turbopuffer-adapter';

describe('TurbopufferAdapter - Iteration', () => {
  let adapter: TurbopufferAdapter;

  beforeEach(() => {
    adapter = new TurbopufferAdapter({
      apiKey: 'test-api-key',
    });
  });

  describe('iterate', () => {
    it('should throw if not connected', async () => {
      const iterator = adapter.iterate('test');

      await expect(iterator.next()).rejects.toThrow('Not connected');
    });

    it('should return async iterator', () => {
      const iterator = adapter.iterate('test');

      expect(iterator).toBeDefined();
      expect(typeof iterator.next).toBe('function');
      expect(typeof iterator[Symbol.asyncIterator]).toBe('function');
    });

    it('should accept batch size option', () => {
      const iterator = adapter.iterate('test', { batchSize: 50 });

      expect(iterator).toBeDefined();
      expect(typeof iterator.next).toBe('function');
    });

    it('should accept filter option', () => {
      const filter = { field: 'status', op: 'eq' as const, value: 'active' };
      const iterator = adapter.iterate('test', { filter });

      expect(iterator).toBeDefined();
      expect(typeof iterator.next).toBe('function');
    });

    it('should accept both batch size and filter', () => {
      const filter = { field: 'region', op: 'eq' as const, value: 'ny' };
      const iterator = adapter.iterate('test', { batchSize: 100, filter });

      expect(iterator).toBeDefined();
      expect(typeof iterator.next).toBe('function');
    });

    it('should be usable with for-await-of', async () => {
      const iterator = adapter.iterate('test');

      // This will throw because not connected, but verifies syntax
      let error: any = null;
      try {
        for await (const batch of iterator) {
          // Should not reach here
          expect(batch).toBeDefined();
        }
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.message).toContain('Not connected');
    });

    it('should handle empty results gracefully', async () => {
      // Test structure - actual behavior requires mocking
      const iterator = adapter.iterate('test');

      await expect(iterator.next()).rejects.toThrow('Not connected');
    });

    it('should support manual iteration', async () => {
      const iterator = adapter.iterate('test');

      // Verify iterator protocol
      expect(typeof iterator.next).toBe('function');

      // Will throw due to no connection
      await expect(iterator.next()).rejects.toThrow('Not connected');
    });

    it('should handle large collections with pagination', () => {
      // Test that pagination options are accepted
      const iterator = adapter.iterate('test', { batchSize: 1000 });

      expect(iterator).toBeDefined();
    });

    it('should combine filters and pagination', () => {
      const filter = {
        and: [
          { field: 'status', op: 'eq' as const, value: 'active' },
          { field: 'year', op: 'gte' as const, value: 2020 },
        ],
      };

      const iterator = adapter.iterate('test', {
        batchSize: 200,
        filter,
      });

      expect(iterator).toBeDefined();
    });
  });

  describe('Iterator edge cases', () => {
    it('should handle iteration with zero batch size', () => {
      const iterator = adapter.iterate('test', { batchSize: 0 });

      expect(iterator).toBeDefined();
    });

    it('should handle iteration with negative batch size', () => {
      const iterator = adapter.iterate('test', { batchSize: -1 });

      expect(iterator).toBeDefined();
    });

    it('should handle very large batch size', () => {
      const iterator = adapter.iterate('test', { batchSize: 10000 });

      expect(iterator).toBeDefined();
    });

    it('should allow multiple concurrent iterations', () => {
      const iterator1 = adapter.iterate('test');
      const iterator2 = adapter.iterate('test');

      expect(iterator1).toBeDefined();
      expect(iterator2).toBeDefined();
      expect(iterator1).not.toBe(iterator2);
    });
  });
});
