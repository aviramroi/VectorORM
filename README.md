# Glyph VectorORM

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/aviramroi/VectorORM/actions/workflows/ci.yml/badge.svg)](https://github.com/aviramroi/VectorORM/actions/workflows/ci.yml)

A TypeScript-first vector ORM that brings database abstraction and ORM-like patterns to vector databases. Glyph introduces **Vertical RAG** (document-level filtering) and **Horizontal RAG** (theme/section-level filtering) as first-class concepts.

## Features

- **Database Agnostic** — Write once, run on any vector database (Pinecone, ChromaDB, Turbopuffer)
- **Vertical RAG** — Filter by document identity: partition, doc ID, source, tags
- **Horizontal RAG** — Filter by content themes, sections, and structural position
- **Ingestion Pipeline** — Load PDFs, DOCX, HTML, and text files with automatic chunking and embedding
- **Enrichment Pipeline** — Retrofit existing vector databases with V/H metadata using keyword, embedding, zero-shot, or LLM classifiers
- **Full RAG Query** — Retrieve context and generate answers with any LLM in a single call
- **Type-Safe** — TypeScript strict mode throughout, with full type exports

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@glyph/core`](packages/core) | Core abstractions, ingestion, enrichment, query, and RAGClient | `npm install @glyph/core` |
| [`@glyph/adapter-chroma`](packages/adapter-chroma) | ChromaDB adapter | `npm install @glyph/adapter-chroma` |
| [`@glyph/adapter-pinecone`](packages/adapter-pinecone) | Pinecone adapter | `npm install @glyph/adapter-pinecone` |
| [`@glyph/adapter-turbopuffer`](packages/adapter-turbopuffer) | Turbopuffer adapter | `npm install @glyph/adapter-turbopuffer` |

## Quick Start

```bash
npm install @glyph/core @glyph/adapter-chroma
```

```typescript
import { RAGClient } from '@glyph/core';
import { ChromaAdapter } from '@glyph/adapter-chroma';

const client = new RAGClient({
  adapter: new ChromaAdapter({ host: 'localhost', port: 8000 }),
  embedder: myEmbedder,
  llm: myLLM,
  defaultCollection: 'docs'
});

// Ingest documents
await client.createCollection('docs');
await client.ingest(['contracts/*.pdf', 'policies/*.txt'], 'docs');

// Retrieve with Vertical/Horizontal filters
const result = await client.retrieve('pricing terms', {
  partition: 'finance',     // Vertical filter shorthand
  theme: 'pricing',         // Horizontal filter shorthand
  topK: 10
});

// Full RAG query
const response = await client.query('What are the pricing terms?');
console.log(response.answer);
console.log(response.sources); // Retrieved chunks used as context
```

## Three Metadata Axes

Glyph organizes vector metadata along three axes:

| Axis | Prefix | Purpose | Example |
|------|--------|---------|---------|
| **Vertical** | `__v_` | Document-level identity | `__v_partition: "finance"` |
| **Horizontal** | `__h_` | Content classification | `__h_theme: "pricing"` |
| **Structural** | `__s_` | Position & hierarchy | `__s_chunk_index: 3` |

## Examples

See the [`examples/`](examples/) directory for working demos:

- **[Insurance Basics](examples/insurance-basics.ts)** — Vertical/Horizontal RAG with policy documents
- **[Legal Contracts](examples/legal-contracts.ts)** — Cross-document comparison and section retrieval
- **[Vendor Comparison](examples/vendor-comparison.ts)** — Side-by-side vendor analysis with groupBy
- **[Chroma Adapter](examples/adapter-chroma.ts)** — Using Glyph with ChromaDB
- **[Pinecone Adapter](examples/adapter-pinecone.ts)** — Using Glyph with Pinecone
- **[Turbopuffer Adapter](examples/adapter-turbopuffer.ts)** — Using Glyph with Turbopuffer
- **[Insurance Demo](examples/insurance-demo/)** — Full end-to-end mini-project with ChromaDB

All standalone examples run with `npx tsx examples/<name>.ts` using in-memory mocks (no external services required). Adapter examples show real configuration patterns.

## Documentation

- **[API Guide](docs/guide.md)** — Comprehensive reference covering all major APIs
- **[API Reference](docs/api/)** — Auto-generated TypeDoc documentation (`npm run docs:generate`)

## Development

```bash
# Clone and install
git clone https://github.com/aviramroi/VectorORM.git
cd VectorORM
npm install

# Run tests
npm test

# Lint (TypeScript type check)
npm run lint

# Build all packages
npm run build

# Generate API docs
npm run docs:generate
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.

## License

Licensed under the [Apache License 2.0](LICENSE).
