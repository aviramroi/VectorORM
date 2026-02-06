# @glyph/core

[![npm](https://img.shields.io/npm/v/@glyph/core)](https://www.npmjs.com/package/@glyph/core)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Core package for [Glyph VectorORM](https://github.com/aviramroi/VectorORM) — a TypeScript-first vector ORM with Vertical and Horizontal RAG.

Includes the abstract adapter base class, universal filter language, metadata builders, ingestion pipeline, enrichment pipeline, query composition layer, and the unified RAGClient facade.

## Installation

```bash
npm install @glyph/core
```

## Usage

```typescript
import { RAGClient, MetadataBuilder, KeywordThemeClassifier } from '@glyph/core';
import { ChromaAdapter } from '@glyph/adapter-chroma';

// Create client with your adapter, embedder, and optional LLM
const client = new RAGClient({
  adapter: new ChromaAdapter({ host: 'localhost', port: 8000 }),
  embedder: myEmbedder,
  llm: myLLM,
  defaultCollection: 'docs'
});

// Ingest documents
await client.createCollection('docs');
await client.ingest(['contracts/*.pdf'], 'docs');

// Enrich with themes
await client.enrich('docs', {
  themes: {
    themes: ['pricing', 'legal', 'technical'],
    classifier: new KeywordThemeClassifier(
      ['pricing', 'legal', 'technical'],
      { pricing: ['cost', 'price', 'fee'], legal: ['liability', 'clause'], technical: ['api', 'sdk'] }
    )
  }
});

// Retrieve with filter shorthands
const result = await client.retrieve('pricing terms', {
  partition: 'finance',
  theme: 'pricing',
  topK: 10
});

// Full RAG query
const response = await client.query('What are the pricing terms?');
console.log(response.answer);
```

## What's Included

- **VectorDBAdapter** — Abstract base class for database adapters
- **Embedder / LLMClient** — Abstract classes for embedding models and LLMs
- **Universal Filter Language** — Database-agnostic filter conditions (`eq`, `neq`, `in`, `gt`, `contains`, etc.)
- **MetadataBuilder** — Type-safe builder for vertical, horizontal, and structural metadata
- **Ingestion Pipeline** — Document loaders (Text, PDF, DOCX, HTML), chunkers (Recursive, Fixed, Sentence)
- **Enrichment Pipeline** — Keyword, zero-shot, embedding, and LLM-based classifiers
- **RAGQueryComposer** — Retrieval with grouped results (by document or theme)
- **RAGClient** — Unified facade for all operations

## Documentation

- [API Guide](https://github.com/aviramroi/VectorORM/blob/main/docs/guide.md)
- [Full Project](https://github.com/aviramroi/VectorORM)

## License

Apache-2.0
