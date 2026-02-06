# Glyph VectorORM — API Guide

Glyph is a TypeScript-first vector ORM that brings database abstraction and ORM-like patterns to vector databases. It introduces **Vertical RAG** (document-level filtering) and **Horizontal RAG** (theme/section-level filtering) as first-class concepts.

## Quick Start

```typescript
import { RAGClient } from '@glyph/core';
import { ChromaAdapter } from '@glyph/adapter-chroma';

// 1. Create a client
const client = new RAGClient({
  adapter: new ChromaAdapter({ url: 'http://localhost:8000' }),
  embedder: myEmbedder,       // Any Embedder implementation
  llm: myLLM,                 // Optional — needed for query()
  defaultCollection: 'docs',
  defaultTopK: 10
});

// 2. Create a collection
await client.createCollection('docs');

// 3. Ingest documents
const stats = await client.ingest(['contracts/*.pdf', 'policies/*.txt'], 'docs');

// 4. Retrieve relevant chunks
const result = await client.retrieve('pricing terms', {
  partition: 'finance',
  theme: 'pricing'
});

// 5. Full RAG query
const response = await client.query('What are the pricing terms?');
console.log(response.answer);
```

---

## Core Concepts

### Metadata Axes

Glyph organizes vector metadata along three axes, each with a reserved prefix:

| Axis | Prefix | Purpose | Example Fields |
|------|--------|---------|----------------|
| **Vertical** | `__v_` | Document-level identity | `__v_doc_id`, `__v_partition`, `__v_source` |
| **Horizontal** | `__h_` | Content/theme classification | `__h_theme`, `__h_section_path`, `__h_section_level` |
| **Structural** | `__s_` | Position & hierarchy | `__s_chunk_index`, `__s_parent_id`, `__s_total_chunks` |

Use `MetadataBuilder` to construct metadata with the correct field names:

```typescript
import { MetadataBuilder } from '@glyph/core';

const metadata = new MetadataBuilder()
  .vertical({ docId: 'contract-123', partition: 'legal', source: '/docs/contract.pdf' })
  .horizontal({ theme: 'pricing', sectionTitle: 'Payment Terms' })
  .structural({ chunkIndex: 0, totalChunks: 5 })
  .custom('author', 'Jane Doe')
  .build();
```

### VectorRecord

The fundamental data type — a vector with metadata:

```typescript
interface VectorRecord {
  id: string;
  embedding: number[];
  metadata: Record<string, any>;
  text?: string;
  score?: number;  // Populated after search
}
```

---

## Ingestion

### Document Loaders

Glyph includes built-in loaders for common formats:

| Loader | Extensions | Notes |
|--------|-----------|-------|
| `TextLoader` | `.txt`, `.md`, `.csv`, `.json`, `.log` | Plain text |
| `PDFLoader` | `.pdf` | Extracts text via pdf-parse |
| `DOCXLoader` | `.docx` | Extracts text via mammoth |
| `HTMLLoader` | `.html`, `.htm` | Strips scripts/styles, extracts content |

The `LoaderRegistry` auto-detects the right loader by file extension. Register custom loaders for additional formats:

```typescript
import { LoaderRegistry } from '@glyph/core';

const registry = new LoaderRegistry();
registry.register(new MyCustomLoader());
```

### Text Chunkers

Three chunking strategies:

| Chunker | Strategy | Best For |
|---------|----------|----------|
| `RecursiveChunker` | Splits by paragraphs, then sentences, then words | General purpose (default) |
| `FixedChunker` | Exact character boundaries | Uniform chunk sizes |
| `SentenceChunker` | Sentence boundary detection | Preserving sentence integrity |

### Ingestion Pipeline

The `IngestionPipeline` orchestrates the full flow: load, chunk, embed, upsert.

```typescript
const stats = await client.ingest(['docs/*.pdf'], 'my-collection', {
  chunkSize: 500,
  chunkOverlap: 50,
  metadata: { project: 'acme' },
  onProgress: (info) => console.log(`${info.stage}: ${info.documentsProcessed}/${info.totalDocuments}`)
});

console.log(`Ingested ${stats.documentsSucceeded} docs, ${stats.chunksUpserted} chunks`);
```

The pipeline automatically extracts vertical metadata (`__v_doc_id`, `__v_source`, `__v_doc_type`) from each document's file path.

---

## Retrieval

### Basic Retrieval

```typescript
const result = await client.retrieve('pricing information', {
  collection: 'contracts',
  topK: 20
});

for (const record of result.records) {
  console.log(record.text, record.score);
}
```

### Filter Shorthands

Instead of constructing filter objects manually, use the `partition` and `theme` shorthands:

```typescript
// These are equivalent:
await client.retrieve('query', { partition: 'finance' });
await client.retrieve('query', {
  filter: { field: '__v_partition', op: 'eq', value: 'finance' }
});
```

### Custom Filters

The universal filter language works across all adapters:

```typescript
import type { UniversalFilter } from '@glyph/core';

// Simple condition
const filter: UniversalFilter = { field: 'year', op: 'gte', value: 2023 };

// Compound filters
const compound: UniversalFilter = {
  and: [
    { field: '__v_partition', op: 'eq', value: 'legal' },
    { or: [
      { field: '__h_theme', op: 'eq', value: 'pricing' },
      { field: '__h_theme', op: 'eq', value: 'terms' }
    ]}
  ]
};

await client.retrieve('query', { filter: compound });
```

Available operators: `eq`, `neq`, `in`, `nin`, `gt`, `gte`, `lt`, `lte`, `contains`, `exists`.

