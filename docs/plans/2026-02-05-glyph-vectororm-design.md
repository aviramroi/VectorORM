# VectorORM - Implementation Design

**Date:** 2026-02-05
**Status:** Approved for Implementation
**Version:** 1.0.0

## Executive Summary

VectorORM is a TypeScript-first vectorORM that brings database abstraction and ORM-like patterns to vector databases. It introduces Vertical RAG (document-level filtering) and Horizontal RAG (theme/section-level filtering) as first-class concepts.

## Technology Stack

- **Language:** TypeScript (Node.js runtime)
- **Monorepo Tool:** Turborepo
- **Testing:** Vitest
- **Documentation:** TSDoc + TypeDoc
- **Package Manager:** npm
- **Build:** tsc (TypeScript compiler)

## Architecture Overview

### Monorepo Structure

```
vectororm/
├── packages/
│   ├── core/                      # @vectororm/core - Main package
│   │   ├── src/
│   │   │   ├── adapters/         # Abstract adapter base
│   │   │   ├── filters/          # Universal filter language
│   │   │   ├── metadata/         # Metadata schema & builders
│   │   │   ├── enrichment/       # Enrichment pipeline
│   │   │   ├── ingestion/        # Document ingestion
│   │   │   ├── query/            # Query composition
│   │   │   ├── embedders/        # Embedder abstractions
│   │   │   ├── llm/              # LLM abstractions
│   │   │   ├── client.ts         # RAGClient entry point
│   │   │   └── index.ts          # Public exports
│   │   ├── tests/
│   │   └── package.json
│   ├── adapter-pinecone/          # @vectororm/adapter-pinecone
│   ├── adapter-qdrant/            # @vectororm/adapter-qdrant
│   ├── adapter-weaviate/          # @vectororm/adapter-weaviate
│   ├── adapter-chroma/            # @vectororm/adapter-chroma
│   └── adapter-pgvector/          # @vectororm/adapter-pgvector
├── docs/
├── examples/
├── turbo.json
└── package.json
```

## Core Components Design

### 1. Type System & Abstractions

#### Vector Record
```typescript
interface VectorRecord {
  id: string;
  embedding: number[];
  metadata: Record<string, any>;
  text?: string;
  score?: number;
}
```

#### Search Result
```typescript
interface SearchResult {
  records: VectorRecord[];
  totalCount?: number;
  nextCursor?: string;
}
```

#### Metadata Schema Constants
```typescript
const METADATA_PREFIXES = {
  VERTICAL: '__v_',      // Document-level metadata
  HORIZONTAL: '__h_',    // Content/theme metadata
  STRUCTURAL: '__s_',    // Position and hierarchy
} as const;

export const VerticalFields = {
  DOC_ID: '__v_doc_id',
  SOURCE: '__v_source',
  PARTITION: '__v_partition',
  DOC_TYPE: '__v_doc_type',
  TAGS: '__v_tags',
} as const;

export const HorizontalFields = {
  THEME: '__h_theme',
  THEMES: '__h_themes',
  THEME_CONFIDENCE: '__h_theme_confidence',
  SECTION_PATH: '__h_section_path',
  SECTION_LEVEL: '__h_section_level',
  SECTION_TITLE: '__h_section_title',
} as const;

export const StructuralFields = {
  CHUNK_INDEX: '__s_chunk_index',
  PARENT_ID: '__s_parent_id',
  HAS_CHILDREN: '__s_has_children',
  TOTAL_CHUNKS: '__s_total_chunks',
} as const;
```

### 2. VectorDBAdapter Abstract Class

**Responsibilities:**
- Connection management
- Collection CRUD operations
- Vector operations (upsert, fetch, delete)
- Metadata operations (critical for enrichment)
- Search with filtering
- Filter translation (universal → native)
- Iteration for batch operations

