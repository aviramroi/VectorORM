import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RAGQueryComposer } from '../../src/query/rag-query-composer';
import { VectorDBAdapter } from '../../src/adapters/vector-db-adapter';
import { Embedder } from '../../src/embedders/embedder';
import type { RetrievalParams } from '../../src/query/types';
import type { VectorRecord } from '../../src/types/vector-record';
import type { UniversalFilter } from '../../src/filters/types';
import type { SearchResult } from '../../src/types/search-result';
import { VerticalFields, HorizontalFields } from '../../src/metadata/constants';

/**
 * Mock Embedder for testing.
 */
class MockEmbedder extends Embedder {
  constructor() {
    super();
  }

  get dimensions(): number {
    return 3;
  }

  get modelName(): string {
    return 'mock-embedder';
  }

  async embed(text: string): Promise<number[]> {
    // Return deterministic embedding based on text length
    return [text.length / 10, 0.5, 0.3];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }
}

/**
 * Mock VectorDBAdapter for testing.
 */
class MockAdapter extends VectorDBAdapter {
  public searchCalls: any[] = [];
  public translateFilterCalls: UniversalFilter[] = [];
  private mockSearchResult: SearchResult = { records: [] };

  // Set the result that search() should return
  setSearchResult(result: SearchResult): void {
    this.mockSearchResult = result;
  }

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
  async updateMetadata(): Promise<void> {}

  async search(
    collection: string,
    queryVector: number[],
    options?: {
      topK?: number;
      filter?: UniversalFilter;
      includeMetadata?: boolean;
      includeValues?: boolean;
    }
  ): Promise<SearchResult> {
    this.searchCalls.push({
      collection,
      queryVector,
      options
    });
    return this.mockSearchResult;
  }

  translateFilter(filter: UniversalFilter): any {
    this.translateFilterCalls.push(filter);
    return { translated: filter };
  }

  async *iterate(): AsyncIterableIterator<VectorRecord[]> {
    yield [];
  }

  supportsFiltering(): boolean { return true; }
}

