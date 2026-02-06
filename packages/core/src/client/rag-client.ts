// packages/core/src/client/rag-client.ts
import type { VectorDBAdapter } from '../adapters/vector-db-adapter';
import type { Embedder } from '../embedders/embedder';
import type { LLMClient } from '../llm/llm-client';
import type { DistanceMetric } from '../adapters/types';
import type { UniversalFilter } from '../filters/types';
import type { RetrievalResult } from '../query/types';
import type { IngestionConfig, IngestionStats } from '../ingestion/types';
import type { EnrichAllConfig, EnrichmentStats } from '../enrichment/types';
import type { RAGClientConfig, RetrieveOptions, QueryOptions, RAGResponse } from './types';
import { RAGQueryComposer } from '../query/rag-query-composer';
import { IngestionPipeline } from '../ingestion/ingestion-pipeline';
import { EnrichmentPipeline } from '../enrichment/enrichment-pipeline';
import { LoaderRegistry } from '../ingestion/loaders/loader-registry';
import { VerticalFields } from '../metadata/constants';
import { HorizontalFields } from '../metadata/constants';

const DEFAULT_TOP_K = 10;

const DEFAULT_RAG_SYSTEM_PROMPT =
  'You are a helpful assistant. Answer the question based on the provided context. ' +
  'If the context doesn\'t contain enough information, say so.';

/**
 * RAGClient - Unified facade for all Glyph VectorORM operations.
 *
 * Ties together adapter, embedder, LLM, ingestion, enrichment, and query
 * into a single developer-facing API.
 *
 * @example
 * ```typescript
 * const client = new RAGClient({
 *   adapter: new ChromaAdapter(),
 *   embedder: new OpenAIEmbedder(),
 *   llm: new OpenAIClient(),
 *   defaultCollection: 'my-docs'
 * });
 *
 * // Ingest documents
 * await client.ingest(['docs/*.pdf']);
 *
 * // Retrieve
 * const result = await client.retrieve('pricing info');
 *
 * // Full RAG query
 * const response = await client.query('What are the pricing terms?');
 * console.log(response.answer);
 * ```
 */
export class RAGClient {
  private readonly adapter: VectorDBAdapter;
  private readonly embedder: Embedder;
  private readonly llm?: LLMClient;
  private readonly defaultCollection?: string;
  private readonly defaultTopK: number;

  private readonly queryComposer: RAGQueryComposer;
  private readonly ingestionPipeline: IngestionPipeline;
  private readonly enrichmentPipeline: EnrichmentPipeline;

  constructor(config: RAGClientConfig) {
    this.adapter = config.adapter;
    this.embedder = config.embedder;
    this.llm = config.llm;
    this.defaultCollection = config.defaultCollection;
    this.defaultTopK = config.defaultTopK ?? DEFAULT_TOP_K;

    // Auto-construct internal pipelines
    this.queryComposer = new RAGQueryComposer(this.adapter, this.embedder);
    this.ingestionPipeline = new IngestionPipeline(
      this.adapter,
      this.embedder,
      new LoaderRegistry()
    );
    this.enrichmentPipeline = new EnrichmentPipeline(this.adapter);
  }

  // ==========================================================================
  // COLLECTION MANAGEMENT
  // ==========================================================================

  /**
   * Create a new vector collection.
   * Dimension defaults to embedder.dimensions if not specified.
   */
  async createCollection(
    name: string,
    dimension?: number,
    metric?: DistanceMetric
  ): Promise<void> {
    const dim = dimension ?? this.embedder.dimensions;
    await this.adapter.createCollection(name, dim, metric);
  }

  /**
   * Delete a collection.
   */
  async deleteCollection(name: string): Promise<void> {
    await this.adapter.deleteCollection(name);
  }

  /**
   * Check if a collection exists.
   */
  async collectionExists(name: string): Promise<boolean> {
    return this.adapter.collectionExists(name);
  }

  // ==========================================================================
  // INGESTION
  // ==========================================================================

