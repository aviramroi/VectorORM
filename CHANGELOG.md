# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 — 2026-02-07

Initial release of VectorORM.

### Core (`@vectororm/core`)

- **Type System** — VectorRecord, SearchResult, MetadataBuilder with three metadata axes (Vertical, Horizontal, Structural)
- **VectorDBAdapter** — Abstract base class for database-agnostic vector operations
- **Universal Filter Language** — FilterCondition, AndFilter, OrFilter with FilterTranslator
- **Embedder** — Abstract embedding model interface
- **LLM Client** — Abstract LLM interface with MockLLM for testing
- **Query Composition** — RAGQueryComposer with FilterBuilder, grouped retrieval (by document/theme)
- **Enrichment Pipeline** — Vertical, theme, and section enrichment with keyword, zero-shot, embedding, and LLM classifiers
- **Ingestion Pipeline** — Document loaders (Text, PDF, DOCX, HTML), chunkers (Recursive, Fixed, Sentence), pipeline orchestrator with progress callbacks
- **RAGClient** — Unified facade tying together adapter, embedder, LLM, ingestion, enrichment, and query

### Adapters

- **`@vectororm/adapter-chroma`** — ChromaDB adapter with full CRUD, search, filter translation, and iteration
- **`@vectororm/adapter-pinecone`** — Pinecone adapter with namespace support, pagination, and filter translation
- **`@vectororm/adapter-turbopuffer`** — Turbopuffer adapter with full vector operations and filter translation

### Documentation

- API guide (`docs/guide.md`)
- TypeDoc configuration for auto-generated API reference
- Working examples: insurance, legal contracts, vendor comparison
- Full insurance demo mini-project with ChromaDB
