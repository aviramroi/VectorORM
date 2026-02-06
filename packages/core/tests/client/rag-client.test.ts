import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RAGClient } from '../../src/client/rag-client';
import { VectorDBAdapter } from '../../src/adapters/vector-db-adapter';
import { Embedder } from '../../src/embedders/embedder';
import { MockLLM } from '../../src/llm/mock-llm';
import type { VectorRecord } from '../../src/types/vector-record';
import type { SearchResult } from '../../src/types/search-result';
import type { UniversalFilter } from '../../src/filters/types';
import { VerticalFields, HorizontalFields } from '../../src/metadata/constants';

// ── Mocks ──────────────────────────────────────────────────────────────────

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
    return [text.length / 10, 0.5, 0.3];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

class MockAdapter extends VectorDBAdapter {
  public searchCalls: any[] = [];
  public createCollectionCalls: any[] = [];
  public deleteCollectionCalls: string[] = [];
  public collectionExistsCalls: string[] = [];
  private mockSearchResult: SearchResult = { records: [] };
  private mockCollectionExists = true;

  setSearchResult(result: SearchResult): void {
    this.mockSearchResult = result;
  }

  setCollectionExists(exists: boolean): void {
    this.mockCollectionExists = exists;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isConnected(): Promise<boolean> { return true; }

  async createCollection(name: string, dimension: number, metric?: any): Promise<void> {
    this.createCollectionCalls.push({ name, dimension, metric });
  }
  async deleteCollection(name: string): Promise<void> {
    this.deleteCollectionCalls.push(name);
  }
  async collectionExists(name: string): Promise<boolean> {
    this.collectionExistsCalls.push(name);
    return this.mockCollectionExists;
  }
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
    this.searchCalls.push({ collection, queryVector, options });
    return this.mockSearchResult;
  }

  translateFilter(filter: UniversalFilter): any {
    return { translated: filter };
  }

  async *iterate(): AsyncIterableIterator<VectorRecord[]> {
    yield [];
  }

  supportsFiltering(): boolean { return true; }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRecord(id: string, text: string, metadata: Record<string, any> = {}): VectorRecord {
  return {
    id,
    embedding: [0.1, 0.2, 0.3],
    metadata,
    text,
    score: 0.9
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('RAGClient', () => {
  let adapter: MockAdapter;
  let embedder: MockEmbedder;
  let llm: MockLLM;
  let client: RAGClient;

  beforeEach(() => {
    adapter = new MockAdapter();
    embedder = new MockEmbedder();
    llm = new MockLLM();
    client = new RAGClient({
      adapter,
      embedder,
      llm,
      defaultCollection: 'default-col',
      defaultTopK: 5
    });
  });

  // ── Constructor ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create instance with required config', () => {
      const c = new RAGClient({ adapter, embedder });
      expect(c).toBeInstanceOf(RAGClient);
    });

    it('should accept optional LLM, collection, and topK', () => {
      expect(client).toBeInstanceOf(RAGClient);
    });
  });

  // ── Collection Management ──────────────────────────────────────────────

  describe('createCollection', () => {
    it('should create collection with explicit dimension', async () => {
      await client.createCollection('my-col', 768);
      expect(adapter.createCollectionCalls).toEqual([
        { name: 'my-col', dimension: 768, metric: undefined }
      ]);
    });

    it('should default dimension to embedder.dimensions', async () => {
      await client.createCollection('my-col');
      expect(adapter.createCollectionCalls[0].dimension).toBe(3);
    });

    it('should pass distance metric', async () => {
      await client.createCollection('my-col', 768, 'cosine');
      expect(adapter.createCollectionCalls[0].metric).toBe('cosine');
    });
  });

  describe('deleteCollection', () => {
    it('should delegate to adapter', async () => {
      await client.deleteCollection('my-col');
      expect(adapter.deleteCollectionCalls).toEqual(['my-col']);
    });
  });

  describe('collectionExists', () => {
    it('should return true when collection exists', async () => {
      adapter.setCollectionExists(true);
      expect(await client.collectionExists('my-col')).toBe(true);
    });

    it('should return false when collection does not exist', async () => {
      adapter.setCollectionExists(false);
      expect(await client.collectionExists('my-col')).toBe(false);
    });
  });

  // ── Retrieve ───────────────────────────────────────────────────────────

