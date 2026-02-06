/**
 * Query — Run sample queries against the enriched insurance collection.
 *
 * Demonstrates:
 * 1. Basic retrieval
 * 2. Retrieval with theme filter
 * 3. Grouped retrieval (by document)
 * 4. Full RAG query
 */
import * as path from 'path';
import { createClient } from './setup';

export async function query() {
  const client = createClient();

  // ── 1. Basic retrieval ─────────────────────────────────────────────────
  console.log('=== 1. Basic Retrieval: "exclusions for flood damage" ===\n');
  const basic = await client.retrieve('exclusions for flood damage');
  for (const record of basic.records.slice(0, 3)) {
    const source = path.basename(String(record.metadata['__v_source'] || 'unknown'));
    const theme = record.metadata['__h_theme'] || 'unclassified';
    const preview = (record.text || '').substring(0, 120).replace(/\n/g, ' ');
    console.log(`  [${(record.score ?? 0).toFixed(3)}] ${source} (theme: ${theme})`);
    console.log(`    ${preview}...\n`);
  }

  // ── 2. Retrieval with theme filter ─────────────────────────────────────
  console.log('=== 2. Filtered by theme: "pricing" ===\n');
  const priced = await client.retrieve('annual premium and discounts', { theme: 'pricing' });
  if (priced.records.length === 0) {
    console.log('  No results (theme enrichment may not have matched "pricing")');
    console.log('  Falling back to unfiltered query...\n');
    const fallback = await client.retrieve('annual premium and discounts');
    for (const record of fallback.records.slice(0, 3)) {
      const source = path.basename(String(record.metadata['__v_source'] || 'unknown'));
      const preview = (record.text || '').substring(0, 120).replace(/\n/g, ' ');
      console.log(`  [${(record.score ?? 0).toFixed(3)}] ${source}: ${preview}...\n`);
    }
  } else {
    for (const record of priced.records.slice(0, 3)) {
      const source = path.basename(String(record.metadata['__v_source'] || 'unknown'));
      const preview = (record.text || '').substring(0, 120).replace(/\n/g, ' ');
      console.log(`  [${(record.score ?? 0).toFixed(3)}] ${source}: ${preview}...\n`);
    }
  }

  // ── 3. Grouped by document ─────────────────────────────────────────────
  console.log('=== 3. Grouped by Document: "claims process" ===\n');
  const grouped = await client.retrieve('claims process how to file', { groupBy: 'document' });
  console.log(`  Total results: ${grouped.records.length}\n`);

  // ── 4. Full RAG query ──────────────────────────────────────────────────
  console.log('=== 4. Full RAG Query ===\n');
  const response = await client.query(
    'What are the key differences between the auto, home, and life insurance policies?',
    {
      topK: 10,
      systemPrompt:
        'You are an insurance policy analyst. Compare the policies based on the provided context. ' +
        'Focus on coverage limits, exclusions, and pricing differences.'
    }
  );

  console.log(`  Question: ${response.query}`);
  console.log(`  Answer:   ${response.answer}`);
  console.log(`  Sources:  ${response.sources.length} chunks used\n`);
}

// Run directly
if (require.main === module) {
  query().catch(console.error);
}
