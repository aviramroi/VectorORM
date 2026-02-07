/**
 * Turbopuffer Adapter Example
 *
 * Shows how to use VectorORM with Turbopuffer:
 * 1. Configure the TurbopufferAdapter
 * 2. Create a RAGClient
 * 3. Ingest, retrieve, and query
 *
 * Prerequisites: A Turbopuffer account and API key (https://turbopuffer.com)
 *
 * Run: TURBOPUFFER_API_KEY=... npx tsx examples/adapter-turbopuffer.ts
 */
import * as path from 'path';
import { RAGClient } from '../packages/core/src/client/rag-client';
import { MockLLM } from '../packages/core/src/llm/mock-llm';
import { SimpleEmbedder } from './helpers/mock-embedder';

// In a real app:
//   import { RAGClient } from '@vectororm/core';
//   import { TurbopufferAdapter } from '@vectororm/adapter-turbopuffer';

import { InMemoryAdapter } from './helpers/mock-adapter';

async function main() {
  console.log('=== VectorORM — Turbopuffer Adapter Example ===\n');

  // ── Configuration ─────────────────────────────────────────────────────
  // Real Turbopuffer configuration:
  //
  //   import { TurbopufferAdapter } from '@vectororm/adapter-turbopuffer';
  //
  //   const adapter = new TurbopufferAdapter({
  //     apiKey: process.env.TURBOPUFFER_API_KEY!,
  //     // baseUrl: 'https://api.turbopuffer.com', // Optional: custom endpoint
  //   });
  //
  //   await adapter.connect();
  //
  // Environment variable fallbacks:
  //   TURBOPUFFER_API_KEY
  //
  // Note: Turbopuffer uses "namespaces" — VectorORM maps collections to namespaces.
  // No SDK dependency — uses REST API directly (Node 18+ fetch).

  const adapter = new InMemoryAdapter(); // Replace with TurbopufferAdapter above
  const embedder = new SimpleEmbedder();
  const llm = new MockLLM();

  const client = new RAGClient({
    adapter,
    embedder,
    llm,
    defaultCollection: 'turbopuffer-demo',
    defaultTopK: 5
  });

  // ── Create namespace ──────────────────────────────────────────────────
  await client.createCollection('turbopuffer-demo');
  console.log('Created namespace "turbopuffer-demo"\n');

  // ── Ingest documents ──────────────────────────────────────────────────
  const fixturesDir = path.join(__dirname, 'fixtures');
  const stats = await client.ingest(
    [
      path.join(fixturesDir, 'vendor-proposal-alpha.txt'),
      path.join(fixturesDir, 'vendor-proposal-beta.txt')
    ]
  );
  console.log(`Ingested ${stats.documentsSucceeded} documents, ${stats.chunksUpserted} chunks\n`);

  // ── Retrieve ──────────────────────────────────────────────────────────
  // Turbopuffer filter translation:
  //   { field: 'x', op: 'eq', value: 'y' } → ['x', 'Eq', 'y']
  console.log('--- Retrieval: "pricing and costs" ---');
  const result = await client.retrieve('pricing costs annual budget');
  for (const record of result.records.slice(0, 3)) {
    const source = path.basename(String(record.metadata['__v_source'] || ''));
    console.log(`  [${(record.score ?? 0).toFixed(3)}] ${source}`);
  }

  // ── Grouped by document ───────────────────────────────────────────────
  console.log('\n--- Grouped by Document: "technical approach" ---');
  const grouped = await client.retrieve('technical approach architecture', { groupBy: 'document' });
  console.log(`  ${grouped.records.length} results across vendors`);

  // ── Full RAG query ────────────────────────────────────────────────────
  console.log('\n--- Full RAG Query ---');
  llm.setResponse('AlphaTech proposes $450K/yr with multi-region AWS + Kubernetes. BetaCloud proposes $380K/yr with serverless-first architecture. BetaCloud is $70K cheaper annually with a faster 5-month timeline.');

  const response = await client.query('Which vendor offers better value?');
  console.log(`  Answer: ${response.answer}\n`);

  // ── Cleanup ───────────────────────────────────────────────────────────
  await client.deleteCollection('turbopuffer-demo');
  console.log('Cleaned up. Done!');
}

main().catch(console.error);
