/**
 * ChromaDB Adapter Example
 *
 * Shows how to use Glyph VectorORM with ChromaDB:
 * 1. Configure the ChromaAdapter
 * 2. Create a RAGClient
 * 3. Ingest, retrieve, and query
 *
 * Prerequisites: docker run -p 8000:8000 chromadb/chroma
 *
 * Run: npx tsx examples/adapter-chroma.ts
 */
import * as path from 'path';
import { RAGClient } from '../packages/core/src/client/rag-client';
import { MockLLM } from '../packages/core/src/llm/mock-llm';
import { SimpleEmbedder } from './helpers/mock-embedder';

// In a real app, you would import from the published packages:
//   import { RAGClient } from '@glyph/core';
//   import { ChromaAdapter } from '@glyph/adapter-chroma';

// For this example, we use the InMemoryAdapter to avoid requiring a running Chroma instance.
// Replace with ChromaAdapter for real usage.
import { InMemoryAdapter } from './helpers/mock-adapter';

async function main() {
  console.log('=== Glyph VectorORM — ChromaDB Adapter Example ===\n');

  // ── Configuration ─────────────────────────────────────────────────────
  // Real ChromaDB configuration:
  //
  //   import { ChromaAdapter } from '@glyph/adapter-chroma';
  //
  //   const adapter = new ChromaAdapter({
  //     host: 'localhost',       // Chroma server host
  //     port: 8000,              // Chroma server port
  //     // apiKey: '...',        // Optional: for Chroma Cloud
  //     // ssl: true,            // Optional: enable HTTPS
  //     // tenant: 'default',    // Optional: multi-tenancy
  //     // database: 'default',  // Optional: database name
  //   });
  //
  // Environment variable fallbacks:
  //   CHROMA_HOST, CHROMA_PORT, CHROMA_API_KEY, CHROMA_SSL

  const adapter = new InMemoryAdapter(); // Replace with ChromaAdapter above
  const embedder = new SimpleEmbedder();
  const llm = new MockLLM();

  const client = new RAGClient({
    adapter,
    embedder,
    llm,
    defaultCollection: 'chroma-demo',
    defaultTopK: 5
  });

  // ── Create collection ─────────────────────────────────────────────────
  await client.createCollection('chroma-demo');
  console.log('Created collection "chroma-demo"\n');

  // ── Ingest documents ──────────────────────────────────────────────────
  const fixturesDir = path.join(__dirname, 'fixtures');
  const stats = await client.ingest(
    [
      path.join(fixturesDir, 'auto-policy.txt'),
      path.join(fixturesDir, 'home-policy.txt')
    ]
  );
  console.log(`Ingested ${stats.documentsSucceeded} documents, ${stats.chunksUpserted} chunks\n`);

  // ── Retrieve ──────────────────────────────────────────────────────────
  console.log('--- Retrieval: "coverage limits" ---');
  const result = await client.retrieve('coverage limits and deductibles');
  for (const record of result.records.slice(0, 3)) {
    const source = path.basename(String(record.metadata['__v_source'] || ''));
    console.log(`  [${(record.score ?? 0).toFixed(3)}] ${source}`);
  }

  // ── Full RAG query ────────────────────────────────────────────────────
  console.log('\n--- Full RAG Query ---');
  llm.setResponse('The auto policy has a $500 collision deductible and $250 comprehensive deductible. The home policy has a $1,000 dwelling deductible.');

  const response = await client.query('What are the deductibles?');
  console.log(`  Answer: ${response.answer}\n`);

  // ── Cleanup ───────────────────────────────────────────────────────────
  await client.deleteCollection('chroma-demo');
  console.log('Cleaned up. Done!');
}

main().catch(console.error);
