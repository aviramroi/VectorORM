/**
 * Integration Tests - End-to-end enrichment workflows.
 *
 * Tests comprehensive enrichment scenarios combining multiple strategies,
 * classifiers, and performance validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnrichmentPipeline } from '../../src/enrichment/enrichment-pipeline';
import type { VectorDBAdapter } from '../../src/adapters';
import type { VectorRecord } from '../../src/types';
import type { MetadataUpdate } from '../../src/adapters/types';
import type { UniversalFilter } from '../../src/filters';
import type { ThemeClassifier, ThemeClassification } from '../../src/enrichment/classifiers/theme-classifier';
import { Embedder } from '../../src/embedders/embedder';
import { MockLLM } from '../../src/llm/mock-llm';

/**
 * MockEmbedder with distinguishable patterns for integration testing.
 * Creates embeddings where different text patterns produce meaningfully different vectors.
 */
class MockEmbedder extends Embedder {
  constructor(
    private readonly _dimensions: number = 384,
    private readonly _modelName: string = 'mock-embedder-integration-v1'
  ) {
    super();
  }

  get dimensions(): number {
    return this._dimensions;
  }

  get modelName(): string {
    return this._modelName;
  }

  async embed(text: string): Promise<number[]> {
    // Create distinguishable embeddings based on content keywords
    const lower = text.toLowerCase();
    const embedding = new Array(this._dimensions);

    // Base pattern from text length
    const seed = text.length;

    for (let i = 0; i < this._dimensions; i++) {
      let value = Math.sin(seed + i) * 0.5 + 0.5;

      // Adjust embedding based on content to make patterns distinguishable
      if (lower.includes('technology') || lower.includes('tech') || lower.includes('ai') || lower.includes('machine')) {
        value += 0.3 * Math.cos(i * 0.1);
      } else if (lower.includes('healthcare') || lower.includes('health') || lower.includes('medical')) {
        value += 0.3 * Math.sin(i * 0.1);
      } else if (lower.includes('finance') || lower.includes('stock') || lower.includes('market')) {
        value += 0.3 * Math.sin(i * 0.2);
      }

      // Normalize to [0, 1]
      embedding[i] = Math.max(0, Math.min(1, value));
    }

    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

/**
 * Mock theme classifier for integration testing.
 */
class MockThemeClassifier implements ThemeClassifier {
  private classifications: Map<string, ThemeClassification> = new Map();

  setClassification(text: string, result: ThemeClassification): void {
    this.classifications.set(text, result);
  }

  async classify(text: string): Promise<ThemeClassification> {
    const result = this.classifications.get(text);
    if (!result) {
      // Default classification based on text content
      const lower = text.toLowerCase();
      if (lower.includes('tech') || lower.includes('ai') || lower.includes('machine')) {
        return { theme: 'technology', confidence: 0.85 };
      } else if (lower.includes('health') || lower.includes('medical')) {
        return { theme: 'healthcare', confidence: 0.85 };
      } else if (lower.includes('finance') || lower.includes('stock')) {
        return { theme: 'finance', confidence: 0.85 };
      }
      return { theme: 'unknown', confidence: 0.3 };
    }
    return result;
  }

  async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
    return Promise.all(texts.map(text => this.classify(text)));
  }
}

/**
 * Mock adapter for integration testing with real upsert/fetch simulation.
 */
class MockIntegrationAdapter implements VectorDBAdapter {
  private records: Map<string, VectorRecord> = new Map();