  /**
   * Ingest documents into a collection.
   * Collection defaults to defaultCollection if not specified.
   */
  async ingest(
    sources: string | string[],
    collection?: string,
    config?: IngestionConfig
  ): Promise<IngestionStats> {
    const col = collection ?? this.defaultCollection;
    if (!col) {
      throw new Error(
        'No collection specified. Pass a collection name or set defaultCollection in config.'
      );
    }
    return this.ingestionPipeline.ingest(sources, col, config);
  }

  // ==========================================================================
  // RETRIEVAL
  // ==========================================================================

  /**
   * Retrieve relevant chunks for a query.
   * Supports filter shorthands (partition, theme) and groupBy.
   */
  async retrieve(
    query: string,
    options?: RetrieveOptions
  ): Promise<RetrievalResult> {
    const collection = options?.collection ?? this.defaultCollection;
    if (!collection) {
      throw new Error(
        'No collection specified. Pass a collection name or set defaultCollection in config.'
      );
    }

    const topK = options?.topK ?? this.defaultTopK;

    // Build filters from shorthands
    let verticalFilters: UniversalFilter | undefined;
    let horizontalFilters: UniversalFilter | undefined;
    const customFilters = options?.filter;

    if (options?.partition) {
      verticalFilters = {
        field: VerticalFields.PARTITION,
        op: 'eq' as const,
        value: options.partition
      };
    }

    if (options?.theme) {
      horizontalFilters = {
        field: HorizontalFields.THEME,
        op: 'eq' as const,
        value: options.theme
      };
    }

    const params = {
      query,
      collection,
      topK,
      verticalFilters,
      horizontalFilters,
      customFilters
    };

    // Handle groupBy
    if (options?.groupBy === 'document') {
      const grouped = await this.queryComposer.retrieveVertical(params);
      // Flatten grouped results back into RetrievalResult
      const records = Array.from(grouped.values()).flat();
      return { records, query, filtersApplied: { vertical: verticalFilters, horizontal: horizontalFilters, custom: customFilters } };
    }

    if (options?.groupBy === 'theme') {
      const grouped = await this.queryComposer.retrieveHorizontal(params);
      const records = Array.from(grouped.values()).flat();
      return { records, query, filtersApplied: { vertical: verticalFilters, horizontal: horizontalFilters, custom: customFilters } };
    }

    return this.queryComposer.retrieve(params);
  }

  // ==========================================================================
  // ENRICHMENT
  // ==========================================================================

  /**
   * Enrich a collection with vertical, theme, and/or section metadata.
   */
  async enrich(
    collection: string,
    config: EnrichAllConfig
  ): Promise<EnrichmentStats> {
    return this.enrichmentPipeline.enrichAll(collection, config);
  }

  // ==========================================================================
  // FULL RAG QUERY
  // ==========================================================================

  /**
   * Full RAG: retrieve relevant context and generate an answer using LLM.
   * Requires an LLM client to be provided in the constructor config.
   */
  async query(
    question: string,
    options?: QueryOptions
  ): Promise<RAGResponse> {
    if (!this.llm) {
      throw new Error(
        'RAGClient.query() requires an LLM client. Pass one in the constructor config.'
      );
    }

    // 1. Retrieve relevant chunks
    const retrievalResult = await this.retrieve(question, options);

    // 2. Build context from chunk texts
    const context = retrievalResult.records
      .map((r) => r.text)
      .filter(Boolean)
      .join('\n\n');

    // 3. Build prompt
    const systemPrompt = options?.systemPrompt ?? DEFAULT_RAG_SYSTEM_PROMPT;
    const prompt = `${systemPrompt}\n\nContext:\n${context}\n\nQuestion: ${question}`;

    // 4. Generate answer
    const answer = await this.llm.generate(prompt, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens
    });

    return {
      answer,
      sources: retrievalResult.records,
      query: question,
      retrievalResult
    };
  }
}
