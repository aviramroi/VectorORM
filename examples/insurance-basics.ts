/**
 * Insurance Basics Example
 *
 * Demonstrates the core Vertical/Horizontal RAG flow:
 * 1. Create a RAGClient with in-memory adapter
 * 2. Ingest insurance policy documents
 * 3. Retrieve with partition and theme shorthands
 * 4. Group results by document and theme
 * 5. Full RAG query with LLM
 *
 * Run: npx tsx examples/insurance-basics.ts
 */
import * as path from 'path';
import { RAGClient } from '../packages/core/src/client/rag-client';
import { MockLLM } from '../packages/core/src/llm/mock-llm';
import { InMemoryAdapter } from './helpers/mock-adapter';
import { SimpleEmbedder } from './helpers/mock-embedder';

async function main() {
  // ── 1. Create client ─────────────────────────────────────────────────
  const adapter = new InMemoryAdapter();
  const embedder = new SimpleEmbedder();
  const llm = new MockLLM();

  const client = new RAGClient({
    adapter,
    embedder,
    llm,
    defaultCollection: 'policies',
    defaultTopK: 5
  });

  console.log('=== VectorORM — Insurance Example ===\n');

  // ── 2. Create collection and ingest ──────────────────────────────────
  await client.createCollection('policies');

  const fixturesDir = path.join(__dirname, 'fixtures');
  const stats = await client.ingest(
    [
      path.join(fixturesDir, 'auto-policy.txt'),
      path.join(fixturesDir, 'home-policy.txt'),
      path.join(fixturesDir, 'life-policy.txt')
    ],
    'policies'
  );

  console.log(`Ingested ${stats.documentsSucceeded} documents, ${stats.chunksUpserted} chunks\n`);

  // ── 3. Basic retrieval ───────────────────────────────────────────────
  console.log('--- Basic Retrieval: "exclusions" ---');
  const result = await client.retrieve('exclusions and what is not covered');
  for (const record of result.records) {
    const source = record.metadata['__v_source'] || 'unknown';
    const preview = (record.text || '').substring(0, 80).replace(/\n/g, ' ');
    console.log(`  [${(record.score ?? 0).toFixed(3)}] ${path.basename(String(source))}: ${preview}...`);
  }

  // ── 4. Retrieval with partition filter ────────────────────────────────
  console.log('\n--- Filtered by doc_type = "txt" ---');
  const filtered = await client.retrieve('claims process', {
    filter: { field: '__v_doc_type', op: 'eq', value: 'txt' }
  });
  console.log(`  Found ${filtered.records.length} results\n`);

  // ── 5. Grouped retrieval by document ──────────────────────────────────
  console.log('--- Grouped by Document ---');
  const byDoc = await client.retrieve('pricing and premiums', { groupBy: 'document' });
  console.log(`  ${byDoc.records.length} total results across documents\n`);

  // ── 6. Full RAG query ─────────────────────────────────────────────────
  console.log('--- Full RAG Query ---');
  llm.setResponse(
    'Based on the policy documents, flood damage is excluded from the home insurance policy ' +
    '(HOME-2024-002). The exclusions section states that flood damage requires a separate ' +
    'flood policy. The auto policy covers natural disaster damage under comprehensive coverage, ' +
    'but specific flood exclusions may apply depending on the state.'
  );

  const response = await client.query('What exclusions apply to flood damage?', {
    systemPrompt: 'You are an insurance policy analyst. Answer based on the provided context.'
  });

  console.log(`  Question: ${response.query}`);
  console.log(`  Answer: ${response.answer}`);
  console.log(`  Sources used: ${response.sources.length} chunks\n`);

  console.log('=== Done ===');
}

main().catch(console.error);