**Key Methods:**
```typescript
abstract class VectorDBAdapter {
  // Connection
  abstract connect(credentials: Record<string, any>): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract healthCheck(): Promise<boolean>;

  // Collections
  abstract createCollection(name: string, dimension: number, metric?: string): Promise<void>;
  abstract deleteCollection(name: string): Promise<void>;
  abstract listCollections(): Promise<string[]>;
  abstract collectionExists(name: string): Promise<boolean>;
  abstract getCollectionStats(name: string): Promise<CollectionStats>;

  // Vector operations
  abstract upsert(collection: string, records: VectorRecord[]): Promise<number>;
  abstract fetchByIds(collection: string, ids: string[], includeEmbeddings?: boolean): Promise<VectorRecord[]>;
  abstract deleteByIds(collection: string, ids: string[]): Promise<number>;
  abstract deleteByFilter(collection: string, filter: UniversalFilter): Promise<number>;

  // Metadata operations (critical for enrichment)
  abstract updateMetadata(collection: string, id: string, metadata: Record<string, any>, merge?: boolean): Promise<void>;
  abstract batchUpdateMetadata(collection: string, updates: MetadataUpdate[]): Promise<number>;

  // Search
  abstract search(collection: string, queryVector: number[], topK: number, filter?: any, includeEmbeddings?: boolean): Promise<SearchResult>;

  // Filter translation (KEY for DB agnosticism)
  abstract translateFilter(universalFilter: UniversalFilter): any;

  // Iteration (for enrichment)
  abstract listAllIds(collection: string, filter?: UniversalFilter, batchSize?: number): AsyncIterableIterator<string>;
  abstract iterateAll(collection: string, filter?: UniversalFilter, batchSize?: number, includeEmbeddings?: boolean): AsyncIterableIterator<VectorRecord[]>;

  // Capability flags
  supportsNamespaces(): boolean { return false; }
  supportsHybridSearch(): boolean { return false; }
  supportsMetadataIndexing(): boolean { return true; }
  maxMetadataSize(): number | null { return null; }
  maxBatchSize(): number { return 100; }
}
```

### 3. Universal Filter Language

#### Filter Types
```typescript
type FilterOperator =
  | 'eq' | 'neq'
  | 'in' | 'nin'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'exists';

interface FilterCondition {
  field: string;
  op: FilterOperator;
  value: any;
}

interface AndFilter {
  and: UniversalFilter[];
}

interface OrFilter {
  or: UniversalFilter[];
}

type UniversalFilter = FilterCondition | AndFilter | OrFilter;
type ShorthandFilter = Record<string, any>;
```

#### Filter Translator
```typescript
class FilterTranslator {
  static normalize(input: ShorthandFilter | UniversalFilter): UniversalFilter {
    // Convert shorthand {region: "ny", year__gte: 2023}
    // to standard {and: [{field, op, value}, ...]}
  }

  static validate(filter: UniversalFilter): void {
    // Validate structure, operators, types
  }

  static isCompound(filter: UniversalFilter): boolean {
    return 'and' in filter || 'or' in filter;
  }
}
```

### 4. Metadata Builder

```typescript
class MetadataBuilder {
  private meta: Record<string, any> = {};

  vertical(data: {
    docId?: string;
    source?: string;
    partition?: string;
    docType?: string;
    tags?: string[];
  }): this {
    // Build vertical metadata with proper field names
    return this;
  }

  horizontal(data: {
    theme?: string;
    themes?: string[];
    themeConfidence?: number;
    sectionPath?: string;
    sectionLevel?: number;
    sectionTitle?: string;
  }): this {
    // Build horizontal metadata
    return this;
  }

  structural(data: {
    chunkIndex?: number;
    parentId?: string;
    hasChildren?: boolean;
    totalChunks?: number;
  }): this {
    // Build structural metadata
    return this;
  }

  custom(key: string, value: any): this {
    // Add custom user metadata
    return this;
  }

  build(): Record<string, any> {
    return this.meta;
  }
}
```

### 5. Theme Classification Strategy

```typescript
interface ThemeClassifier {
  classify(text: string): Promise<ThemeClassification>;
  classifyBatch(texts: string[]): Promise<ThemeClassification[]>;
}

interface ThemeClassification {
  theme: string;
  confidence: number;
}

// Implementations
class KeywordThemeClassifier implements ThemeClassifier {
  constructor(themes: string[], keywords: Record<string, string[]>) {}
  // Fast keyword matching
}

class ZeroShotThemeClassifier implements ThemeClassifier {
  constructor(themes: string[], modelName?: string) {}
  // HuggingFace transformers.js zero-shot
}

class EmbeddingThemeClassifier implements ThemeClassifier {
  constructor(themes: string[], embedder: Embedder) {}
  // Cosine similarity
}

class LLMThemeClassifier implements ThemeClassifier {
  constructor(themes: string[], llm: LLMClient) {}
  // LLM-based classification
}
```

### 6. Enrichment Pipeline

