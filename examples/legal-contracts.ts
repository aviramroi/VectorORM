/**
 * Legal Contracts Example
 *
 * Demonstrates section-based retrieval and cross-document comparison:
 * 1. Ingest two service agreement contracts
 * 2. Retrieve specific contract sections
 * 3. Compare across documents using custom filters
 * 4. Full RAG query about contractual terms
 *
 * Run: npx tsx examples/legal-contracts.ts
 */
import * as path from 'path';
import { RAGClient } from '../packages/core/src/client/rag-client';
import { MockLLM } from '../packages/core/src/llm/mock-llm';
import { InMemoryAdapter } from './helpers/mock-adapter';
import { SimpleEmbedder } from './helpers/mock-embedder';

async function main() {
  const adapter = new InMemoryAdapter();
  const embedder = new SimpleEmbedder();
  const llm = new MockLLM();

  const client = new RAGClient({
    adapter,
    embedder,
    llm,
    defaultCollection: 'contracts',
    defaultTopK: 5
  });

  console.log('=== Glyph VectorORM — Legal Contracts Example ===\n');

  // ── 1. Ingest contracts ──────────────────────────────────────────────
  await client.createCollection('contracts');

  const fixturesDir = path.join(__dirname, 'fixtures');
  const stats = await client.ingest(
    [
      path.join(fixturesDir, 'contract-a.txt'),
      path.join(fixturesDir, 'contract-b.txt')
    ],
    'contracts'
  );

  console.log(`Ingested ${stats.documentsSucceeded} contracts, ${stats.chunksUpserted} chunks\n`);

  // ── 2. Search for termination clauses ─────────────────────────────────
  console.log('--- Retrieval: "termination clauses" ---');
  const termination = await client.retrieve('termination and early exit penalties');
  for (const record of termination.records.slice(0, 3)) {
    const source = path.basename(String(record.metadata['__v_source'] || ''));
    const preview = (record.text || '').substring(0, 100).replace(/\n/g, ' ');
    console.log(`  [${(record.score ?? 0).toFixed(3)}] ${source}: ${preview}...`);
  }

  // ── 3. Search for liability terms ─────────────────────────────────────
  console.log('\n--- Retrieval: "liability and indemnification" ---');
  const liability = await client.retrieve('liability limits and indemnification');
  for (const record of liability.records.slice(0, 3)) {
    const source = path.basename(String(record.metadata['__v_source'] || ''));
    const preview = (record.text || '').substring(0, 100).replace(/\n/g, ' ');
    console.log(`  [${(record.score ?? 0).toFixed(3)}] ${source}: ${preview}...`);
  }

  // ── 4. Group by document for comparison ───────────────────────────────
  console.log('\n--- Grouped by Document: "payment terms" ---');
  const grouped = await client.retrieve('payment terms and pricing', { groupBy: 'document' });
  console.log(`  ${grouped.records.length} total results across ${stats.documentsSucceeded} contracts`);

  // ── 5. Full RAG query ──────────────────────────────────────────────────
  console.log('\n--- Full RAG Query ---');
  llm.setResponse(
    'Comparing the two contracts:\n' +
    '- Contract A (Acme/TechServ): $15,000/month, 30-day payment terms, 1.5% late interest, ' +
    'early termination requires 50% of remaining value.\n' +
    '- Contract B (GlobalTech/CloudFirst): $28,000/month, 45-day payment terms, 1% late interest, ' +
    'early termination requires remaining value minus 25% mitigation discount.\n' +
    'Contract B has more favorable late payment terms but higher total cost.'
  );

  const response = await client.query(
    'Compare the payment terms and early termination costs between the two contracts.',
    { systemPrompt: 'You are a legal analyst. Compare contracts based on the provided context.' }
  );

  console.log(`  Question: ${response.query}`);
  console.log(`  Answer: ${response.answer}`);
  console.log(`  Sources used: ${response.sources.length} chunks\n`);

  console.log('=== Done ===');
}

main().catch(console.error);
