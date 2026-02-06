/**
 * Ingest — Load and ingest insurance policy documents into the vector store.
 *
 * This step:
 * 1. Creates the collection (if it doesn't exist)
 * 2. Ingests the three policy documents from data/
 * 3. The pipeline automatically chunks, embeds, and upserts
 * 4. Vertical metadata (__v_doc_id, __v_source, __v_doc_type) is auto-extracted
 */
import * as path from 'path';
import { createClient, COLLECTION_NAME } from './setup';

export async function ingest() {
  const client = createClient();

  console.log('Creating collection...');
  const exists = await client.collectionExists(COLLECTION_NAME);
  if (exists) {
    console.log(`  Collection "${COLLECTION_NAME}" already exists, deleting...`);
    await client.deleteCollection(COLLECTION_NAME);
  }
  await client.createCollection(COLLECTION_NAME);
  console.log(`  Collection "${COLLECTION_NAME}" created.\n`);

  console.log('Ingesting policy documents...');
  const dataDir = path.join(__dirname, '..', 'data');
  const stats = await client.ingest(
    [
      path.join(dataDir, 'auto-policy.txt'),
      path.join(dataDir, 'home-policy.txt'),
      path.join(dataDir, 'life-policy.txt')
    ]
  );

  console.log(`  Documents processed: ${stats.documentsProcessed}`);
  console.log(`  Documents succeeded: ${stats.documentsSucceeded}`);
  console.log(`  Documents failed:    ${stats.documentsFailed}`);
  console.log(`  Chunks created:      ${stats.chunksCreated}`);
  console.log(`  Chunks upserted:     ${stats.chunksUpserted}`);
  console.log(`  Time:                ${stats.timeMs}ms`);

  if (stats.errors && stats.errors.length > 0) {
    console.log('\n  Errors:');
    for (const err of stats.errors) {
      console.log(`    ${err.source} (${err.stage}): ${err.error.message}`);
    }
  }

  console.log('\nIngestion complete!');
}

// Run directly
if (require.main === module) {
  ingest().catch(console.error);
}
