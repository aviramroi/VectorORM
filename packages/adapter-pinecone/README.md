# @vectororm/adapter-pinecone

[![npm](https://img.shields.io/npm/v/@vectororm/adapter-pinecone)](https://www.npmjs.com/package/@vectororm/adapter-pinecone)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[Pinecone](https://www.pinecone.io/) adapter for [Glyph VectorORM](https://github.com/aviramroi/VectorORM).

## Installation

```bash
npm install @vectororm/core @vectororm/adapter-pinecone
```

## Prerequisites

A Pinecone account and API key. Set up at [pinecone.io](https://www.pinecone.io/).

## Usage

### Standalone Adapter

```typescript
import { PineconeAdapter } from '@vectororm/adapter-pinecone';

const adapter = new PineconeAdapter({
  apiKey: process.env.PINECONE_API_KEY!,
  environment: 'us-east-1-aws'
});

await adapter.connect();

// Create an index
await adapter.createCollection('my-index', 1536, 'cosine');

// Upsert vectors
await adapter.upsert('my-index', [
  {
    id: 'doc-1',
    embedding: [0.1, 0.2, ...],
    metadata: { title: 'My Document', __v_partition: 'finance' },
    text: 'Document content...'
  }
]);

// Search with filters
const results = await adapter.search('my-index', queryVector, {
  topK: 10,
  filter: { field: '__v_partition', op: 'eq', value: 'finance' }
});
```

### With RAGClient

```typescript
import { RAGClient } from '@vectororm/core';
import { PineconeAdapter } from '@vectororm/adapter-pinecone';

const client = new RAGClient({
  adapter: new PineconeAdapter({
    apiKey: process.env.PINECONE_API_KEY!,
    environment: 'us-east-1-aws'
  }),
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
interface PineconeConfig {
  apiKey: string;       // Required: Pinecone API key
  environment: string;  // Required: Pinecone environment (e.g., 'us-east-1-aws')
}
```

Environment variable fallbacks: `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT`.

## Features

- Full CRUD operations (upsert, fetch, delete)
- Metadata filtering with Pinecone-native filter translation (`$eq`, `$in`, `$gt`, etc.)
- Index management (create, delete, exists, stats)
- Namespace support for multi-tenant isolation
- Paginated iteration for enrichment pipelines

## Documentation

- [API Guide](https://github.com/aviramroi/VectorORM/blob/main/docs/guide.md)
- [Full Project](https://github.com/aviramroi/VectorORM)

## License

Apache-2.0