describe('RAGQueryComposer', () => {
  let adapter: MockAdapter;
  let embedder: MockEmbedder;
  let composer: RAGQueryComposer;

  beforeEach(() => {
    adapter = new MockAdapter();
    embedder = new MockEmbedder();
    composer = new RAGQueryComposer(adapter, embedder);
  });

  describe('constructor', () => {
    it('should create instance with adapter and embedder', () => {
      expect(composer).toBeInstanceOf(RAGQueryComposer);
    });
  });

  describe('retrieve', () => {
    it('should retrieve with no filters', async () => {
      const mockRecords: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { title: 'Test' },
          text: 'Test content',
          score: 0.95
        }
      ];
      adapter.setSearchResult({ records: mockRecords });

      const params: RetrievalParams = {
        query: 'test query',
        collection: 'test-collection',
        topK: 5
      };

      const result = await composer.retrieve(params);

      // Verify embedder was called
      expect(adapter.searchCalls).toHaveLength(1);
      expect(adapter.searchCalls[0].collection).toBe('test-collection');
      expect(adapter.searchCalls[0].queryVector).toEqual([1.0, 0.5, 0.3]); // "test query" length is 10
      expect(adapter.searchCalls[0].options?.topK).toBe(5);
      expect(adapter.searchCalls[0].options?.filter).toBeUndefined();

      // Verify result
      expect(result.records).toEqual(mockRecords);
      expect(result.query).toBe('test query');
      expect(result.filtersApplied).toEqual({});
    });

    it('should retrieve with vertical filter', async () => {
      const mockRecords: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { [VerticalFields.DOC_ID]: 'doc123', title: 'Test' },
          text: 'Test content',
          score: 0.95
        }
      ];
      adapter.setSearchResult({ records: mockRecords });

      const verticalFilter: UniversalFilter = {
        field: VerticalFields.DOC_ID,
        op: 'eq',
        value: 'doc123'
      };

      const params: RetrievalParams = {
        query: 'test query',
        collection: 'test-collection',
        topK: 5,
        verticalFilters: verticalFilter
      };

      const result = await composer.retrieve(params);

      // Verify filter was used
      expect(adapter.searchCalls[0].options?.filter).toEqual(verticalFilter);

      // Verify result includes filter info
      expect(result.filtersApplied.vertical).toEqual(verticalFilter);
      expect(result.filtersApplied.horizontal).toBeUndefined();
      expect(result.filtersApplied.custom).toBeUndefined();
    });

    it('should retrieve with horizontal filter', async () => {
      const mockRecords: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { [HorizontalFields.THEME]: 'legal', title: 'Test' },
          text: 'Test content',
          score: 0.95
        }
      ];
      adapter.setSearchResult({ records: mockRecords });

      const horizontalFilter: UniversalFilter = {
        field: HorizontalFields.THEME,
        op: 'eq',
        value: 'legal'
      };

      const params: RetrievalParams = {
        query: 'test query',
        collection: 'test-collection',
        topK: 5,
        horizontalFilters: horizontalFilter
      };

      const result = await composer.retrieve(params);

      // Verify filter was used
      expect(adapter.searchCalls[0].options?.filter).toEqual(horizontalFilter);

      // Verify result includes filter info
      expect(result.filtersApplied.horizontal).toEqual(horizontalFilter);
      expect(result.filtersApplied.vertical).toBeUndefined();
      expect(result.filtersApplied.custom).toBeUndefined();
    });

    it('should retrieve with all three filter types combined', async () => {
      const mockRecords: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: {
            [VerticalFields.DOC_ID]: 'doc123',
            [HorizontalFields.THEME]: 'legal',
            author: 'John Doe'
          },
          text: 'Test content',
          score: 0.95
        }
      ];
      adapter.setSearchResult({ records: mockRecords });

      const verticalFilter: UniversalFilter = {
        field: VerticalFields.DOC_ID,
        op: 'eq',
        value: 'doc123'
      };

      const horizontalFilter: UniversalFilter = {
        field: HorizontalFields.THEME,
        op: 'eq',
        value: 'legal'
      };

      const customFilter: UniversalFilter = {
        field: 'author',
        op: 'eq',
        value: 'John Doe'
      };

      const params: RetrievalParams = {
        query: 'test query',
        collection: 'test-collection',
        topK: 5,
        verticalFilters: verticalFilter,
        horizontalFilters: horizontalFilter,
        customFilters: customFilter
      };

      const result = await composer.retrieve(params);

      // Verify combined filter was used
      expect(adapter.searchCalls[0].options?.filter).toHaveProperty('and');
      const andFilter = adapter.searchCalls[0].options?.filter as any;
      expect(andFilter.and).toHaveLength(3);

      // Verify result includes all filter info
      expect(result.filtersApplied.vertical).toEqual(verticalFilter);
      expect(result.filtersApplied.horizontal).toEqual(horizontalFilter);
      expect(result.filtersApplied.custom).toEqual(customFilter);
    });

    it('should handle empty results', async () => {
      adapter.setSearchResult({ records: [] });

      const params: RetrievalParams = {
        query: 'test query',
        collection: 'test-collection',
        topK: 5
      };

      const result = await composer.retrieve(params);

      expect(result.records).toEqual([]);
      expect(result.query).toBe('test query');
    });

    it('should include embeddings when requested', async () => {
      const mockRecords: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { title: 'Test' },
          text: 'Test content',
          score: 0.95
        }
      ];
      adapter.setSearchResult({ records: mockRecords });

      const params: RetrievalParams = {
        query: 'test query',
        collection: 'test-collection',
        topK: 5,
        includeEmbeddings: true
      };

      await composer.retrieve(params);

      // Verify includeValues was passed to adapter
      expect(adapter.searchCalls[0].options?.includeValues).toBe(true);
    });
  });

  describe('retrieveVertical', () => {
    it('should group results by doc_id', async () => {
      const mockRecords: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { [VerticalFields.DOC_ID]: 'doc1', title: 'Test 1' },
          text: 'Content 1',
          score: 0.95
        },
        {
          id: 'rec2',
          embedding: [0.2, 0.3, 0.4],
          metadata: { [VerticalFields.DOC_ID]: 'doc1', title: 'Test 2' },
          text: 'Content 2',
          score: 0.90
        },
        {
          id: 'rec3',
          embedding: [0.3, 0.4, 0.5],
          metadata: { [VerticalFields.DOC_ID]: 'doc2', title: 'Test 3' },
          text: 'Content 3',
          score: 0.85
        }
      ];
      adapter.setSearchResult({ records: mockRecords });

      const params: RetrievalParams = {
        query: 'test query',
        collection: 'test-collection',
        topK: 10
      };

      const result = await composer.retrieveVertical(params);

      // Verify grouping
      expect(result.size).toBe(2);
      expect(result.get('doc1')).toHaveLength(2);
      expect(result.get('doc1')?.[0].id).toBe('rec1');
      expect(result.get('doc1')?.[1].id).toBe('rec2');
      expect(result.get('doc2')).toHaveLength(1);
      expect(result.get('doc2')?.[0].id).toBe('rec3');
    });

    it('should skip records without doc_id', async () => {
      const mockRecords: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { [VerticalFields.DOC_ID]: 'doc1', title: 'Test 1' },
          text: 'Content 1',
          score: 0.95
        },
        {
          id: 'rec2',
          embedding: [0.2, 0.3, 0.4],
          metadata: { title: 'Test 2' }, // No doc_id
          text: 'Content 2',
          score: 0.90
        }
      ];
      adapter.setSearchResult({ records: mockRecords });

      const params: RetrievalParams = {
        query: 'test query',
        collection: 'test-collection',
        topK: 10
      };

      const result = await composer.retrieveVertical(params);

      // Only rec1 should be included
      expect(result.size).toBe(1);
      expect(result.get('doc1')).toHaveLength(1);
      expect(result.get('doc1')?.[0].id).toBe('rec1');
    });
  });

  describe('retrieveHorizontal', () => {
    it('should group results by theme', async () => {
      const mockRecords: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { [HorizontalFields.THEME]: 'legal', title: 'Test 1' },
          text: 'Content 1',
          score: 0.95
        },
        {
          id: 'rec2',
          embedding: [0.2, 0.3, 0.4],
          metadata: { [HorizontalFields.THEME]: 'legal', title: 'Test 2' },
          text: 'Content 2',
          score: 0.90
        },
        {
          id: 'rec3',
          embedding: [0.3, 0.4, 0.5],
          metadata: { [HorizontalFields.THEME]: 'financial', title: 'Test 3' },
          text: 'Content 3',
          score: 0.85
        }
      ];
      adapter.setSearchResult({ records: mockRecords });

      const params: RetrievalParams = {
        query: 'test query',
        collection: 'test-collection',
        topK: 10
      };

      const result = await composer.retrieveHorizontal(params);

      // Verify grouping
      expect(result.size).toBe(2);
      expect(result.get('legal')).toHaveLength(2);
      expect(result.get('legal')?.[0].id).toBe('rec1');
      expect(result.get('legal')?.[1].id).toBe('rec2');
      expect(result.get('financial')).toHaveLength(1);
      expect(result.get('financial')?.[0].id).toBe('rec3');
    });

    it('should skip records without theme', async () => {
      const mockRecords: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { [HorizontalFields.THEME]: 'legal', title: 'Test 1' },
          text: 'Content 1',
          score: 0.95
        },
        {
          id: 'rec2',
          embedding: [0.2, 0.3, 0.4],
          metadata: { title: 'Test 2' }, // No theme
          text: 'Content 2',
          score: 0.90
        }
      ];
      adapter.setSearchResult({ records: mockRecords });

      const params: RetrievalParams = {
        query: 'test query',
        collection: 'test-collection',
        topK: 10
      };

      const result = await composer.retrieveHorizontal(params);

      // Only rec1 should be included
      expect(result.size).toBe(1);
      expect(result.get('legal')).toHaveLength(1);
      expect(result.get('legal')?.[0].id).toBe('rec1');
    });
  });
});
