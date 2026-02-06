/**
 * Tests for EnrichmentPipeline with theme enrichment.
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
import type { EnrichmentStats } from '../../src/enrichment/types';

/**
 * Mock theme classifier for testing.
 */
class MockThemeClassifier implements ThemeClassifier {
  private classifications: Map<string, ThemeClassification> = new Map();

  setClassification(text: string, result: ThemeClassification): void {
    this.classifications.set(text, result);
  }

  async classify(text: string): Promise<ThemeClassification> {
    const result = this.classifications.get(text);
    if (!result) {
      return { theme: 'unknown', confidence: 0.3 };
    }
    return result;
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

describe('EnrichmentPipeline - Theme Enrichment', () => {
  let adapter: MockEnrichmentAdapter;
  let pipeline: EnrichmentPipeline;
  let classifier: MockThemeClassifier;

  beforeEach(() => {
    adapter = new MockEnrichmentAdapter();
    pipeline = new EnrichmentPipeline(adapter);
    classifier = new MockThemeClassifier();
  });

  describe('Basic Classification', () => {
    it('should enrich records with theme classifications', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: 'Machine learning is transforming technology',
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: 'Healthcare innovations are saving lives',
        },
      ]);

      classifier.setClassification('Machine learning is transforming technology', {
        theme: 'technology',
        confidence: 0.92,
      });
      classifier.setClassification('Healthcare innovations are saving lives', {
        theme: 'healthcare',
        confidence: 0.88,
      });

      const stats = await pipeline.enrichThemes('test-collection', {
        themes: ['technology', 'healthcare', 'finance'],
        classifier,
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(2);
      expect(stats.recordsSkipped).toBe(0);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_theme).toBe('technology');
      expect(records[0].metadata?.__h_theme_confidence).toBe(0.92);
      expect(records[1].metadata?.__h_theme).toBe('healthcare');
      expect(records[1].metadata?.__h_theme_confidence).toBe(0.88);
    });
  });

  describe('Custom Text Field', () => {
    it('should extract text from custom metadata field', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          metadata: { description: 'AI and machine learning research' },
        },
      ]);

      classifier.setClassification('AI and machine learning research', {
        theme: 'technology',
        confidence: 0.85,
      });

