/**
 * Cookbook: Turbopuffer RAG Pipeline
 *
 * Full end-to-end RAG pipeline with a real Turbopuffer backend:
 * 1. Create adapter with region
 * 2. Build RAGClient with embedder + mock LLM
 * 3. Ingest text documents from disk
 * 4. Enrich with theme classification
 * 5. Retrieve with vertical/horizontal filters
 * 6. Full RAG query
 * 7. Cleanup
 *
 * Run:
 *   TURBOPUFFER_API_KEY=your-key npx tsx cookbooks/turbopuffer-rag-pipeline.ts
 */

import * as path from 'path';
import { RAGClient } from '../packages/core/src/client/rag-client';
import { MockLLM } from '../packages/core/src/llm/mock-llm';
import { KeywordThemeClassifier } from '../packages/core/src/enrichment/classifiers/keyword-classifier';
import { TurbopufferAdapter } from '../packages/adapter-turbopuffer/src/turbopuffer-adapter';
import { Embedder } from '../packages/core/src/embedders/embedder';

// ── Simple hash embedder (for demo — replace with OpenAI/Cohere in production) ──
const DIM = 64;
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

const COLLECTION = `cookbook-rag-${Date.now()}`;

async function main() {
  const apiKey = process.env.TURBOPUFFER_API_KEY;
  if (!apiKey) {
    console.error('Set TURBOPUFFER_API_KEY to run this cookbook.');
    process.exit(1);
  }

  const region = process.env.TURBOPUFFER_REGION;

  // ── 1. Create adapter + client ─────────────────────────────────────────
  const adapter = new TurbopufferAdapter({ apiKey, region });
  const embedder = new DemoEmbedder();
  const llm = new MockLLM();

  const client = new RAGClient({
    adapter,
    embedder,
    llm,
    defaultCollection: COLLECTION,
    defaultTopK: 5,
  });

  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  VectorORM — Turbopuffer RAG Pipeline        ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  console.log(`Connecting to Turbopuffer${region ? ` (${region})` : ''}...`);
  await adapter.connect();
  console.log('Connected.\n');

  try {
    // ── 2. Create collection and ingest ────────────────────────────────────
    console.log(`┌── Step 1: Ingest ─────────────────────────────┐\n`);
    await client.createCollection(COLLECTION);

    const fixturesDir = path.join(__dirname, '..', 'examples', 'fixtures');
    const stats = await client.ingest([
      path.join(fixturesDir, 'vendor-proposal-alpha.txt'),
      path.join(fixturesDir, 'vendor-proposal-beta.txt'),
    ]);

    console.log(`  Documents: ${stats.documentsSucceeded}/${stats.documentsProcessed}`);
    console.log(`  Chunks:    ${stats.chunksUpserted}`);
    console.log(`  Time:      ${stats.timeMs}ms\n`);

    // ── 3. Enrich with themes ──────────────────────────────────────────────
    console.log(`┌── Step 2: Enrich ─────────────────────────────┐\n`);
    const enrichStats = await client.enrich(COLLECTION, {
      theme: {
        themes: ['pricing', 'architecture', 'security', 'timeline'],
        classifier: new KeywordThemeClassifier(
          ['pricing', 'architecture', 'security', 'timeline'],
          {
            pricing: ['cost', 'price', 'budget', 'annual', 'fee', 'dollar', '$'],
            architecture: ['architecture', 'deploy', 'kubernetes', 'aws', 'serverless', 'microservice'],
            security: ['security', 'soc', 'compliance', 'encryption', 'audit', 'penetration'],
            timeline: ['timeline', 'phase', 'month', 'milestone', 'delivery', 'launch'],
          }
        ),
      },
    });

    console.log(`  Records processed: ${enrichStats.recordsProcessed}`);
    console.log(`  Records updated:   ${enrichStats.recordsUpdated}\n`);

    // ── 4. Retrieve with filters ───────────────────────────────────────────
    console.log(`┌── Step 3: Retrieve ───────────────────────────┐\n`);

    console.log('  --- Basic retrieval: "pricing" ---');
    const pricingResult = await client.retrieve('pricing costs annual budget');
    for (const r of pricingResult.records.slice(0, 3)) {
      const source = path.basename(String(r.metadata['__v_source'] || 'unknown'));
      const theme = r.metadata['__h_theme'] || 'none';
      console.log(`    [${(r.score ?? 0).toFixed(3)}] ${source} (theme: ${theme})`);
    }

    console.log('\n  --- Filter: theme=architecture ---');
    const archResult = await client.retrieve('technical approach', {
      theme: 'architecture',
    });
    for (const r of archResult.records.slice(0, 3)) {
      const source = path.basename(String(r.metadata['__v_source'] || 'unknown'));
      console.log(`    [${(r.score ?? 0).toFixed(3)}] ${source}: ${r.metadata['text']?.slice(0, 60)}...`);
    }

    console.log('\n  --- Grouped by document ---');
    const grouped = await client.retrieve('vendor comparison', { groupBy: 'document' });
    console.log(`    ${grouped.records.length} results across documents\n`);

    // ── 5. Full RAG query ──────────────────────────────────────────────────
    console.log(`┌── Step 4: RAG Query ──────────────────────────┐\n`);
    llm.setResponse(
      'AlphaTech proposes a Kubernetes-based multi-region deployment at $450K/year. ' +
      'BetaCloud offers a serverless-first approach at $380K/year with a faster 5-month timeline. ' +
      'BetaCloud provides better value with lower cost and faster delivery.'
    );

    const response = await client.query('Which vendor offers better value and why?');
    console.log(`  Question: ${response.query}`);
    console.log(`  Sources:  ${response.sources.length} chunks used as context`);
    console.log(`  Answer:   ${response.answer}\n`);

  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    console.log('Cleaning up...');
    await client.deleteCollection(COLLECTION);
    await adapter.disconnect();
    console.log('Done!');
  }
}

main().catch((err) => {
  console.error('Cookbook failed:', err.message);
  process.exit(1);
});
