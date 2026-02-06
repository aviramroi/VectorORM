/**
 * Vendor Comparison Example
 *
 * Demonstrates side-by-side vendor comparison using groupBy:
 * 1. Ingest two vendor proposals
 * 2. Compare using grouped retrieval (by document)
 * 3. Use custom filters for specific criteria
 * 4. Full RAG query for vendor recommendation
 *
 * Run: npx tsx examples/vendor-comparison.ts
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
    defaultCollection: 'proposals',
    defaultTopK: 10
  });

  console.log('=== Glyph VectorORM — Vendor Comparison Example ===\n');

  // ── 1. Ingest vendor proposals ────────────────────────────────────────
  await client.createCollection('proposals');

  const fixturesDir = path.join(__dirname, 'fixtures');
  const stats = await client.ingest(
    [
      path.join(fixturesDir, 'vendor-proposal-alpha.txt'),
      path.join(fixturesDir, 'vendor-proposal-beta.txt')
    ],
    'proposals'
  );

  console.log(`Ingested ${stats.documentsSucceeded} proposals, ${stats.chunksUpserted} chunks\n`);

  // ── 2. Compare pricing ────────────────────────────────────────────────
  console.log('--- Retrieval: "pricing and budget" ---');
  const pricing = await client.retrieve('pricing budget cost annual');
  for (const record of pricing.records.slice(0, 4)) {
    const source = path.basename(String(record.metadata['__v_source'] || ''));
    const preview = (record.text || '').substring(0, 100).replace(/\n/g, ' ');
    console.log(`  [${(record.score ?? 0).toFixed(3)}] ${source}: ${preview}...`);
  }

  // ── 3. Compare SLAs ───────────────────────────────────────────────────
  console.log('\n--- Retrieval: "SLA uptime support" ---');
  const sla = await client.retrieve('SLA uptime guarantee support response time');
  for (const record of sla.records.slice(0, 4)) {
    const source = path.basename(String(record.metadata['__v_source'] || ''));
    const preview = (record.text || '').substring(0, 100).replace(/\n/g, ' ');
    console.log(`  [${(record.score ?? 0).toFixed(3)}] ${source}: ${preview}...`);
  }

  // ── 4. Group by document for side-by-side ─────────────────────────────
  console.log('\n--- Grouped by Document: "technical approach" ---');
  const grouped = await client.retrieve('technical approach architecture', { groupBy: 'document' });
  console.log(`  ${grouped.records.length} results across ${stats.documentsSucceeded} vendors`);

  // ── 5. Full RAG query for recommendation ──────────────────────────────
  console.log('\n--- Full RAG Query ---');
  llm.setResponse(
    'Based on the proposals:\n\n' +
    'AlphaTech Solutions ($450K/yr): Multi-region AWS with Kubernetes, Terraform IaC, ' +
    '150 engineers, 99.95% SLA, 6-month migration.\n\n' +
    'BetaCloud Corp ($380K/yr): Serverless-first with Lambda/Fargate, AWS CDK, ' +
    '85 engineers, 99.99% SLA for serverless, 5-month migration.\n\n' +
    'Recommendation: BetaCloud offers lower cost ($70K/yr savings), faster migration, ' +
    'higher SLA for serverless workloads, and a more modern architecture. AlphaTech has ' +
    'a larger team and more enterprise migration experience. Choose BetaCloud for ' +
    'cloud-native workloads, AlphaTech for complex legacy migrations.'
  );

  const response = await client.query(
    'Compare the two vendor proposals and recommend which one to choose.',
    {
      systemPrompt: 'You are a technology procurement advisor. Compare vendor proposals objectively.',
      temperature: 0.3
    }
  );

  console.log(`  Question: ${response.query}`);
  console.log(`  Answer: ${response.answer}`);
  console.log(`  Sources used: ${response.sources.length} chunks\n`);

  console.log('=== Done ===');
}

main().catch(console.error);