### Grouped Retrieval

Group results by document or theme:

```typescript
// Group by document — useful for cross-document comparison
const byDoc = await client.retrieve('pricing', { groupBy: 'document' });

// Group by theme — useful for thematic analysis
const byTheme = await client.retrieve('pricing', { groupBy: 'theme' });
```

---

## Enrichment

Enrichment adds metadata to existing vectors *without* re-uploading embeddings. Three enrichment types:

### Vertical Enrichment

Classify documents into business verticals (e.g., finance, healthcare, legal):

```typescript
await client.enrich('my-collection', {
  vertical: {
    // Option 1: Field mapping
    mapping: { sourceField: '__v_source', rules: { 'finance': 'finance', 'legal': 'legal' } },

    // Option 2: Custom extractor
    extractor: async (record) => ({ partition: detectPartition(record) }),

    // Option 3: Automatic (LLM-based)
    automatic: { llm: myLLM, categories: ['finance', 'legal', 'healthcare'] }
  }
});
```

### Theme Enrichment

Tag chunks with thematic labels:

```typescript
await client.enrich('my-collection', {
  theme: {
    themes: ['pricing', 'coverage', 'exclusions', 'claims'],
    method: 'keyword',  // or 'zero-shot', 'embedding', 'llm'
    classifier: myClassifier  // Optional custom classifier
  }
});
```

Available classifiers:
- **KeywordClassifier** — Fast keyword matching
- **ZeroShotClassifier** — HuggingFace transformers.js
- **EmbeddingClassifier** — Cosine similarity with theme embeddings
- **LLMClassifier** — LLM-based classification

### Section Enrichment

Detect document structure (headings, sections):

```typescript
await client.enrich('my-collection', {
  section: {
    detectFromText: true,  // Auto-detect headings
    // or: existingSectionField: 'heading'
  }
});
```

---

## Full RAG Query

Combines retrieval + LLM generation. Requires an `LLMClient` in the constructor:

```typescript
const response = await client.query('What exclusions apply to flood damage?', {
  collection: 'policies',
  topK: 10,
  partition: 'insurance',
  theme: 'exclusions',
  temperature: 0.3,
  maxTokens: 500,
  systemPrompt: 'You are an insurance policy analyst. Answer based on the provided context.'
});

console.log(response.answer);       // LLM-generated answer
console.log(response.sources);      // VectorRecord[] used as context
console.log(response.query);        // Original question
```

---

## Adapters

### Available Adapters

| Package | Database | Install |
|---------|----------|---------|
| `@glyph/adapter-chroma` | ChromaDB | `npm install @glyph/adapter-chroma` |
| `@glyph/adapter-pinecone` | Pinecone | `npm install @glyph/adapter-pinecone` |
| `@glyph/adapter-turbopuffer` | Turbopuffer | `npm install @glyph/adapter-turbopuffer` |

### Writing a Custom Adapter

Extend `VectorDBAdapter` and implement all abstract methods:

```typescript
import { VectorDBAdapter } from '@glyph/core';

class MyAdapter extends VectorDBAdapter {
  async connect(): Promise<void> { /* ... */ }
  async disconnect(): Promise<void> { /* ... */ }
  async isConnected(): Promise<boolean> { /* ... */ }
  async createCollection(name: string, dimension: number, metric?: DistanceMetric): Promise<void> { /* ... */ }
  async deleteCollection(name: string): Promise<void> { /* ... */ }
  async collectionExists(name: string): Promise<boolean> { /* ... */ }
  async getCollectionStats(name: string): Promise<CollectionStats> { /* ... */ }
  async upsert(collection: string, records: VectorRecord[]): Promise<void> { /* ... */ }
  async fetch(collection: string, ids: string[]): Promise<VectorRecord[]> { /* ... */ }
  async delete(collection: string, ids: string[]): Promise<void> { /* ... */ }
  async updateMetadata(collection: string, updates: MetadataUpdate[]): Promise<void> { /* ... */ }
  async search(collection: string, queryVector: number[], options?: any): Promise<SearchResult> { /* ... */ }
  translateFilter(filter: UniversalFilter): any { /* ... */ }
  async *iterate(collection: string, options?: any): AsyncIterableIterator<VectorRecord[]> { /* ... */ }
}
```

### Embedder and LLM Abstractions

Implement `Embedder` for custom embedding models:

```typescript
import { Embedder } from '@glyph/core';

class OpenAIEmbedder extends Embedder {
  constructor() { super(); }
  get dimensions(): number { return 1536; }
  get modelName(): string { return 'text-embedding-3-small'; }
  async embed(text: string): Promise<number[]> { /* Call OpenAI API */ }
  async embedBatch(texts: string[]): Promise<number[][]> { /* Batch call */ }
}
```

Implement `LLMClient` for custom LLM providers:

```typescript
import { LLMClient } from '@glyph/core';

class OpenAIClient extends LLMClient {
  constructor() { super(); }
  get modelName(): string { return 'gpt-4'; }
  get provider(): string { return 'openai'; }
  async generate(prompt: string, options?: GenerateOptions): Promise<string> { /* Call OpenAI API */ }
  async generateJSON<T>(prompt: string, options?: GenerateOptions): Promise<T> { /* JSON mode */ }
  async generateBatch(prompts: string[], options?: GenerateOptions): Promise<string[]> { /* Batch */ }
}
```

---

## API Reference

For complete API documentation generated from source code, see the [TypeDoc API Reference](api/index.html).