  describe('retrieve', () => {
    it('should retrieve with defaults (collection, topK)', async () => {
      const records = [makeRecord('r1', 'hello')];
      adapter.setSearchResult({ records });

      const result = await client.retrieve('test query');

      expect(result.records).toEqual(records);
      expect(result.query).toBe('test query');
      expect(adapter.searchCalls[0].collection).toBe('default-col');
      expect(adapter.searchCalls[0].options?.topK).toBe(5);
    });

    it('should override collection and topK', async () => {
      adapter.setSearchResult({ records: [] });

      await client.retrieve('q', { collection: 'other', topK: 20 });

      expect(adapter.searchCalls[0].collection).toBe('other');
      expect(adapter.searchCalls[0].options?.topK).toBe(20);
    });

    it('should throw when no collection available', async () => {
      const noDefaultClient = new RAGClient({ adapter, embedder });

      await expect(noDefaultClient.retrieve('q')).rejects.toThrow(
        'No collection specified'
      );
    });

    it('should apply partition shorthand as vertical filter', async () => {
      adapter.setSearchResult({ records: [] });

      const result = await client.retrieve('q', { partition: 'finance' });

      // The filter should include the vertical field
      const call = adapter.searchCalls[0];
      expect(call.options?.filter).toBeDefined();
      expect(result.filtersApplied.vertical).toEqual({
        field: VerticalFields.PARTITION,
        op: 'eq',
        value: 'finance'
      });
    });

    it('should apply theme shorthand as horizontal filter', async () => {
      adapter.setSearchResult({ records: [] });

      const result = await client.retrieve('q', { theme: 'legal' });

      expect(result.filtersApplied.horizontal).toEqual({
        field: HorizontalFields.THEME,
        op: 'eq',
        value: 'legal'
      });
    });

    it('should pass custom filter through', async () => {
      adapter.setSearchResult({ records: [] });

      const filter: UniversalFilter = { field: 'author', op: 'eq', value: 'Alice' };
      const result = await client.retrieve('q', { filter });

      expect(result.filtersApplied.custom).toEqual(filter);
    });

    it('should handle groupBy document', async () => {
      const records = [
        makeRecord('r1', 'a', { [VerticalFields.DOC_ID]: 'doc1' }),
        makeRecord('r2', 'b', { [VerticalFields.DOC_ID]: 'doc1' }),
        makeRecord('r3', 'c', { [VerticalFields.DOC_ID]: 'doc2' })
      ];
      adapter.setSearchResult({ records });

      const result = await client.retrieve('q', { groupBy: 'document' });

      // Results are flattened back from grouped map
      expect(result.records.length).toBe(3);
    });

    it('should handle groupBy theme', async () => {
      const records = [
        makeRecord('r1', 'a', { [HorizontalFields.THEME]: 'legal' }),
        makeRecord('r2', 'b', { [HorizontalFields.THEME]: 'tech' })
      ];
      adapter.setSearchResult({ records });

      const result = await client.retrieve('q', { groupBy: 'theme' });

      expect(result.records.length).toBe(2);
    });

    it('should exclude records without metadata when grouping', async () => {
      const records = [
        makeRecord('r1', 'a', { [VerticalFields.DOC_ID]: 'doc1' }),
        makeRecord('r2', 'b', {}) // no doc_id
      ];
      adapter.setSearchResult({ records });

      const result = await client.retrieve('q', { groupBy: 'document' });

      // Only the record with doc_id should survive grouping
      expect(result.records.length).toBe(1);
      expect(result.records[0].id).toBe('r1');
    });
  });

  // ── Ingest ─────────────────────────────────────────────────────────────

  describe('ingest', () => {
    it('should throw when no collection available', async () => {
      const noDefaultClient = new RAGClient({ adapter, embedder });

      await expect(noDefaultClient.ingest('file.txt')).rejects.toThrow(
        'No collection specified'
      );
    });

    it('should use defaultCollection when collection not provided', async () => {
      // IngestionPipeline.ingest resolves with stats (errors are reported in stats, not thrown).
      // Verify it doesn't throw "No collection specified" - meaning defaultCollection was used.
      const stats = await client.ingest('nonexistent.txt');
      expect(stats).toBeDefined();
      expect(stats.documentsProcessed).toBe(1);
    });
  });

