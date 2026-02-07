/**
 * Pinecone Adapter Example
 *
 * Shows how to use VectorORM with Pinecone:
 * 1. Configure the PineconeAdapter
 * 2. Create a RAGClient
 * 3. Ingest, retrieve, and query
 *
 * Prerequisites: A Pinecone account and API key (https://pinecone.io)
 *
 * Run: PINECONE_API_KEY=... npx tsx examples/adapter-pinecone.ts
 */
import * as path from 'path';
import { RAGClient } from '../packages/core/src/client/rag-client';
import { MockLLM } from '../packages/core/src/llm/mock-llm';
import { SimpleEmbedder } from './helpers/mock-embedder';

// In a real app:
//   import { RAGClient } from '@vectororm/core';
//   import { PineconeAdapter } from '@vectororm/adapter-pinecone';

import { InMemoryAdapter } from './helpers/mock-adapter';

async function main() {
  console.log('=== VectorORM — Pinecone Adapter Example ===\n');

  // ── Configuration ─────────────────────────────────────────────────────
  // Real Pinecone configuration:
  //
  //   import { PineconeAdapter } from '@vectororm/adapter-pinecone';
  //
  //   const adapter = new PineconeAdapter({
  //     apiKey: process.env.PINECONE_API_KEY!,
  //     environment: 'us-east-1-aws',  // Your Pinecone environment
  //   });
  //
  //   await adapter.connect();
  //
  // Environment variable fallbacks:
  //   PINECONE_API_KEY, PINECONE_ENVIRONMENT
  //
  // Note: Pinecone indexes are created via the Pinecone console or API.
  // The createCollection() call maps to index creation.

  const adapter = new InMemoryAdapter(); // Replace with PineconeAdapter above
  const embedder = new SimpleEmbedder();
  const llm = new MockLLM();

  const client = new RAGClient({
    adapter,
    embedder,
    llm,
    defaultCollection: 'pinecone-demo',
    defaultTopK: 5
  });

  // ── Create index ──────────────────────────────────────────────────────
  await client.createCollection('pinecone-demo');
  console.log('Created index "pinecone-demo"\n');

  // ── Ingest documents ──────────────────────────────────────────────────
  const fixturesDir = path.join(__dirname, 'fixtures');
  const stats = await client.ingest(
    [
      path.join(fixturesDir, 'contract-a.txt'),
      path.join(fixturesDir, 'contract-b.txt')
    ]
  );
  console.log(`Ingested ${stats.documentsSucceeded} documents, ${stats.chunksUpserted} chunks\n`);

  // ── Retrieve with filters ─────────────────────────────────────────────
  // Pinecone translates UniversalFilter to its native format:
  //   { field: 'x', op: 'eq', value: 'y' } → { x: { $eq: 'y' } }
  console.log('--- Retrieval: "SLA and uptime" ---');
  const result = await client.retrieve('SLA uptime guarantees');
  for (const record of result.records.slice(0, 3)) {
    const source = path.basename(String(record.metadata['__v_source'] || ''));
    console.log(`  [${(record.score ?? 0).toFixed(3)}] ${source}`);
  }

  // ── Grouped by document ───────────────────────────────────────────────
  console.log('\n--- Grouped by Document: "payment terms" ---');
  const grouped = await client.retrieve('payment terms and pricing', { groupBy: 'document' });
  console.log(`  ${grouped.records.length} results across documents`);

  // ── Full RAG query ────────────────────────────────────────────────────
  console.log('\n--- Full RAG Query ---');
  llm.setResponse('Contract A requires payment within 30 days at $15,000/month. Contract B requires payment within 45 days at $28,000/month.');

  const response = await client.query('Compare payment terms between the contracts');
  console.log(`  Answer: ${response.answer}\n`);

  // ── Cleanup ───────────────────────────────────────────────────────────
  await client.deleteCollection('pinecone-demo');
  console.log('Cleaned up. Done!');
}

main().catch(console.error);
