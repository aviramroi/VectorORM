# VectorORM Cookbooks

Runnable end-to-end examples demonstrating real VectorORM usage patterns.

Unlike the `examples/` directory (which uses in-memory mocks), these cookbooks connect to **real vector databases** and demonstrate production-ready patterns.

## Prerequisites

```bash
# From the repo root
npm install
npm run build
```

## Cookbooks

| Cookbook | Database | What It Shows |
|---------|----------|---------------|
| [Turbopuffer Quickstart](./turbopuffer-quickstart.ts) | Turbopuffer | Connect, upsert, search, filter, cleanup |
| [Turbopuffer RAG Pipeline](./turbopuffer-rag-pipeline.ts) | Turbopuffer | Full ingest → enrich → retrieve → RAG query |
| [Multi-Adapter Comparison](./multi-adapter-comparison.ts) | In-Memory | Same operations across adapters (no credentials needed) |

## Running

Each cookbook is a standalone TypeScript file. Set the required environment variables and run:

```bash
# Turbopuffer cookbooks (need API key)
TURBOPUFFER_API_KEY=your-key npx tsx cookbooks/turbopuffer-quickstart.ts
TURBOPUFFER_API_KEY=your-key npx tsx cookbooks/turbopuffer-rag-pipeline.ts

# Multi-adapter comparison (no credentials needed)
npx tsx cookbooks/multi-adapter-comparison.ts
```

## Environment Variables

| Variable | Required For | Description |
|----------|-------------|-------------|
| `TURBOPUFFER_API_KEY` | Turbopuffer cookbooks | Your Turbopuffer API key |
| `TURBOPUFFER_REGION` | Optional | Region (e.g. `aws-us-east-1`). Default: `api` |
