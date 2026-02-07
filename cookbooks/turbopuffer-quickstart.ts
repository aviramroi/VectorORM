/**
 * Cookbook: Turbopuffer Quickstart
 *
 * Demonstrates the core adapter operations against a real Turbopuffer instance:
 * 1. Connect with region config
 * 2. Create a namespace
 * 3. Upsert vectors with metadata
 * 4. Search with filters
 * 5. Fetch by ID
 * 6. Update metadata
 * 7. Iterate over all vectors
 * 8. Delete and cleanup
 *
 * Run:
 *   TURBOPUFFER_API_KEY=your-key npx tsx cookbooks/turbopuffer-quickstart.ts
 *
 * Optionally set a region:
 *   TURBOPUFFER_API_KEY=your-key TURBOPUFFER_REGION=aws-us-east-1 npx tsx cookbooks/turbopuffer-quickstart.ts
 */

import { TurbopufferAdapter } from '../packages/adapter-turbopuffer/src/turbopuffer-adapter';
import type { VectorRecord } from '../packages/core/src/types';

const NAMESPACE = `cookbook-quickstart-${Date.now()}`;
const DIMENSION = 8;

function randomVector(): number[] {
  const v = Array.from({ length: DIMENSION }, () => Math.random() - 0.5);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

async function main() {
  // ── 1. Connect ───────────────────────────────────────────────────────
  const apiKey = process.env.TURBOPUFFER_API_KEY;
  if (!apiKey) {
    console.error('Set TURBOPUFFER_API_KEY to run this cookbook.');
    process.exit(1);
  }

  const region = process.env.TURBOPUFFER_REGION; // e.g. 'aws-us-east-1'

  const adapter = new TurbopufferAdapter({
    apiKey,
    region, // optional — defaults to api.turbopuffer.com
  });

  console.log(`Connecting to Turbopuffer${region ? ` (${region})` : ''}...`);
  await adapter.connect();
  console.log('Connected.\n');

  try {
    // ── 2. Create namespace ──────────────────────────────────────────────
    console.log(`Creating namespace "${NAMESPACE}"...`);
    await adapter.createCollection(NAMESPACE, DIMENSION, 'cosine');
    console.log('Created.\n');

    // ── 3. Upsert vectors ────────────────────────────────────────────────
    const records: VectorRecord[] = [
      {
        id: 'doc-pricing-1',
        embedding: randomVector(),
        metadata: {
          __v_partition: 'finance',
          __h_theme: 'pricing',
          text: 'Annual license costs $50,000 per year with volume discounts.',
        },
      },
      {
        id: 'doc-pricing-2',
        embedding: randomVector(),
        metadata: {
          __v_partition: 'finance',
          __h_theme: 'pricing',
          text: 'Enterprise tier includes 24/7 support at $75,000 per year.',
        },
      },
      {
        id: 'doc-security-1',
        embedding: randomVector(),
        metadata: {
          __v_partition: 'engineering',
          __h_theme: 'security',
          text: 'SOC 2 Type II certified with annual penetration testing.',
        },
      },
      {
        id: 'doc-arch-1',
        embedding: randomVector(),
        metadata: {
          __v_partition: 'engineering',
          __h_theme: 'architecture',
          text: 'Multi-region deployment on AWS with Kubernetes orchestration.',
        },
      },
      {
        id: 'doc-arch-2',
        embedding: randomVector(),
        metadata: {
          __v_partition: 'engineering',
          __h_theme: 'architecture',
          text: 'Event-driven microservices using Kafka for inter-service communication.',
        },
      },
    ];

    console.log(`Upserting ${records.length} vectors...`);
    await adapter.upsert(NAMESPACE, records);
    console.log('Upserted.\n');

    // ── 4. Search with filters ───────────────────────────────────────────
    console.log('--- Search: all vectors (top 3) ---');
    const allResults = await adapter.search(NAMESPACE, randomVector(), { topK: 3 });
    for (const r of allResults.records) {
      console.log(`  [${(r.score ?? 0).toFixed(4)}] ${r.id} — ${r.metadata['__h_theme']}`);
    }

    console.log('\n--- Search: filter by partition=engineering ---');
    const engResults = await adapter.search(NAMESPACE, randomVector(), {
      topK: 5,
      filter: { field: '__v_partition', op: 'eq', value: 'engineering' },
    });
    for (const r of engResults.records) {
      console.log(`  [${(r.score ?? 0).toFixed(4)}] ${r.id} — ${r.metadata['text']?.slice(0, 50)}...`);
    }

    console.log('\n--- Search: compound filter (engineering AND architecture) ---');
    const archResults = await adapter.search(NAMESPACE, randomVector(), {
      topK: 5,
      filter: {
        and: [
          { field: '__v_partition', op: 'eq', value: 'engineering' },
          { field: '__h_theme', op: 'eq', value: 'architecture' },
        ],
      },
    });
    for (const r of archResults.records) {
      console.log(`  [${(r.score ?? 0).toFixed(4)}] ${r.id} — ${r.metadata['text']?.slice(0, 50)}...`);
    }

    // ── 5. Fetch by ID ───────────────────────────────────────────────────
    console.log('\n--- Fetch by ID ---');
    const fetched = await adapter.fetch(NAMESPACE, ['doc-pricing-1', 'doc-security-1']);
    for (const r of fetched) {
      console.log(`  ${r.id}: ${r.metadata['text']?.slice(0, 60)}...`);
    }

    // ── 6. Update metadata ───────────────────────────────────────────────
    console.log('\n--- Update metadata ---');
    await adapter.updateMetadata(NAMESPACE, [
      { id: 'doc-pricing-1', metadata: { reviewed: true, reviewer: 'cookbook' } },
    ]);
    const updated = await adapter.fetch(NAMESPACE, ['doc-pricing-1']);
    console.log(`  doc-pricing-1 reviewed=${updated[0]?.metadata['reviewed']}`);

    // ── 7. Iterate ───────────────────────────────────────────────────────
    console.log('\n--- Iterate all vectors ---');
    let totalCount = 0;
    for await (const batch of adapter.iterate(NAMESPACE, { batchSize: 2 })) {
      console.log(`  Batch of ${batch.length}: [${batch.map((r) => r.id).join(', ')}]`);
      totalCount += batch.length;
    }
    console.log(`  Total: ${totalCount} vectors`);

    // ── 8. Stats ─────────────────────────────────────────────────────────
    console.log('\n--- Collection stats ---');
    const stats = await adapter.getCollectionStats(NAMESPACE);
    console.log(`  Vectors: ${stats.vectorCount}, Dimension: ${stats.dimension}`);

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────
    console.log(`\nDeleting namespace "${NAMESPACE}"...`);
    await adapter.deleteCollection(NAMESPACE);
    await adapter.disconnect();
    console.log('Done!');
  }
}

main().catch((err) => {
  console.error('Cookbook failed:', err.message);
  process.exit(1);
});
