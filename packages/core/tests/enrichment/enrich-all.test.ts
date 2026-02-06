/**
 * Tests for EnrichmentPipeline enrichAll method.
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
import type { ThemeClassifier, ThemeClassification } from '../../src/enrichment/classifiers/theme-classifier';

/**
 * Mock theme classifier for testing.
 */
class MockThemeClassifier implements ThemeClassifier {
  async classify(text: string): Promise<ThemeClassification> {
    return { theme: 'technology', confidence: 0.9 };
  }

  async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
    return Promise.all(texts.map(text => this.classify(text)));
  }
}

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

describe('EnrichmentPipeline - EnrichAll', () => {
  let adapter: MockEnrichmentAdapter;
  let pipeline: EnrichmentPipeline;
  let classifier: MockThemeClassifier;

  beforeEach(() => {
    adapter = new MockEnrichmentAdapter();
    pipeline = new EnrichmentPipeline(adapter);
    classifier = new MockThemeClassifier();
  });

  describe('Sequential Enrichment', () => {
    it('should run vertical, themes, and sections sequentially', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: '# Introduction\n\nTechnology content.',
          metadata: { category: 'tech' },
        },
      ]);

      const stats = await pipeline.enrichAll('test-collection', {
        vertical: {
          mapping: { tech: 'technology' },
        },
        themes: {
          themes: ['technology', 'business'],
          classifier,
        },
        sections: {
          autoDetect: true,
        },
      });

      expect(stats.recordsProcessed).toBeGreaterThan(0);
      expect(stats.recordsUpdated).toBeGreaterThan(0);
      expect(stats.timeMs).toBeGreaterThanOrEqual(0);

      const records = adapter.getRecords();
      expect(records[0].metadata?.vertical).toBe('technology');
      expect(records[0].metadata?.__h_theme).toBe('technology');
      expect(records[0].metadata?.__h_section_title).toBe('Introduction');
    });
  });

  describe('Global Filtering', () => {
    it('should apply global filter to all enrichment steps', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: '# Section 1',
          metadata: { category: 'tech', status: 'pending' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: '# Section 2',
          metadata: { category: 'hc', status: 'processed' },
        },
      ]);

      const stats = await pipeline.enrichAll('test-collection', {
        vertical: {
          mapping: { tech: 'technology', hc: 'healthcare' },
        },
        themes: {
          themes: ['technology', 'healthcare'],
          classifier,
        },
        sections: {
          autoDetect: true,
        },
        filter: { field: 'status', op: 'eq', value: 'pending' },
      });

      const records = adapter.getRecords();
      expect(records[0].metadata?.vertical).toBe('technology');
      expect(records[0].metadata?.__h_theme).toBe('technology');
      expect(records[0].metadata?.__h_section_title).toBe('Section 1');

      // Second record should not be enriched due to global filter
      expect(records[1].metadata?.vertical).toBeUndefined();
      expect(records[1].metadata?.__h_theme).toBeUndefined();
      expect(records[1].metadata?.__h_section_title).toBeUndefined();
    });
  });

  describe('Global Batch Size', () => {
    it('should apply global batch size to all steps', async () => {
      const records = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        values: [0.1],
        text: `# Section ${i + 1}`,
        metadata: { category: 'tech' },
      }));
      adapter.seedRecords(records);

      const stats = await pipeline.enrichAll('test-collection', {
        vertical: {
          mapping: { tech: 'technology' },
        },
        themes: {
          themes: ['technology'],
          classifier,
        },
        sections: {
          autoDetect: true,
        },
        batchSize: 5,
      });

      expect(stats.recordsProcessed).toBeGreaterThan(0);
      expect(stats.recordsUpdated).toBeGreaterThan(0);
    });
  });

  describe('Stats Aggregation', () => {
    it('should aggregate stats from all enrichment steps', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: '# Introduction',
          metadata: { category: 'tech' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: '# Methodology',
          metadata: { category: 'hc' },
        },
      ]);

      const stats = await pipeline.enrichAll('test-collection', {
        vertical: {
          mapping: { tech: 'technology', hc: 'healthcare' },
        },
        themes: {
          themes: ['technology', 'healthcare'],
          classifier,
        },
        sections: {
          autoDetect: true,
        },
      });

      // Stats should reflect all three operations
      expect(stats.recordsProcessed).toBeGreaterThan(0);
      expect(stats.recordsUpdated).toBeGreaterThan(0);
      expect(stats.timeMs).toBeGreaterThanOrEqual(0);
      expect(stats.errors).toBeDefined();
    });
  });

  describe('Partial Configuration', () => {
    it('should support running only some enrichment types', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: 'Content text',
          metadata: { category: 'tech' },
        },
      ]);

      const stats = await pipeline.enrichAll('test-collection', {
        vertical: {
          mapping: { tech: 'technology' },
        },
        // No themes or sections
      });

      expect(stats.recordsProcessed).toBeGreaterThan(0);
      expect(stats.recordsUpdated).toBeGreaterThan(0);

      const records = adapter.getRecords();
      expect(records[0].metadata?.vertical).toBe('technology');
      expect(records[0].metadata?.__h_theme).toBeUndefined();
      expect(records[0].metadata?.__h_section_title).toBeUndefined();
    });
  });
});
