# Phase 7: TypeDoc API Documentation & Working Examples

**Date:** 2026-02-06
**Status:** Approved for Implementation

## Overview

Complete the remaining success criteria: TypeDoc API documentation and working examples for insurance, legal, and vendor comparison use cases.

## 1. TypeDoc Configuration

- Install `typedoc` as root dev dependency
- `typedoc.json` config at root pointing at `packages/core/src/index.ts`
- `entryPointStrategy: "expand"` to follow public export tree
- Output to `docs/api/`
- Add `docs:generate` script at root, wire into turbo pipeline
- Default theme, no plugins

## 2. Hand-Written API Guide

Single file `docs/guide.md` covering:
- Quick start (install, create client, first query)
- Core concepts (vertical/horizontal/structural metadata)
- Ingestion (loaders, chunkers, pipeline)
- Retrieval (filters, shorthands, groupBy)
- Enrichment (vertical, theme, section strategies)
- Full RAG query
- Adapter configuration

Reference-style, not tutorial. Each section shows types + short code snippet.

## 3. Standalone Example Scripts

Three scripts in `examples/` using mocks (no external services required):

### Shared helpers
- `examples/helpers/mock-adapter.ts` — In-memory VectorDBAdapter for examples
- `examples/fixtures/*.txt` — Small text files for each use case

### Scripts
- `examples/insurance-basics.ts` — V/H RAG flow: ingest policies, enrich with partition + themes (coverage, exclusions, claims, pricing), retrieve with shorthands, full RAG query
- `examples/legal-contracts.ts` — Section enrichment, filtered retrieval within sections, cross-document comparison with groupBy
- `examples/vendor-comparison.ts` — GroupBy document for side-by-side vendor comparison, custom filters

All runnable via `npx tsx examples/<name>.ts`.

## 4. Full Mini-Project (Insurance Demo)

```
examples/insurance-demo/
├── package.json
├── tsconfig.json
├── README.md
├── data/
│   ├── auto-policy.txt
│   ├── home-policy.txt
│   └── life-policy.txt
├── src/
│   ├── setup.ts
│   ├── ingest.ts
│   ├── enrich.ts
│   ├── query.ts
│   └── index.ts
└── .env.example
```

Uses `@glyph/core` + `@glyph/adapter-chroma` as real dependencies. README explains setup (Chroma via Docker), what it demonstrates, and expected output.

## Out of Scope

- CI/CD integration for doc generation
- Custom TypeDoc theme or plugins
- npm publishing setup
- Docker compose for insurance demo