  seedRecords(records: VectorRecord[]): void {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

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

    // Apply filter if provided
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
        if (filter.op === 'gt') {
          return (record.metadata?.[filter.field] as number) > filter.value;
        }
        if (filter.op === 'lt') {
          return (record.metadata?.[filter.field] as number) < filter.value;
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

  async upsert(
    collection: string,
    records: VectorRecord[]
  ): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  async fetch(
    collection: string,
    ids: string[]
  ): Promise<VectorRecord[]> {
    return ids
      .map(id => this.records.get(id))
      .filter((record): record is VectorRecord => record !== undefined);
  }

  // Stub methods
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isConnected(): Promise<boolean> { return true; }
  async createCollection(): Promise<void> {}
  async deleteCollection(): Promise<void> {}
  async collectionExists(): Promise<boolean> { return true; }
  async getCollectionStats(): Promise<any> { return {}; }
  async delete(): Promise<void> {}
  async search(): Promise<any> { return { matches: [] }; }
  translateFilter(filter: UniversalFilter): any { return filter; }
  supportsMetadataUpdate(): boolean { return true; }
  supportsFiltering(): boolean { return true; }
  supportsBatchOperations(): boolean { return true; }
}

describe('Enrichment Integration Tests', () => {
  let adapter: MockIntegrationAdapter;
  let pipeline: EnrichmentPipeline;
  let classifier: MockThemeClassifier;

  beforeEach(() => {
    adapter = new MockIntegrationAdapter();
    pipeline = new EnrichmentPipeline(adapter);
    classifier = new MockThemeClassifier();
  });

  it('should complete end-to-end workflow: vertical (extractor) + themes (keyword) + sections (existing field)', async () => {
    // Seed test data with realistic content
    adapter.seedRecords([
      {
        id: '1',
        values: [0.1, 0.2, 0.3],
        text: '# Introduction\n\nThis article discusses machine learning and AI technologies.',
        metadata: {
          category: 'tech',
          section_path: 'introduction/overview',
        },
      },
      {
        id: '2',
        values: [0.4, 0.5, 0.6],
        text: '## Methodology\n\nHealthcare data analysis using statistical methods.',
        metadata: {
          category: 'hc',
          section_path: 'methodology/data-analysis',
        },
      },
      {
        id: '3',
        values: [0.7, 0.8, 0.9],
        text: '### Results\n\nStock market performance showed significant growth.',
        metadata: {
          category: 'fin',
          section_path: 'results/performance',
        },
      },
    ]);

    // Run complete enrichment workflow
    const stats = await pipeline.enrichAll('test-collection', {
      vertical: {
        extractor: async (doc: any) => {
          const category = doc.metadata?.category;
          const mapping: Record<string, string> = {
            tech: 'technology',
            hc: 'healthcare',
            fin: 'finance',
          };
          return mapping[category] || 'general';
        },
      },
      themes: {
        themes: ['technology', 'healthcare', 'finance'],
        classifier,
      },
      sections: {
        existingField: 'section_path',
      },
    });

    // Verify stats - each record is processed 3 times (vertical + themes + sections)
    expect(stats.recordsProcessed).toBe(9); // 3 records × 3 enrichment types
    expect(stats.recordsUpdated).toBe(9);
    expect(stats.recordsSkipped).toBe(0);
    expect(stats.timeMs).toBeGreaterThanOrEqual(0);

    // Verify all metadata enriched correctly
    const records = adapter.getRecords();

    // Record 1: Technology vertical, tech theme, introduction section
    expect(records[0].metadata?.vertical).toBe('technology');
    expect(records[0].metadata?.__h_theme).toBe('technology');
    expect(records[0].metadata?.__h_theme_confidence).toBeGreaterThanOrEqual(0.8);
    expect(records[0].metadata?.__h_section_path).toBe('introduction/overview');
    expect(records[0].metadata?.__h_section_title).toBe('overview');
    expect(records[0].metadata?.__h_section_level).toBe(2);

    // Record 2: Healthcare vertical, healthcare theme, methodology section
    expect(records[1].metadata?.vertical).toBe('healthcare');
    expect(records[1].metadata?.__h_theme).toBe('healthcare');
    expect(records[1].metadata?.__h_theme_confidence).toBeGreaterThanOrEqual(0.8);
    expect(records[1].metadata?.__h_section_path).toBe('methodology/data-analysis');
    expect(records[1].metadata?.__h_section_title).toBe('data-analysis');
    expect(records[1].metadata?.__h_section_level).toBe(2);

    // Record 3: Finance vertical, finance theme, results section
    expect(records[2].metadata?.vertical).toBe('finance');
    expect(records[2].metadata?.__h_theme).toBe('finance');
    expect(records[2].metadata?.__h_theme_confidence).toBeGreaterThanOrEqual(0.8);
    expect(records[2].metadata?.__h_section_path).toBe('results/performance');
    expect(records[2].metadata?.__h_section_title).toBe('performance');
    expect(records[2].metadata?.__h_section_level).toBe(2);
  });

  it('should integrate embedding classifier with distinguishable patterns', async () => {
    const embedder = new MockEmbedder(384);

    adapter.seedRecords([
      {
        id: '1',
        values: [0.1, 0.2],
        text: 'Machine learning and AI research in technology',
      },
      {
        id: '2',
        values: [0.3, 0.4],
        text: 'Medical healthcare and patient treatment',
      },
      {
        id: '3',
        values: [0.5, 0.6],
        text: 'Stock market finance and trading analysis',
      },
    ]);

    // Precompute theme embeddings for consistency
    const themeEmbeddings: Record<string, number[]> = {
      technology: await embedder.embed('technology'),
      healthcare: await embedder.embed('healthcare'),
      finance: await embedder.embed('finance'),
    };

    // Import EmbeddingThemeClassifier dynamically
    const { EmbeddingThemeClassifier } = await import('../../src/enrichment/classifiers/embedding-classifier');
    const embeddingClassifier = new EmbeddingThemeClassifier(
      ['technology', 'healthcare', 'finance'],
      embedder,
      themeEmbeddings
    );

    const stats = await pipeline.enrichThemes('test-collection', {
      themes: ['technology', 'healthcare', 'finance'],
      classifier: embeddingClassifier,
    });

    expect(stats.recordsProcessed).toBe(3);
    expect(stats.recordsUpdated).toBe(3);

    const records = adapter.getRecords();

    // Verify each record got a theme classification
    expect(records[0].metadata?.__h_theme).toBeDefined();
    expect(records[0].metadata?.__h_theme_confidence).toBeGreaterThanOrEqual(0);
    expect(records[0].metadata?.__h_theme_confidence).toBeLessThanOrEqual(1);

    expect(records[1].metadata?.__h_theme).toBeDefined();
    expect(records[1].metadata?.__h_theme_confidence).toBeGreaterThanOrEqual(0);
    expect(records[1].metadata?.__h_theme_confidence).toBeLessThanOrEqual(1);

    expect(records[2].metadata?.__h_theme).toBeDefined();
    expect(records[2].metadata?.__h_theme_confidence).toBeGreaterThanOrEqual(0);
    expect(records[2].metadata?.__h_theme_confidence).toBeLessThanOrEqual(1);
  });

  it('should integrate LLM classifier with structured responses', async () => {
    const llm = new MockLLM();

    adapter.seedRecords([
      {
        id: '1',
        values: [0.1, 0.2],
        text: 'Artificial intelligence and neural networks',
      },
      {
        id: '2',
        values: [0.3, 0.4],
        text: 'Clinical trials and pharmaceutical research',
      },
      {
        id: '3',
        values: [0.5, 0.6],
        text: 'Investment portfolio and asset management',
      },
    ]);

    // Import LLMThemeClassifier dynamically
    const { LLMThemeClassifier } = await import('../../src/enrichment/classifiers/llm-classifier');
    const llmClassifier = new LLMThemeClassifier(
      ['technology', 'healthcare', 'finance'],
      llm
    );

    // Configure mock LLM to return structured responses
    const responses = [
      {
        theme: 'technology',
        confidence: 0.95,
        allScores: { technology: 0.95, healthcare: 0.03, finance: 0.02 },
      },
      {
        theme: 'healthcare',
        confidence: 0.92,
        allScores: { technology: 0.04, healthcare: 0.92, finance: 0.04 },
      },
      {
        theme: 'finance',
        confidence: 0.91,
        allScores: { technology: 0.05, healthcare: 0.04, finance: 0.91 },
      },
    ];

    let callIndex = 0;
    llm.generateJSON = async () => {
      const response = responses[callIndex % responses.length];
      callIndex++;
      return response;
    };

    const stats = await pipeline.enrichThemes('test-collection', {
      themes: ['technology', 'healthcare', 'finance'],
      classifier: llmClassifier,
    });

    expect(stats.recordsProcessed).toBe(3);
    expect(stats.recordsUpdated).toBe(3);

    const records = adapter.getRecords();

    // Verify structured LLM responses were applied correctly
    expect(records[0].metadata?.__h_theme).toBe('technology');
    expect(records[0].metadata?.__h_theme_confidence).toBe(0.95);

    expect(records[1].metadata?.__h_theme).toBe('healthcare');
    expect(records[1].metadata?.__h_theme_confidence).toBe(0.92);

    expect(records[2].metadata?.__h_theme).toBe('finance');
    expect(records[2].metadata?.__h_theme_confidence).toBe(0.91);
  });

  it('should enrich only subset of records with year filter', async () => {
    adapter.seedRecords([
      {
        id: '1',
        values: [0.1, 0.2],
        text: 'Technology article from 2023',
        metadata: { category: 'tech', year: 2023 },
      },
      {
        id: '2',
        values: [0.3, 0.4],
        text: 'Healthcare article from 2024',
        metadata: { category: 'hc', year: 2024 },
      },
      {
        id: '3',
        values: [0.5, 0.6],
        text: 'Finance article from 2024',
        metadata: { category: 'fin', year: 2024 },
      },
      {
        id: '4',
        values: [0.7, 0.8],
        text: 'Tech article from 2025',
        metadata: { category: 'tech', year: 2025 },
      },
    ]);

    // Enrich only records from 2024
    const stats = await pipeline.enrichAll('test-collection', {
      vertical: {
        mapping: {
          tech: 'technology',
          hc: 'healthcare',
          fin: 'finance',
        },
      },
      themes: {
        themes: ['technology', 'healthcare', 'finance'],
        classifier,
      },
      sections: {
        autoDetect: true,
      },
      filter: { field: 'year', op: 'eq', value: 2024 },
    });

    // Only 2 records (year 2024) should be processed, 3 times each (vertical + themes + sections)
    expect(stats.recordsProcessed).toBe(6); // 2 records × 3 enrichment types
    expect(stats.recordsUpdated).toBe(6);

    const records = adapter.getRecords();

    // Records from 2024 should be enriched
    expect(records[1].metadata?.vertical).toBe('healthcare');
    expect(records[1].metadata?.__h_theme).toBeDefined();
    expect(records[2].metadata?.vertical).toBe('finance');
    expect(records[2].metadata?.__h_theme).toBeDefined();

    // Records from other years should not be enriched
    expect(records[0].metadata?.vertical).toBeUndefined();
    expect(records[0].metadata?.__h_theme).toBeUndefined();
    expect(records[3].metadata?.vertical).toBeUndefined();
    expect(records[3].metadata?.__h_theme).toBeUndefined();
  });

  it('should handle large collection of 500 records with performance < 10s', async () => {
    // Generate 500 test records
    const records: VectorRecord[] = [];
    for (let i = 0; i < 500; i++) {
      const categoryIndex = i % 3;
      const categories = ['tech', 'hc', 'fin'];
      const texts = [
        'Technology and machine learning research',
        'Healthcare and medical treatment',
        'Finance and stock market analysis',
      ];

      records.push({
        id: `${i + 1}`,
        values: [Math.random(), Math.random(), Math.random()],
        text: `# Section ${i + 1}\n\n${texts[categoryIndex]}`,
        metadata: {
          category: categories[categoryIndex],
          index: i,
        },
      });
    }

    adapter.seedRecords(records);

    // Measure enrichment performance
    const startTime = Date.now();

    const stats = await pipeline.enrichAll('test-collection', {
      vertical: {
        mapping: {
          tech: 'technology',
          hc: 'healthcare',
          fin: 'finance',
        },
      },
      themes: {
        themes: ['technology', 'healthcare', 'finance'],
        classifier,
      },
      sections: {
        autoDetect: true,
      },
      batchSize: 100,
    });

    const duration = Date.now() - startTime;

    // Verify all records processed - each record is processed 3 times (vertical + themes + sections)
    expect(stats.recordsProcessed).toBe(1500); // 500 records × 3 enrichment types
    expect(stats.recordsUpdated).toBe(1500);
    expect(stats.recordsSkipped).toBe(0);

    // Verify performance: should complete in under 10 seconds
    expect(duration).toBeLessThan(10000);
    expect(stats.timeMs).toBeLessThan(10000);

    // Verify random sample of enriched records
    const enrichedRecords = adapter.getRecords();
    expect(enrichedRecords.length).toBe(500);

    // Check first record
    expect(enrichedRecords[0].metadata?.vertical).toBeDefined();
    expect(enrichedRecords[0].metadata?.__h_theme).toBeDefined();
    expect(enrichedRecords[0].metadata?.__h_section_title).toBeDefined();

    // Check middle record
    expect(enrichedRecords[250].metadata?.vertical).toBeDefined();
    expect(enrichedRecords[250].metadata?.__h_theme).toBeDefined();
    expect(enrichedRecords[250].metadata?.__h_section_title).toBeDefined();

    // Check last record
    expect(enrichedRecords[499].metadata?.vertical).toBeDefined();
    expect(enrichedRecords[499].metadata?.__h_theme).toBeDefined();
    expect(enrichedRecords[499].metadata?.__h_section_title).toBeDefined();
  });
});
