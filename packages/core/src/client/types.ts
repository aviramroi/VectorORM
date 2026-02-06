// packages/core/src/client/types.ts
import type { VectorDBAdapter } from '../adapters/vector-db-adapter';
import type { Embedder } from '../embedders/embedder';
import type { LLMClient } from '../llm/llm-client';
import type { UniversalFilter } from '../filters/types';
import type { VectorRecord } from '../types/vector-record';
import type { RetrievalResult } from '../query/types';
import type { DistanceMetric } from '../adapters/types';

/**
 * Configuration for RAGClient.
 */
export interface RAGClientConfig {
  /** Vector database adapter */
  adapter: VectorDBAdapter;
  /** Embedding model */
  embedder: Embedder;
  /** Optional LLM client (required for query()) */
  llm?: LLMClient;
  /** Default collection name */
  defaultCollection?: string;
  /** Default number of results to return (default: 10) */
  defaultTopK?: number;
}

/**
 * Options for retrieval operations.
 */
export interface RetrieveOptions {
  /** Override defaultCollection */
  collection?: string;
  /** Override defaultTopK */
  topK?: number;
  /** Custom filter */
  filter?: UniversalFilter;
  /** Shorthand for vertical filter on __v_partition */
  partition?: string;
  /** Shorthand for horizontal filter on __h_theme */
  theme?: string;
  /** Group results by document or theme */
  groupBy?: 'document' | 'theme';
}

/**
 * Options for full RAG query operations.
 */
export interface QueryOptions extends RetrieveOptions {
  /** Override default RAG system prompt */
  systemPrompt?: string;
  /** LLM temperature */
  temperature?: number;
  /** LLM max tokens */
  maxTokens?: number;
}

/**
 * Response from a full RAG query.
 */
export interface RAGResponse {
  /** LLM-generated answer */
  answer: string;
  /** Retrieved context chunks used to generate the answer */
  sources: VectorRecord[];
  /** Original question */
  query: string;
  /** Full retrieval details */
  retrievalResult: RetrievalResult;
}
