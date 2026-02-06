/**
 * Tests for EnrichmentPipeline with vertical enrichment strategies.
 *
 * Following TDD:
 * 1. Write tests first (they will fail)
 * 2. Implement minimal code to pass
 * 3. Verify all tests pass
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnrichmentPipeline } from '../../src/enrichment/enrichment-pipeline';
import type { VectorDBAdapter } from '../../src/adapters';
import type { VectorRecord } from '../../src/types';
import type { MetadataUpdate } from '../../src/adapters/types';
import type { UniversalFilter } from '../../src/filters';
import { MockLLM } from '../../src/llm/mock-llm';

/**
 * Mock adapter for testing enrichment pipeline.
 * Simulates a vector database with in-memory storage.
 */
class MockEnrichmentAdapter implements VectorDBAdapter {
  private records: Map<string, VectorRecord> = new Map();

  // Helper to seed test data
  seedRecords(records: VectorRecord[]): void {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  // Helper to get current records
  getRecords(): VectorRecord[] {
    return Array.from(this.records.values());
  }

  async *iterate(
    collection: string,
    options?: { batchSize?: number; filter?: UniversalFilter }
  ): AsyncIterableIterator<VectorRecord[]> {
    const batchSize = options?.batchSize || 100;
    const filter = options?.filter;

    let allRecords = Array.from(this.records.values());

    // Simple filter implementation for testing
    if (filter) {
      allRecords = allRecords.filter((record) => {
        if (filter.op === 'exists') {
          return filter.value
            ? record.metadata?.[filter.field] !== undefined
            : record.metadata?.[filter.field] === undefined;
        }
        if (filter.op === 'eq') {
          return record.metadata?.[filter.field] === filter.value;
        }
        return true;
      });
    }

    // Yield records in batches
    for (let i = 0; i < allRecords.length; i += batchSize) {
      yield allRecords.slice(i, i + batchSize);
    }
  }

  async updateMetadata(
    collection: string,
    updates: MetadataUpdate[]
  ): Promise<void> {
    for (const update of updates) {
      const record = this.records.get(update.id);
      if (record) {
        record.metadata = {
          ...record.metadata,
          ...update.metadata,
        };
      }
    }
  }

  // Stub methods (not used in these tests)
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isConnected(): Promise<boolean> { return true; }
  async createCollection(): Promise<void> {}
  async deleteCollection(): Promise<void> {}
  async collectionExists(): Promise<boolean> { return true; }
  async getCollectionStats(): Promise<any> { return {}; }
  async upsert(): Promise<void> {}
  async fetch(): Promise<VectorRecord[]> { return []; }
  async delete(): Promise<void> {}
  async search(): Promise<any> { return { matches: [] }; }
  translateFilter(filter: UniversalFilter): any { return filter; }
  supportsMetadataUpdate(): boolean { return true; }
  supportsFiltering(): boolean { return true; }
  supportsBatchOperations(): boolean { return true; }
}

describe('EnrichmentPipeline - Vertical Enrichment', () => {
  let adapter: MockEnrichmentAdapter;
  let pipeline: EnrichmentPipeline;

  beforeEach(() => {
    adapter = new MockEnrichmentAdapter();
    pipeline = new EnrichmentPipeline(adapter);
  });

  describe('Field Mapping Strategy', () => {
    it('should enrich records using field mapping', async () => {
      // Seed test data
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { category: 'tech', content: 'Programming article' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          metadata: { category: 'hc', content: 'Healthcare article' },
        },
        {
          id: '3',
          values: [0.5, 0.6],
          metadata: { category: 'fin', content: 'Finance article' },
        },
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        mapping: {
          tech: 'technology',
          hc: 'healthcare',
          fin: 'finance',
        },
      });

      // Verify stats
      expect(stats.recordsProcessed).toBe(3);
      expect(stats.recordsUpdated).toBe(3);
      expect(stats.recordsSkipped).toBe(0);
      expect(stats.timeMs).toBeGreaterThanOrEqual(0);

      // Verify metadata was updated
      const records = adapter.getRecords();
      expect(records[0].metadata?.vertical).toBe('technology');
      expect(records[1].metadata?.vertical).toBe('healthcare');
      expect(records[2].metadata?.vertical).toBe('finance');
    });

    it('should skip records with no matching category', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { category: 'tech', content: 'Tech article' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          metadata: { category: 'unknown', content: 'Unknown article' },
        },
        {
          id: '3',
          values: [0.5, 0.6],
          metadata: { content: 'No category' },
        },
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        mapping: {
          tech: 'technology',
        },
      });

      expect(stats.recordsProcessed).toBe(3);
      expect(stats.recordsUpdated).toBe(1);
      expect(stats.recordsSkipped).toBe(2);

      const records = adapter.getRecords();
      expect(records[0].metadata?.vertical).toBe('technology');
      expect(records[1].metadata?.vertical).toBeUndefined();
      expect(records[2].metadata?.vertical).toBeUndefined();
    });
  });

  describe('Extractor Strategy', () => {
    it('should enrich records using custom extractor function', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { content: 'Article about machine learning and AI' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          metadata: { content: 'Stock market analysis and trading' },
        },
        {
          id: '3',
          values: [0.5, 0.6],
          metadata: { content: 'General news article' },
        },
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        extractor: async (doc: any) => {
          const content = doc.metadata?.content?.toLowerCase() || '';
          if (content.includes('machine learning') || content.includes('ai')) {
            return 'technology';
          }
          if (content.includes('stock') || content.includes('trading')) {
            return 'finance';
          }
          return 'general';
        },
      });

      expect(stats.recordsProcessed).toBe(3);
      expect(stats.recordsUpdated).toBe(3);
      expect(stats.recordsSkipped).toBe(0);

      const records = adapter.getRecords();
      expect(records[0].metadata?.vertical).toBe('technology');
      expect(records[1].metadata?.vertical).toBe('finance');
      expect(records[2].metadata?.vertical).toBe('general');
    });

    it('should handle extractor errors gracefully', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { content: 'Valid content' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          metadata: { content: 'Another valid content' },
        },
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        extractor: async (doc: any) => {
          if (doc.id === '1') {
            throw new Error('Extractor error for doc 1');
          }
          return 'technology';
        },
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(1);
      expect(stats.recordsSkipped).toBe(1);
      expect(stats.errors).toBeDefined();
      expect(stats.errors?.length).toBe(1);
      expect(stats.errors?.[0]).toContain('Extractor error for doc 1');
    });
  });

  describe('Automatic LLM Strategy', () => {
    it('should enrich records using LLM classification', async () => {
      const llm = new MockLLM();
      llm.setResponse('technology');

      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { content: 'Article about programming' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          metadata: { content: 'Article about healthcare' },
        },
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        automatic: {
          llm,
          fields: ['technology', 'finance', 'healthcare'],
        },
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(2);
      expect(stats.recordsSkipped).toBe(0);

      const records = adapter.getRecords();
      expect(records[0].metadata?.vertical).toBe('technology');
      expect(records[1].metadata?.vertical).toBe('technology');
    });

    it('should use custom prompt template for LLM', async () => {
      const llm = new MockLLM();
      llm.setResponse('finance');

      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { description: 'Stock market trends' },
        },
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        automatic: {
          llm,
          fields: ['technology', 'finance', 'healthcare'],
          promptTemplate: 'Classify: {text}\nCategories: {fields}',
          textField: 'description',
        },
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(1);

      const records = adapter.getRecords();
      expect(records[0].metadata?.vertical).toBe('finance');
    });

    it('should handle LLM errors gracefully', async () => {
      const llm = new MockLLM();
      // Don't set a response to trigger an error

      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { content: 'Test content' },
        },
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        automatic: {
          llm,
          fields: ['technology', 'finance'],
        },
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(0);
      expect(stats.recordsSkipped).toBe(1);
      expect(stats.errors).toBeDefined();
    });
  });

  describe('Filtered Enrichment', () => {
    it('should only enrich records matching filter', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { category: 'tech', status: 'pending' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          metadata: { category: 'hc', status: 'processed' },
        },
        {
          id: '3',
          values: [0.5, 0.6],
          metadata: { category: 'fin', status: 'pending' },
        },
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        mapping: {
          tech: 'technology',
          hc: 'healthcare',
          fin: 'finance',
        },
        filter: { field: 'status', op: 'eq', value: 'pending' },
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(2);
      expect(stats.recordsSkipped).toBe(0);

      const records = adapter.getRecords();
      expect(records[0].metadata?.vertical).toBe('technology');
      expect(records[1].metadata?.vertical).toBeUndefined(); // Not processed due to filter
      expect(records[2].metadata?.vertical).toBe('finance');
    });
  });

  describe('Error Handling', () => {
    it('should handle batch processing errors', async () => {
      // Create a custom adapter that throws on updateMetadata
      class ErrorAdapter extends MockEnrichmentAdapter {
        async updateMetadata(): Promise<void> {
          throw new Error('Database error');
        }
      }

      const errorAdapter = new ErrorAdapter();
      errorAdapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { category: 'tech' },
        },
      ]);

      const errorPipeline = new EnrichmentPipeline(errorAdapter);

      const stats = await errorPipeline.enrichVertical('test-collection', {
        mapping: { tech: 'technology' },
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(0);
      expect(stats.errors).toBeDefined();
      expect(stats.errors?.length).toBeGreaterThan(0);
    });

    it('should continue processing after individual record errors', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { category: 'tech' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          metadata: { content: 'No category field' },
        },
        {
          id: '3',
          values: [0.5, 0.6],
          metadata: { category: 'fin' },
        },
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        mapping: {
          tech: 'technology',
          fin: 'finance',
        },
      });

      expect(stats.recordsProcessed).toBe(3);
      expect(stats.recordsUpdated).toBe(2);
      expect(stats.recordsSkipped).toBe(1);
    });
  });

  describe('Stub Methods', () => {
    it('should throw "Not implemented yet" for enrichThemes', async () => {
      await expect(
        pipeline.enrichThemes('test-collection', {
          themes: ['technology'],
          classifier: {} as any,
        })
      ).rejects.toThrow('Not implemented yet');
    });

    it('should throw "Not implemented yet" for enrichSections', async () => {
      await expect(
        pipeline.enrichSections('test-collection', {})
      ).rejects.toThrow('Not implemented yet');
    });

    it('should throw "Not implemented yet" for enrichAll', async () => {
      await expect(
        pipeline.enrichAll('test-collection', {})
      ).rejects.toThrow('Not implemented yet');
    });
  });
});