      const stats = await pipeline.enrichThemes('test-collection', {
        themes: ['technology', 'healthcare'],
        classifier,
        textField: 'description',
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(1);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_theme).toBe('technology');
    });
  });

  describe('Confidence Threshold', () => {
    it('should skip records below confidence threshold', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: 'High confidence text',
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: 'Low confidence text',
        },
      ]);

      classifier.setClassification('High confidence text', {
        theme: 'technology',
        confidence: 0.85,
      });
      classifier.setClassification('Low confidence text', {
        theme: 'finance',
        confidence: 0.3,
      });

      const stats = await pipeline.enrichThemes('test-collection', {
        themes: ['technology', 'finance'],
        classifier,
        confidenceThreshold: 0.5,
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(1);
      expect(stats.recordsSkipped).toBe(1);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_theme).toBe('technology');
      expect(records[1].metadata?.__h_theme).toBeUndefined();
    });
  });

  describe('Multi-Theme Mode', () => {
    it('should assign multiple themes when multiTheme is true', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: 'Healthcare technology innovations',
        },
      ]);

      classifier.setClassification('Healthcare technology innovations', {
        theme: 'technology',
        confidence: 0.85,
        allScores: {
          technology: 0.85,
          healthcare: 0.78,
          finance: 0.12,
        },
      });

      const stats = await pipeline.enrichThemes('test-collection', {
        themes: ['technology', 'healthcare', 'finance'],
        classifier,
        multiTheme: true,
        confidenceThreshold: 0.5,
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(1);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_theme).toBe('technology');
      expect(records[0].metadata?.__h_theme_confidence).toBe(0.85);
      expect(records[0].metadata?.__h_themes).toEqual(['technology', 'healthcare']);
    });
  });

  describe('Filtering', () => {
    it('should only enrich records matching filter', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: 'Technology article',
          metadata: { status: 'pending' },
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: 'Healthcare article',
          metadata: { status: 'processed' },
        },
      ]);

      classifier.setClassification('Technology article', {
        theme: 'technology',
        confidence: 0.9,
      });

      const stats = await pipeline.enrichThemes('test-collection', {
        themes: ['technology', 'healthcare'],
        classifier,
        filter: { field: 'status', op: 'eq', value: 'pending' },
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(1);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_theme).toBe('technology');
      expect(records[1].metadata?.__h_theme).toBeUndefined();
    });
  });

  describe('Progress Callback', () => {
    it('should call progress callback after each batch', async () => {
      adapter.seedRecords([
        { id: '1', values: [0.1], text: 'Text 1' },
        { id: '2', values: [0.2], text: 'Text 2' },
        { id: '3', values: [0.3], text: 'Text 3' },
      ]);

      classifier.setClassification('Text 1', { theme: 'tech', confidence: 0.9 });
      classifier.setClassification('Text 2', { theme: 'tech', confidence: 0.9 });
      classifier.setClassification('Text 3', { theme: 'tech', confidence: 0.9 });

      const progressUpdates: EnrichmentStats[] = [];

      const stats = await pipeline.enrichThemes('test-collection', {
        themes: ['tech'],
        classifier,
        batchSize: 2,
        onProgress: (stats) => {
          progressUpdates.push({ ...stats });
        },
      });

      expect(progressUpdates.length).toBe(2);
      expect(progressUpdates[0].recordsProcessed).toBe(2);
      expect(progressUpdates[1].recordsProcessed).toBe(3);
      expect(stats.recordsProcessed).toBe(3);
      expect(stats.recordsUpdated).toBe(3);
    });
  });

  describe('Batch Processing', () => {
    it('should process records in batches', async () => {
      const records = Array.from({ length: 250 }, (_, i) => ({
        id: `${i + 1}`,
        values: [0.1],
        text: `Text ${i + 1}`,
      }));
      adapter.seedRecords(records);

      for (let i = 1; i <= 250; i++) {
        classifier.setClassification(`Text ${i}`, {
          theme: 'technology',
          confidence: 0.8,
        });
      }

      const stats = await pipeline.enrichThemes('test-collection', {
        themes: ['technology'],
        classifier,
        batchSize: 100,
      });

      expect(stats.recordsProcessed).toBe(250);
      expect(stats.recordsUpdated).toBe(250);
    });
  });

  describe('Error Handling', () => {
    it('should handle classification errors gracefully', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: 'Valid text',
        },
        {
          id: '2',
          values: [0.3, 0.4],
          text: 'Error text',
        },
      ]);

      const errorClassifier: ThemeClassifier = {
        async classify(text: string): Promise<ThemeClassification> {
          if (text === 'Error text') {
            throw new Error('Classification failed');
          }
          return { theme: 'technology', confidence: 0.9 };
        },
        async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
          return Promise.all(texts.map(text => this.classify(text)));
        },
      };

      const stats = await pipeline.enrichThemes('test-collection', {
        themes: ['technology'],
        classifier: errorClassifier,
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(1);
      expect(stats.recordsSkipped).toBe(1);
      expect(stats.errors).toBeDefined();
      expect(stats.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('Empty Text Handling', () => {
    it('should skip records with empty text', async () => {
      adapter.seedRecords([
        {
          id: '1',
          values: [0.1, 0.2],
          text: '',
        },
        {
          id: '2',
          values: [0.3, 0.4],
          metadata: {},
        },
        {
          id: '3',
          values: [0.5, 0.6],
          text: 'Valid text',
        },
      ]);

      classifier.setClassification('Valid text', {
        theme: 'technology',
        confidence: 0.9,
      });

      const stats = await pipeline.enrichThemes('test-collection', {
        themes: ['technology'],
        classifier,
      });

      expect(stats.recordsProcessed).toBe(3);
      expect(stats.recordsUpdated).toBe(1);
      expect(stats.recordsSkipped).toBe(2);

      const records = adapter.getRecords();
      expect(records[0].metadata?.__h_theme).toBeUndefined();
      expect(records[1].metadata?.__h_theme).toBeUndefined();
      expect(records[2].metadata?.__h_theme).toBe('technology');
    });
  });
});
