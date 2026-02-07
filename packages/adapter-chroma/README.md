# @vectororm/adapter-chroma

[![npm](https://img.shields.io/npm/v/@vectororm/adapter-chroma)](https://www.npmjs.com/package/@vectororm/adapter-chroma)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[ChromaDB](https://www.trychroma.com/) adapter for [Glyph VectorORM](https://github.com/aviramroi/VectorORM).

## Installation

```bash
npm install @vectororm/core @vectororm/adapter-chroma
```

## Prerequisites

ChromaDB running locally or accessible via network:

```bash
docker run -p 8000:8000 chromadb/chroma
```

## Usage

### Standalone Adapter

```typescript
import { ChromaAdapter } from '@vectororm/adapter-chroma';

const adapter = new ChromaAdapter({
  host: 'localhost',
  port: 8000
});

await adapter.connect();

// Create a collection
await adapter.createCollection('my-docs', 1536, 'cosine');

// Upsert vectors
await adapter.upsert('my-docs', [
  {
    id: 'doc-1',
    embedding: [0.1, 0.2, ...],
    metadata: { title: 'My Document', __v_partition: 'finance' },
    text: 'Document content...'
  }
]);

// Search with filters
const results = await adapter.search('my-docs', queryVector, {
  topK: 10,
  filter: { field: '__v_partition', op: 'eq', value: 'finance' }
});
```

### With RAGClient

```typescript
import { RAGClient } from '@vectororm/core';
import { ChromaAdapter } from '@vectororm/adapter-chroma';

const client = new RAGClient({
  adapter: new ChromaAdapter({ host: 'localhost', port: 8000 }),
  embedder: myEmbedder,
  llm: myLLM,
  defaultCollection: 'docs'
});

await client.createCollection('docs');
await client.ingest(['documents/*.pdf'], 'docs');
const result = await client.retrieve('search query');
```

## Configuration

```typescript
interface ChromaConfig {
  host?: string;     // Default: 'localhost'
  port?: number;     // Default: 8000
  apiKey?: string;   // Optional, for Chroma Cloud
  ssl?: boolean;     // Default: false for localhost
  tenant?: string;   // Optional multi-tenancy
  database?: string; // Optional database name
}
```

Environment variable fallbacks: `CHROMA_HOST`, `CHROMA_PORT`, `CHROMA_API_KEY`, `CHROMA_SSL`.

## Features

- Full CRUD operations (upsert, fetch, delete)
- Metadata filtering with Glyph universal filter translation
- Collection management (create, delete, exists, stats)
- Batch iteration for enrichment pipelines
- Metadata updates without re-uploading vectors

## Documentation

- [API Guide](https://github.com/aviramroi/VectorORM/blob/main/docs/guide.md)
- [Full Project](https://github.com/aviramroi/VectorORM)

## License

Apache-2.0