```typescript
class EnrichmentPipeline {
  constructor(
    private adapter: VectorDBAdapter,
    private embedder?: Embedder,
    private llm?: LLMClient
  ) {}

  // Vertical enrichment
  async enrichVerticalFromMapping(
    collection: string,
    mapping: Record<string, string>,
    batchSize?: number
  ): Promise<number> {
    // Map existing fields to __v_* fields
  }

  async enrichVerticalFromExtractor(
    collection: string,
    extractor: (source: string) => Record<string, any>,
    sourceField?: string,
    batchSize?: number
  ): Promise<number> {
    // Extract vertical metadata from source paths
  }

  // Horizontal enrichment
  async enrichHorizontalThemes(
    collection: string,
    themes: string[],
    method: 'keyword' | 'zero-shot' | 'embedding' | 'llm',
    textField?: string,
    batchSize?: number
  ): Promise<number> {
    // Classify chunks into themes
  }

  async enrichHorizontalSections(
    collection: string,
    detectFromText?: boolean,
    existingSectionField?: string,
    batchSize?: number
  ): Promise<number> {
    // Detect and add section hierarchy
  }

  // Combined enrichment
  async enrichAll(
    collection: string,
    config: EnrichmentConfig
  ): Promise<EnrichmentStats> {
    // Run all enrichment steps
  }
}
```

### 7. Document Ingestion Pipeline

#### Document Loaders
```typescript
interface DocumentLoader {
  canHandle(filePath: string): boolean;
  load(filePath: string): Promise<Document>;
}

interface Document {
  text: string;
  source: string;
  type: string;
  metadata?: Record<string, any>;
}

class LoaderRegistry {
  register(loader: DocumentLoader): void;
  loadDocument(path: string): Promise<Document>;
}

// Built-in loaders
class TextLoader implements DocumentLoader { /* .txt, .md */ }
class PDFLoader implements DocumentLoader { /* .pdf */ }
class DOCXLoader implements DocumentLoader { /* .docx */ }
class HTMLLoader implements DocumentLoader { /* .html */ }
```

#### Text Chunkers
```typescript
interface TextChunker {
  chunk(text: string, config: ChunkConfig): Promise<TextChunk[]>;
}

class RecursiveChunker implements TextChunker {
  // Recursive character splitting
}

class FixedChunker implements TextChunker {
  // Fixed-size with overlap
}

class SentenceChunker implements TextChunker {
  // Sentence boundary detection
}

class SemanticChunker implements TextChunker {
  // Embedding-based semantic chunking
}
```

#### Ingestion Pipeline
```typescript
class IngestionPipeline {
  constructor(
    private adapter: VectorDBAdapter,
    private embedder: Embedder,
    private loaderRegistry: LoaderRegistry,
    private themeClassifier?: ThemeClassifier
  ) {}

  async ingest(
    source: string | string[],
    collection: string,
    config: IngestionConfig
  ): Promise<IngestionStats> {
    // 1. Load documents
    // 2. Chunk text
    // 3. Extract vertical metadata
    // 4. Classify themes
    // 5. Detect sections
    // 6. Batch embed
    // 7. Batch upsert
  }
}
```

### 8. Query Composition Layer

```typescript
class RAGQueryComposer {
  constructor(
    private adapter: VectorDBAdapter,
    private embedder: Embedder,
    private defaultCollection?: string
  ) {}

  async retrieve(params: RetrievalParams): Promise<RetrievalResult> {
    // Unified retrieval with V/H support
  }

  async retrieveVertical(
    query: string,
    partition?: string,
    documents?: string[],
    options?: RetrievalOptions
  ): Promise<RetrievalResult> {
    // Document-level filtering
  }

  async retrieveHorizontal(
    query: string,
    theme?: string,
    ensureCoverage?: boolean,
    options?: RetrievalOptions
  ): Promise<RetrievalResult> {
    // Theme/section-level filtering
  }

  async retrieveForComparison(
    query: string,
    groupBy: string,
    theme?: string,
    chunksPerGroup?: number,
    options?: RetrievalOptions
  ): Promise<GroupedResults> {
    // Group-aware retrieval for comparison
  }
}
```

### 9. RAGClient - Main Entry Point

```typescript
class RAGClient {
  constructor(config: RAGClientConfig) {
    // Initialize adapter, embedder, LLM
    // Wire up all components
  }

  // Collection management
  async createCollection(name: string, dimension: number, metric?: string): Promise<void>;
  async deleteCollection(name: string): Promise<void>;
  async listCollections(): Promise<string[]>;

  // Ingestion
  async ingest(
    source: string | string[],
    collection: string,
    config?: IngestionConfig
  ): Promise<IngestionStats>;

  // Retrieval
  async retrieve(query: string, options?: RetrievalOptions): Promise<RetrievalResult>;
  async retrieveVertical(query: string, partition?: string, options?: RetrievalOptions): Promise<RetrievalResult>;
  async retrieveHorizontal(query: string, theme?: string, options?: RetrievalOptions): Promise<RetrievalResult>;
  async retrieveForComparison(query: string, groupBy: string, options?: RetrievalOptions): Promise<GroupedResults>;

  // Enrichment
  async enrich(collection: string, config: EnrichmentConfig): Promise<EnrichmentStats>;

  // Full RAG query
  async query(question: string, collection?: string, options?: RAGQueryOptions): Promise<RAGResponse>;
}
```

