/**
 * Insurance Demo — Full pipeline orchestrator.
 *
 * Runs all steps in sequence:
 * 1. Ingest policy documents
 * 2. Enrich with theme metadata
 * 3. Run sample queries
 *
 * Prerequisites:
 * - ChromaDB running at localhost:8000
 *   Start with: docker run -p 8000:8000 chromadb/chroma
 *
 * Run: npm start
 */
import { ingest } from './ingest';
import { enrich } from './enrich';
import { query } from './query';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Glyph VectorORM — Insurance Policy Demo              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Step 1: Ingest
  console.log('┌── Step 1: Ingest ──────────────────────────────────────┐\n');
  await ingest();
  console.log('\n└───────────────────────────────────────────────────────┘\n');

  // Step 2: Enrich
  console.log('┌── Step 2: Enrich ──────────────────────────────────────┐\n');
  await enrich();
  console.log('\n└───────────────────────────────────────────────────────┘\n');

  // Step 3: Query
  console.log('┌── Step 3: Query ───────────────────────────────────────┐\n');
  await query();
  console.log('└───────────────────────────────────────────────────────┘\n');

  console.log('Demo complete!');
}

main().catch(console.error);
