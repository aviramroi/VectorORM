import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';
import type { VectorRecord } from '@vectororm/core';

// Skip if no API key
const hasApiKey = !!process.env.PINECONE_API_KEY;
const testIndexName = `vectororm-test-${Date.now()}`;

describe.skipIf(!hasApiKey)('Pinecone Integration', () => {
  let adapter: PineconeAdapter;

  beforeAll(async () => {
    adapter = new PineconeAdapter({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENVIRONMENT,
    });

    await adapter.connect();

    // Create test index
    await adapter.createCollection(testIndexName, 3, 'cosine');

    // Wait for index to be ready
    await new Promise((resolve) => setTimeout(resolve, 10000));
  });

  afterAll(async () => {
    // Clean up test index
    if (adapter) {
      try {
        await adapter.deleteCollection(testIndexName);
      } catch (error) {
        console.warn('Failed to delete test index:', error);
      }
      await adapter.disconnect();
    }
  });

  it('should verify collection exists', async () => {
    const exists = await adapter.collectionExists(testIndexName);
    expect(exists).toBe(true);
  });

  it('should get collection stats', async () => {
    const stats = await adapter.getCollectionStats(testIndexName);
    expect(stats.dimension).toBe(3);
    expect(stats.metric).toBe('cosine');
    expect(stats.vectorCount).toBeGreaterThanOrEqual(0);
  });

  it('should upsert and fetch vectors', async () => {
    const records: VectorRecord[] = [
      {
        id: 'vec1',
        embedding: [0.1, 0.2, 0.3],
        metadata: { type: 'test' },
      },
      {
        id: 'vec2',
        embedding: [0.4, 0.5, 0.6],
        metadata: { type: 'test' },
      },
    ];

    await adapter.upsert(testIndexName, records);

    // Wait for eventual consistency
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const fetched = await adapter.fetch(testIndexName, ['vec1', 'vec2']);
    expect(fetched).toHaveLength(2);
    expect(fetched[0].metadata.type).toBe('test');
  });

  it('should search with filters', async () => {
    const result = await adapter.search(testIndexName, [0.1, 0.2, 0.3], {
      topK: 5,
      filter: {
        field: 'type',
        op: 'eq',
        value: 'test',
      },
    });

    expect(result.records.length).toBeGreaterThan(0);
    expect(result.records[0].metadata.type).toBe('test');
  });

  it('should search without filters', async () => {
    const result = await adapter.search(testIndexName, [0.1, 0.2, 0.3], {
      topK: 5,
    });

    expect(result.records.length).toBeGreaterThan(0);
    expect(result.records[0].score).toBeDefined();
  });

  it('should update metadata', async () => {
    await adapter.updateMetadata(testIndexName, [
      { id: 'vec1', metadata: { type: 'updated' } },
    ]);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const fetched = await adapter.fetch(testIndexName, ['vec1']);
    expect(fetched[0].metadata.type).toBe('updated');
  });

  it('should iterate all vectors', async () => {
    const batches: VectorRecord[][] = [];
    for await (const batch of adapter.iterate(testIndexName, {
      batchSize: 10,
    })) {
      batches.push(batch);
    }

    expect(batches.length).toBeGreaterThan(0);
    const totalVectors = batches.reduce(
      (sum, batch) => sum + batch.length,
      0
    );
    expect(totalVectors).toBeGreaterThanOrEqual(2);
  });

  it('should iterate with filter', async () => {
    const batches: VectorRecord[][] = [];
    for await (const batch of adapter.iterate(testIndexName, {
      batchSize: 10,
      filter: {
        field: 'type',
        op: 'eq',
        value: 'updated',
      },
    })) {
      batches.push(batch);
    }

    expect(batches.length).toBeGreaterThan(0);
    // All returned records should have type: 'updated'
    for (const batch of batches) {
      for (const record of batch) {
        expect(record.metadata.type).toBe('updated');
      }
    }
  });

  it('should delete vectors', async () => {
    await adapter.delete(testIndexName, ['vec2']);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const fetched = await adapter.fetch(testIndexName, ['vec2']);
    expect(fetched).toHaveLength(0);
  });

  it('should handle non-existent collection check', async () => {
    const exists = await adapter.collectionExists('non-existent-index');
    expect(exists).toBe(false);
  });
});