  // ── Query (Full RAG) ──────────────────────────────────────────────────

  describe('query', () => {
    it('should throw when no LLM configured', async () => {
      const noLlmClient = new RAGClient({ adapter, embedder, defaultCollection: 'col' });

      await expect(noLlmClient.query('question')).rejects.toThrow(
        'requires an LLM client'
      );
    });

    it('should retrieve context and generate answer', async () => {
      const records = [
        makeRecord('r1', 'The price is $100.'),
        makeRecord('r2', 'Pricing is monthly.')
      ];
      adapter.setSearchResult({ records });
      llm.setResponse('The price is $100, billed monthly.');

      const response = await client.query('What is the price?');

      expect(response.answer).toBe('The price is $100, billed monthly.');
      expect(response.query).toBe('What is the price?');
      expect(response.sources).toEqual(records);
      expect(response.retrievalResult.records).toEqual(records);
    });

    it('should use default system prompt', async () => {
      adapter.setSearchResult({ records: [makeRecord('r1', 'context')] });
      llm.setResponse('answer');

      // We can't easily inspect the prompt sent to the LLM from MockLLM,
      // but we verify the flow doesn't throw
      const response = await client.query('q');
      expect(response.answer).toBe('answer');
    });

    it('should pass temperature and maxTokens to LLM', async () => {
      adapter.setSearchResult({ records: [] });

      // Spy on generate to capture options
      const generateSpy = vi.spyOn(llm, 'generate');
      llm.setResponse('answer');

      await client.query('q', { temperature: 0.7, maxTokens: 500 });

      expect(generateSpy).toHaveBeenCalledWith(
        expect.any(String),
        { temperature: 0.7, maxTokens: 500 }
      );
    });

    it('should use custom system prompt when provided', async () => {
      adapter.setSearchResult({ records: [makeRecord('r1', 'ctx')] });

      const generateSpy = vi.spyOn(llm, 'generate');
      llm.setResponse('answer');

      await client.query('q', { systemPrompt: 'You are a pirate.' });

      const promptArg = generateSpy.mock.calls[0][0];
      expect(promptArg).toContain('You are a pirate.');
      expect(promptArg).not.toContain('You are a helpful assistant');
    });

    it('should include context from retrieved records in prompt', async () => {
      const records = [
        makeRecord('r1', 'First piece of context.'),
        makeRecord('r2', 'Second piece of context.')
      ];
      adapter.setSearchResult({ records });

      const generateSpy = vi.spyOn(llm, 'generate');
      llm.setResponse('answer');

      await client.query('q');

      const promptArg = generateSpy.mock.calls[0][0];
      expect(promptArg).toContain('First piece of context.');
      expect(promptArg).toContain('Second piece of context.');
    });

    it('should handle empty retrieval results', async () => {
      adapter.setSearchResult({ records: [] });
      llm.setResponse('I could not find relevant information.');

      const response = await client.query('q');

      expect(response.answer).toBe('I could not find relevant information.');
      expect(response.sources).toEqual([]);
    });

    it('should pass retrieval options through to retrieve', async () => {
      adapter.setSearchResult({ records: [] });
      llm.setResponse('answer');

      await client.query('q', {
        collection: 'special-col',
        topK: 3,
        partition: 'tech'
      });

      expect(adapter.searchCalls[0].collection).toBe('special-col');
      expect(adapter.searchCalls[0].options?.topK).toBe(3);
    });
  });

  // ── Enrich ─────────────────────────────────────────────────────────────

  describe('enrich', () => {
    it('should delegate to enrichment pipeline', async () => {
      // EnrichmentPipeline.enrichAll will iterate the adapter (which yields [])
      // so this should complete without error
      const stats = await client.enrich('my-col', {});
      expect(stats).toBeDefined();
      expect(stats.recordsProcessed).toBe(0);
    });
  });

  // ── Default TopK ───────────────────────────────────────────────────────

  describe('default topK', () => {
    it('should default to 10 when not specified', async () => {
      const defaultClient = new RAGClient({
        adapter,
        embedder,
        defaultCollection: 'col'
      });
      adapter.setSearchResult({ records: [] });

      await defaultClient.retrieve('q');

      expect(adapter.searchCalls[0].options?.topK).toBe(10);
    });
  });
});
