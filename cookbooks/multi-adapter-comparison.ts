/**
 * Cookbook: Multi-Adapter Comparison
 *
 * Shows the same VectorORM operations running against different adapters.
 * Uses the InMemoryAdapter so no credentials are needed — demonstrates
 * that the same code works regardless of which adapter you plug in.
 *
 * This pattern is how you'd swap between Turbopuffer, Chroma, and Pinecone
 * in production — just change the adapter constructor.
 *
 * Run:
 *   npx tsx cookbooks/multi-adapter-comparison.ts
 */

import { RAGClient } from '../packages/core/src/client/rag-client';
import { MockLLM } from '../packages/core/src/llm/mock-llm';
import { VectorDBAdapter } from '../packages/core/src/adapters/vector-db-adapter';
import { Embedder } from '../packages/core/src/embedders/embedder';
import { InMemoryAdapter } from '../examples/helpers/mock-adapter';

// ── Embedder ──────────────────────────────────────────────────────────────
const DIM = 32;
function hashEmbed(text: string): number[] {
  const vec = new Array(DIM).fill(0);
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    vec[(lower.charCodeAt(i) * (i + 1)) % DIM] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

class DemoEmbedder extends Embedder {
  get dimensions() { return DIM; }
  get modelName() { return 'hash-embedder'; }
  async embed(text: string) { return hashEmbed(text); }
  async embedBatch(texts: string[]) { return texts.map(hashEmbed); }
}

// ── Sample data ───────────────────────────────────────────────────────────
const SAMPLE_RECORDS = [
  {
    id: 'pricing-1',
    text: 'Annual subscription costs $50,000 per year with volume discounts available.',
    metadata: { __v_partition: 'finance', __h_theme: 'pricing', category: 'proposal' },
  },
  {
    id: 'pricing-2',
    text: 'Enterprise tier pricing starts at $75,000 with 24/7 premium support included.',
    metadata: { __v_partition: 'finance', __h_theme: 'pricing', category: 'proposal' },
  },
  {
    id: 'arch-1',
    text: 'Kubernetes-based deployment on AWS with multi-region failover and auto-scaling.',
    metadata: { __v_partition: 'engineering', __h_theme: 'architecture', category: 'technical' },
  },
  {
    id: 'arch-2',
    text: 'Serverless architecture using Lambda functions with DynamoDB for state management.',
    metadata: { __v_partition: 'engineering', __h_theme: 'architecture', category: 'technical' },
  },
  {
    id: 'security-1',
    text: 'SOC 2 Type II certified with annual penetration testing and encryption at rest.',
    metadata: { __v_partition: 'engineering', __h_theme: 'security', category: 'compliance' },
  },
];

// ── Run the same operations against an adapter ─────────────────────────────
async function runDemo(name: string, adapter: VectorDBAdapter) {
  const embedder = new DemoEmbedder();
  const llm = new MockLLM();
  const collection = 'demo';

  const client = new RAGClient({
    adapter,
    embedder,
    llm,
    defaultCollection: collection,
    defaultTopK: 5,
  });

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  Adapter: ${name}`);
  console.log(`${'═'.repeat(50)}\n`);

  // Create collection
  await client.createCollection(collection);

  // Upsert records with embeddings
  const records = await Promise.all(
    SAMPLE_RECORDS.map(async (r) => ({
      id: r.id,
      embedding: await embedder.embed(r.text),
      metadata: { ...r.metadata, text: r.text },
    }))
  );
  await adapter.upsert(collection, records);
  console.log(`  Upserted ${records.length} records`);

  // Basic search
  console.log('\n  --- Search: "pricing costs" ---');
  const result = await client.retrieve('pricing costs annual');
  for (const r of result.records.slice(0, 3)) {
    console.log(`    [${(r.score ?? 0).toFixed(3)}] ${r.id}: ${r.metadata['text']?.slice(0, 50)}...`);
  }

  // Filtered search (partition)
  console.log('\n  --- Filter: partition=engineering ---');
  const engResult = await client.retrieve('system design', {
    partition: 'engineering',
  });
  for (const r of engResult.records.slice(0, 3)) {
    console.log(`    [${(r.score ?? 0).toFixed(3)}] ${r.id} (${r.metadata['__h_theme']})`);
  }

  // Filtered search (theme)
  console.log('\n  --- Filter: theme=architecture ---');
  const archResult = await client.retrieve('deployment infrastructure', {
    theme: 'architecture',
  });
  for (const r of archResult.records.slice(0, 3)) {
    console.log(`    [${(r.score ?? 0).toFixed(3)}] ${r.id}: ${r.metadata['text']?.slice(0, 50)}...`);
  }

  // Stats
  const stats = await adapter.getCollectionStats(collection);
  console.log(`\n  Collection stats: ${stats.vectorCount} vectors, dim=${stats.dimension}`);

  // RAG query
  llm.setResponse('Based on the proposals, the Kubernetes option costs $50K but offers multi-region resilience, while the serverless option at $75K includes premium support.');
  const response = await client.query('Compare the pricing of both options');
  console.log(`\n  RAG Answer: ${response.answer.slice(0, 80)}...`);

  // Cleanup
  await client.deleteCollection(collection);
  console.log('\n  Cleaned up.');
}

async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  VectorORM — Multi-Adapter Comparison        ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('\nSame operations, different adapters.\n');

  // Adapter 1: InMemory (always works, no credentials)
  await runDemo('InMemoryAdapter', new InMemoryAdapter());

  // To add real adapters, uncomment and set env vars:
  //
  // import { TurbopufferAdapter } from '../packages/adapter-turbopuffer/src';
  // const tpuf = new TurbopufferAdapter({
  //   apiKey: process.env.TURBOPUFFER_API_KEY!,
  //   region: 'aws-us-east-1',
  // });
  // await tpuf.connect();
  // await runDemo('TurbopufferAdapter (aws-us-east-1)', tpuf);
  // await tpuf.disconnect();
  //
  // import { ChromaAdapter } from '../packages/adapter-chroma/src';
  // const chroma = new ChromaAdapter({ host: 'localhost', port: 8000 });
  // await chroma.connect();
  // await runDemo('ChromaAdapter (localhost:8000)', chroma);
  // await chroma.disconnect();
  //
  // import { PineconeAdapter } from '../packages/adapter-pinecone/src';
  // const pinecone = new PineconeAdapter({
  //   apiKey: process.env.PINECONE_API_KEY!,
  //   environment: 'us-east-1-aws',
  // });
  // await pinecone.connect();
  // await runDemo('PineconeAdapter', pinecone);
  // await pinecone.disconnect();

  console.log('\nAll done!');
}

main().catch((err) => {
  console.error('Cookbook failed:', err.message);
  process.exit(1);
});
