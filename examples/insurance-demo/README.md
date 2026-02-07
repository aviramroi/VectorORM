# Insurance Policy RAG Demo

A complete end-to-end demo of VectorORM using insurance policy documents. Shows ingestion, enrichment, retrieval, and full RAG query capabilities.

## What This Demo Shows

- **Ingestion**: Loading `.txt` policy documents, chunking, embedding, and upserting into ChromaDB
- **Enrichment**: Classifying chunks by theme (coverage, exclusions, claims, pricing) using keyword classification
- **Retrieval**: Semantic search with theme filters, document grouping, and filter shorthands
- **Full RAG**: Combining retrieval with LLM generation to answer policy questions

## Sample Data

Three insurance policies in `data/`:

| File | Policy Type | Key Topics |
|------|------------|------------|
| `auto-policy.txt` | Auto Insurance | Collision, comprehensive, liability |
| `home-policy.txt` | Home Insurance | Dwelling, personal property, liability |
| `life-policy.txt` | Life Insurance | Death benefit, convertibility, accelerated benefit |

## Prerequisites

1. **ChromaDB** running locally:
   ```bash
   docker run -p 8000:8000 chromadb/chroma
   ```

2. **Node.js** >= 18.0.0

## Setup

```bash
cd examples/insurance-demo
npm install
```

## Running

Run the full pipeline (ingest, enrich, query):

```bash
npm start
```

Or run individual steps:

```bash
npm run ingest   # Load and ingest documents
npm run enrich   # Add theme metadata
npm run query    # Run sample queries
```

## Customization

### Use a Real Embedder

Edit `src/setup.ts` and replace `DemoEmbedder` with your embedder implementation:

```typescript
import { OpenAIEmbedder } from './my-embedder';

// In createClient():
const embedder = new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY });
```

### Use a Real LLM

Replace `DemoLLM` in `src/setup.ts`:

```typescript
import { OpenAIClient } from './my-llm';

// In createClient():
const llm = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4' });
```

### Swap the Vector Database

Replace ChromaAdapter with any VectorORM adapter:

```typescript
import { PineconeAdapter } from '@vectororm/adapter-pinecone';

const adapter = new PineconeAdapter({ apiKey: process.env.PINECONE_API_KEY });
```

## Expected Output

```
╔══════════════════════════════════════════════════════════╗
║   VectorORM — Insurance Policy Demo                    ║
╚══════════════════════════════════════════════════════════╝

┌── Step 1: Ingest ──────────────────────────────────────┐
Ingesting policy documents...
  Documents processed: 3
  Documents succeeded: 3
  Chunks created:      ~12
  Chunks upserted:     ~12
└───────────────────────────────────────────────────────┘

┌── Step 2: Enrich ──────────────────────────────────────┐
Enriching collection with themes...
  Records processed: ~12
  Records updated:   ~12
└───────────────────────────────────────────────────────┘

┌── Step 3: Query ───────────────────────────────────────┐
=== 1. Basic Retrieval: "exclusions for flood damage" ===
  [0.95] home-policy.txt (theme: exclusions)
    ...flood damage (requires separate flood policy)...

=== 4. Full RAG Query ===
  Question: What are the key differences...?
  Answer: [Generated comparison of auto, home, and life policies]
└───────────────────────────────────────────────────────┘
```
