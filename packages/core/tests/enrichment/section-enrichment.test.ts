/**
 * Tests for EnrichmentPipeline with section enrichment.
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

describe('EnrichmentPipeline - Section Enrichment', () => {
  let adapter: MockEnrichmentAdapter;
  let pipeline: EnrichmentPipeline;

  beforeEach(() => {
    adapter = new MockEnrichmentAdapter();
    pipeline = new EnrichmentPipeline(adapter);
  });

  describe('Field Mapping Strategy', () => {
    it('should extract section metadata from existing field', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: 'Content text',
          metadata: {
            section_path: 'introduction/overview',
          },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: 'Content text',
          metadata: {
            section_path: 'methodology/approach',
          },
        },
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        existingField: 'section_path',
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(2);
      expect(stats.recordsSkipped).toBe(0);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_section_path).toBe('introduction/overview');
      expect(records[0].metadata?.__h_section_level).toBe(2);
      expect(records[0].metadata?.__h_section_title).toBe('overview');

      expect(records[1].metadata?.__h_section_path).toBe('methodology/approach');
      expect(records[1].metadata?.__h_section_level).toBe(2);
      expect(records[1].metadata?.__h_section_title).toBe('approach');
    });
  });

  describe('Markdown Section Detection', () => {
    it('should detect markdown headers as sections', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: '# Introduction\n\nThis is the introduction section.',
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: '## Methodology\n\nDetailed methodology here.',
        },
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        autoDetect: true,
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(2);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_section_title).toBe('Introduction');
      expect(records[0].metadata?.__h_section_level).toBe(1);

      expect(records[1].metadata?.__h_section_title).toBe('Methodology');
      expect(records[1].metadata?.__h_section_level).toBe(2);
    });
  });

  describe('HTML Section Detection', () => {
    it('should detect HTML headers as sections', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: '<h1>Results</h1><p>Results content here.</p>',
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: '<h2>Discussion</h2><p>Discussion text here.</p>',
        },
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        autoDetect: true,
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(2);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_section_title).toBe('Results');
      expect(records[0].metadata?.__h_section_level).toBe(1);

      expect(records[1].metadata?.__h_section_title).toBe('Discussion');
      expect(records[1].metadata?.__h_section_level).toBe(2);
    });
  });

  describe('Pattern-Based Section Detection', () => {
    it('should detect sections using custom patterns', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: 'SECTION: Introduction\n\nContent here.',
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: 'SECTION: Conclusion\n\nFinal thoughts.',
        },
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        autoDetect: true,
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(2);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_section_title).toBe('Introduction');
      expect(records[1].metadata?.__h_section_title).toBe('Conclusion');
    });
  });

  describe('Fallback to Unsectioned', () => {
    it('should mark records without sections as unsectioned', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: 'Plain text without any section markers.',
        },
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        autoDetect: true,
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(1);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_section_title).toBe('unsectioned');
      expect(records[0].metadata?.__h_section_level).toBe(0);
    });
  });

  describe('Filtering', () => {
    it('should only enrich records matching filter', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: '# Section 1',
          metadata: { status: 'pending' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: '# Section 2',
          metadata: { status: 'processed' },
        },
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        autoDetect: true,
        filter: { field: 'status', op: 'eq', value: 'pending' },
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(1);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_section_title).toBe('Section 1');
      expect(records[1].metadata?.__h_section_title).toBeUndefined();
    });
  });
});
