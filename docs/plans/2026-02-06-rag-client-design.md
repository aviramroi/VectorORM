# Phase 6: RAGClient & Full RAG Query - Design Document

**Date:** 2026-02-06
**Status:** Approved for Implementation
**Phase:** 6 of 7

## Executive Summary

Phase 6 adds the RAGClient - a unified facade that ties together all Glyph components (adapter, embedder, LLM, ingestion, enrichment, query) into a single developer-facing API. It also adds the `query()` method for full RAG (retrieve + generate).

## Architecture Overview

RAGClient is a **facade** that auto-constructs internal pipelines from injected dependencies:

```
RAGClient
├── VectorDBAdapter (injected)
├── Embedder (injected)
├── LLMClient (optional, injected)
├── RAGQueryComposer (auto-constructed)
├── IngestionPipeline (auto-constructed)
├── EnrichmentPipeline (auto-constructed)
└── LoaderRegistry (auto-constructed)
```

**Design principles:**
- Constructor dependency injection (no factories, no magic)
- Consistent with existing patterns (IngestionPipeline, EnrichmentPipeline, etc.)
- Optional LLM - retrieval works without it, `query()` requires it
- Sensible defaults, everything overridable

## Core Interface

### RAGClient

```typescript
class RAGClient {
  constructor(config: RAGClientConfig)

  // Collection management
  async createCollection(name: string, dimension?: number, metric?: DistanceMetric): Promise<void>;
  async deleteCollection(name: string): Promise<void>;
  async collectionExists(name: string): Promise<boolean>;

  // Ingestion
  async ingest(sources: string | string[], collection?: string, config?: IngestionConfig): Promise<IngestionStats>;

  // Retrieval
  async retrieve(query: string, options?: RetrieveOptions): Promise<RetrievalResult>;

  // Enrichment
  async enrich(collection: string, config: EnrichAllConfig): Promise<EnrichmentStats>;

  // Full RAG query (requires LLM)
  async query(question: string, options?: QueryOptions): Promise<RAGResponse>;
}
```

## Types

### RAGClientConfig

```typescript
interface RAGClientConfig {
  adapter: VectorDBAdapter;
  embedder: Embedder;
  llm?: LLMClient;
  defaultCollection?: string;
  defaultTopK?: number;  // Default: 10
}
```

### RetrieveOptions

```typescript
interface RetrieveOptions {
  collection?: string;       // Overrides defaultCollection
  topK?: number;             // Overrides defaultTopK
  filter?: UniversalFilter;  // Custom filter
  partition?: string;        // Shorthand for __v_partition filter
  theme?: string;            // Shorthand for __h_theme filter
  groupBy?: 'document' | 'theme';  // Group results
}
```

### QueryOptions

```typescript
interface QueryOptions extends RetrieveOptions {
  systemPrompt?: string;     // Override default RAG system prompt
  temperature?: number;
  maxTokens?: number;
}
```

### RAGResponse

```typescript
interface RAGResponse {
  answer: string;            // LLM-generated answer
  sources: VectorRecord[];   // Retrieved context chunks
  query: string;             // Original question
  retrievalResult: RetrievalResult;
}
```

## Method Behavior

### createCollection()

```typescript
async createCollection(name: string, dimension?: number, metric?: DistanceMetric): Promise<void>
```

- `dimension` defaults to `this.embedder.dimensions`
- Delegates directly to `adapter.createCollection()`

### ingest()

```typescript
async ingest(sources: string | string[], collection?: string, config?: IngestionConfig): Promise<IngestionStats>
```

- `collection` defaults to `defaultCollection`
- Throws if no collection specified and no default
- Delegates to internal `IngestionPipeline`

### retrieve()

```typescript
async retrieve(query: string, options?: RetrieveOptions): Promise<RetrievalResult>
```

- Builds filters from `partition`, `theme`, and `filter` options
- If `groupBy` is set, uses `retrieveVertical` or `retrieveHorizontal`
- Otherwise uses standard `retrieve`
- Delegates to internal `RAGQueryComposer`

### enrich()

```typescript
async enrich(collection: string, config: EnrichAllConfig): Promise<EnrichmentStats>
```

- Delegates directly to internal `EnrichmentPipeline.enrichAll()`

### query()

```typescript
async query(question: string, options?: QueryOptions): Promise<RAGResponse>
```

1. Throws if no LLM provided
2. Calls `this.retrieve(question, options)` to get context
3. Joins chunk texts into context string
4. Builds prompt: system prompt + context + question
5. Calls `this.llm.generate()` with temperature/maxTokens
6. Returns `{ answer, sources, query, retrievalResult }`

Default system prompt:
```
You are a helpful assistant. Answer the question based on the provided context.
If the context doesn't contain enough information, say so.
```

## Error Handling

- `query()` without LLM: `"RAGClient.query() requires an LLM client. Pass one in the constructor config."`
- `ingest()` without collection: `"No collection specified. Pass a collection name or set defaultCollection in config."`
- `retrieve()` without collection: same error

## Testing Strategy

### Unit Tests

- `tests/client/rag-client.test.ts` - Main test file
  - Constructor: stores config, creates internal pipelines
  - Collection management: delegates to adapter
  - `createCollection` defaults dimension from embedder
  - `ingest()` delegates to IngestionPipeline
  - `retrieve()` delegates to RAGQueryComposer
  - `retrieve()` with partition/theme builds correct filters
  - `retrieve()` with groupBy uses correct method
  - `enrich()` delegates to EnrichmentPipeline
  - `query()` retrieves + generates
  - `query()` throws without LLM
  - `query()` uses custom systemPrompt
  - Default collection used when not specified
  - Error when no collection available

### Integration Tests

- `tests/client/rag-client-integration.test.ts`
  - Full flow: create collection → ingest → retrieve
  - Full RAG: ingest → query with mock LLM

## Package Structure

```
packages/core/src/
├── client/
│   ├── rag-client.ts          # RAGClient class
│   ├── types.ts               # RAGClientConfig, RetrieveOptions, QueryOptions, RAGResponse
│   └── index.ts               # Exports
└── index.ts                   # Add client exports
```

## Implementation Tasks

1. Types (RAGClientConfig, RetrieveOptions, QueryOptions, RAGResponse)
2. RAGClient class with all methods
3. Unit tests
4. Integration tests
5. Update core index exports

## Success Criteria

- [ ] RAGClient wires together all components
- [ ] Collection management delegates to adapter
- [ ] Ingestion delegates to IngestionPipeline
- [ ] Retrieval with filter shorthands (partition, theme, groupBy)
- [ ] Enrichment delegates to EnrichmentPipeline
- [ ] Full RAG query (retrieve + generate) working
- [ ] Error handling for missing LLM, missing collection
- [ ] Comprehensive tests

---

**Design approved by:** User
**Ready for implementation:** Yes