## Configuration & Credentials

### Configuration System
```typescript
interface RAGClientConfig {
  // Vector database
  vectorDb: 'pinecone' | 'qdrant' | 'weaviate' | 'chroma' | 'pgvector';

  // Embeddings
  embeddingModel?: string;
  embedder?: Embedder;

  // LLM (optional)
  llm?: string;
  llmClient?: LLMClient;

  // Credentials (direct or from env)
  credentials?: Record<string, any>;

  // Defaults
  defaultCollection?: string;
  defaultTopK?: number;
}
```

### Authentication Strategy
- **Direct credentials**: Pass in config object
- **Environment variables**: Fallback to process.env
- **Priority**: Config > Env vars

## Embedder & LLM Abstractions

```typescript
interface Embedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimension: number;
}

interface LLMClient {
  generate(prompt: string, context?: string[]): Promise<string>;
}

// Factory functions
function createEmbedder(model: string, credentials?: any): Embedder;
function createLLM(model: string, credentials?: any): LLMClient;
```

## Package Dependencies

### @vectororm/core
```json
{
  "dependencies": {
    "zod": "^3.22.4",           // Schema validation
    "dotenv": "^16.4.1",        // Environment variables
    "@xenova/transformers": "^2.17.0"  // Transformers.js for zero-shot
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vitest": "^1.2.0",
    "tsup": "^8.0.1"
  }
}
```

### Adapter Packages
Each adapter has its own DB client as a dependency:
- `@vectororm/adapter-pinecone`: `@pinecone-database/pinecone`
- `@vectororm/adapter-qdrant`: `@qdrant/js-client-rest`
- `@vectororm/adapter-weaviate`: `weaviate-ts-client`
- `@vectororm/adapter-chroma`: `chromadb`
- `@vectororm/adapter-pgvector`: `pg` + `pgvector`

## Testing Strategy

1. **Unit Tests**: Each component in isolation
2. **Integration Tests**: Components working together
3. **Adapter Tests**: Mock vector DB responses
4. **E2E Tests**: Real vector DB instances (optional, CI only)

## Documentation

1. **TSDoc comments**: On all public APIs
2. **TypeDoc generation**: API reference site
3. **README per package**: Usage examples
4. **Central docs site**: Comprehensive guides

## Implementation Priorities

### Phase 1: Core Foundation (Week 1-2)
1. Set up monorepo structure (Turborepo)
2. Implement type system & abstractions
3. Implement VectorDBAdapter abstract class
4. Implement FilterTranslator
5. Implement MetadataBuilder
6. Unit tests for core components

### Phase 2: First Adapter (Week 2-3)
1. Implement Pinecone adapter
2. Adapter integration tests
3. Basic RAGClient with Pinecone

### Phase 3: Query & Enrichment (Week 3-4)
1. Implement RAGQueryComposer
2. Implement EnrichmentPipeline
3. Implement theme classifiers (keyword, zero-shot)
4. Integration tests

### Phase 4: Ingestion (Week 4-5)
1. Implement document loaders
2. Implement text chunkers
3. Implement IngestionPipeline
4. End-to-end tests

### Phase 5: Additional Adapters (Week 5-6)
1. Implement Qdrant adapter
2. Implement Chroma adapter
3. Adapter tests

### Phase 6: Advanced Features (Week 6-8)
1. Implement embedding classifier
2. Implement LLM classifier
3. Implement semantic chunker
4. Full RAG query method
5. Comprehensive examples

## Success Criteria

- [ ] All core abstractions implemented with TypeScript strict mode
- [ ] At least 2 vector DB adapters working (Pinecone + Qdrant/Chroma)
- [ ] Full V/H RAG retrieval working
- [ ] Enrichment pipeline can retrofit existing vector DBs
- [ ] Document ingestion with multiple loaders
- [ ] >80% test coverage on core package
- [ ] Complete TypeDoc API documentation
- [ ] Working examples for insurance, legal, and vendor comparison use cases
- [ ] Published to npm as scoped packages (@vectororm/*)

## Open Questions

- [ ] Should we support streaming responses for large ingestion jobs?
- [ ] Should we add a CLI tool for common operations?
- [ ] Should we support custom embedders via plugins?
- [ ] Should we add observability/tracing hooks?

---

**Design approved by:** User
**Ready for implementation:** Yes
**Next step:** Create implementation plan with git worktree
