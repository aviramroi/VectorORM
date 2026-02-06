/**
 * Enrich — Add vertical and theme metadata to ingested records.
 *
 * After ingestion, records have basic vertical metadata (doc_id, source, doc_type).
 * This step enriches them further:
 * 1. Vertical: partition by policy type (auto, home, life)
 * 2. Theme: classify chunks into themes (coverage, exclusions, claims, pricing)
 *
 * In a real application, you would use LLM-based or embedding-based classifiers.
 * This demo uses keyword-based classification for simplicity.
 */
import { createClient, COLLECTION_NAME } from './setup';
import { KeywordThemeClassifier } from '@glyph/core';

export async function enrich() {
  const client = createClient();

  console.log('Enriching collection with themes...\n');

  // Define themes and their keywords
  const themes = ['coverage', 'exclusions', 'claims', 'pricing'];
  const keywords: Record<string, string[]> = {
    coverage: ['coverage', 'covered', 'protection', 'protects', 'insured', 'benefit', 'pays'],
    exclusions: ['excluded', 'exclusion', 'not covered', 'does not cover', 'limitation', 'except'],
    claims: ['claim', 'claims', 'file', 'report', 'adjuster', 'documentation', 'process'],
    pricing: ['premium', 'pricing', 'cost', 'discount', 'payment', 'annual', 'fee', 'rate']
  };

  const classifier = new KeywordThemeClassifier(themes, keywords);

  const stats = await client.enrich(COLLECTION_NAME, {
    themes: {
      themes,
      classifier,
      confidenceThreshold: 0.1
    }
  });

  console.log(`  Records processed: ${stats.recordsProcessed}`);
  console.log(`  Records updated:   ${stats.recordsUpdated}`);
  console.log(`  Records skipped:   ${stats.recordsSkipped}`);
  console.log(`  Time:              ${stats.timeMs}ms`);

  if (stats.errors && stats.errors.length > 0) {
    console.log('\n  Errors:');
    for (const err of stats.errors) {
      console.log(`    ${err}`);
    }
  }

  console.log('\nEnrichment complete!');
}

// Run directly
if (require.main === module) {
  enrich().catch(console.error);
}
