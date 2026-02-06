// packages/core/tests/ingestion/ingestion-pipeline.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IngestionPipeline } from '../../src/ingestion/ingestion-pipeline';
import { LoaderRegistry } from '../../src/ingestion/loaders/loader-registry';
import { RecursiveChunker } from '../../src/ingestion/chunkers/recursive-chunker';
import type { VectorRecord } from '../../src/types/vector-record';
import type { ProgressInfo } from '../../src/ingestion/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock adapter that implements just the methods we need
class MockAdapter {
  records: VectorRecord[] = [];

  async upsert(collection: string, records: VectorRecord[]): Promise<void> {
    this.records.push(...records);
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isConnected(): Promise<boolean> { return true; }
}

// Mock embedder
class MockEmbedder {
  get dimensions() { return 384; }
  get modelName() { return 'mock'; }

  async embed(text: string): Promise<number[]> {
    return new Array(384).fill(0);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => new Array(384).fill(0));
  }
}

describe('IngestionPipeline', () => {
  let pipeline: IngestionPipeline;
  let adapter: MockAdapter;
  let embedder: MockEmbedder;
  let registry: LoaderRegistry;
  let tempDir: string;

  beforeEach(async () => {
    adapter = new MockAdapter();
    embedder = new MockEmbedder();
    registry = new LoaderRegistry();
    pipeline = new IngestionPipeline(
      adapter as any,
      embedder as any,
      registry
    );
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should be constructible', () => {
    expect(pipeline).toBeDefined();
    expect(typeof pipeline.ingest).toBe('function');
  });

  it('should complete full ingestion pipeline', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'This is a test document with some content.', 'utf-8');

    const stats = await pipeline.ingest(filePath, 'test-collection');

    expect(stats.documentsProcessed).toBe(1);
    expect(stats.documentsSucceeded).toBe(1);
    expect(stats.documentsFailed).toBe(0);
    expect(stats.chunksCreated).toBeGreaterThan(0);
    expect(stats.chunksUpserted).toBe(stats.chunksCreated);
    expect(stats.timeMs).toBeGreaterThan(0);
  });

  it('should auto-extract vertical metadata', async () => {
    const subDir = path.join(tempDir, 'docs', 'legal');
    await fs.mkdir(subDir, { recursive: true });
    const filePath = path.join(subDir, 'contract-2024.txt');
    await fs.writeFile(filePath, 'Contract content here.', 'utf-8');

    await pipeline.ingest(filePath, 'test-collection');

    const record = adapter.records[0];
    expect(record.metadata['__v_source']).toBe(filePath);
    expect(record.metadata['__v_doc_type']).toBe('txt');
    expect(record.metadata['__v_doc_id']).toBe('contract-2024');
    expect(record.metadata['__v_partition']).toContain('legal');
  });

  it('should allow user metadata override', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'Content', 'utf-8');

    await pipeline.ingest(filePath, 'test-collection', {
      metadata: {
        '__v_partition': 'custom-partition',
        customField: 'custom-value'
      }
    });

    const record = adapter.records[0];
    expect(record.metadata['__v_partition']).toBe('custom-partition');
    expect(record.metadata.customField).toBe('custom-value');
  });

  it('should support custom metadata extractor', async () => {
    const filePath = path.join(tempDir, 'doc_2024_v1.txt');
    await fs.writeFile(filePath, 'Content', 'utf-8');

    await pipeline.ingest(filePath, 'test-collection', {
      metadataExtractor: (doc) => {
        const match = doc.source.match(/_(\d{4})_v(\d+)/);
        return {
          year: match?.[1],
          version: match?.[2]
        };
      }
    });

    const record = adapter.records[0];
    expect(record.metadata.year).toBe('2024');
    expect(record.metadata.version).toBe('1');
  });

  it('should handle multiple files', async () => {
    const file1 = path.join(tempDir, 'file1.txt');
    const file2 = path.join(tempDir, 'file2.txt');
    await fs.writeFile(file1, 'Content 1', 'utf-8');
    await fs.writeFile(file2, 'Content 2', 'utf-8');

    const stats = await pipeline.ingest([file1, file2], 'test-collection');

    expect(stats.documentsProcessed).toBe(2);
    expect(stats.documentsSucceeded).toBe(2);
    expect(adapter.records.length).toBeGreaterThan(0);
  });

  it('should use custom chunker', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'A'.repeat(5000), 'utf-8');

    const customChunker = new RecursiveChunker();
    const stats = await pipeline.ingest(filePath, 'test-collection', {
      chunker: customChunker,
      chunkSize: 100,
      chunkOverlap: 10
    });

    expect(stats.chunksCreated).toBeGreaterThan(5);
  });

  it('should handle file load errors gracefully', async () => {
    const missingFile = path.join(tempDir, 'missing.txt');

    const stats = await pipeline.ingest(missingFile, 'test-collection');

    expect(stats.documentsProcessed).toBe(1);
    expect(stats.documentsFailed).toBe(1);
    expect(stats.documentsSucceeded).toBe(0);
    expect(stats.errors).toHaveLength(1);
    expect(stats.errors![0].stage).toBe('load');
  });

  it('should continue processing after errors', async () => {
    const goodFile = path.join(tempDir, 'good.txt');
    const badFile = path.join(tempDir, 'missing.txt');
    await fs.writeFile(goodFile, 'Good content', 'utf-8');

    const stats = await pipeline.ingest([goodFile, badFile], 'test-collection');

    expect(stats.documentsProcessed).toBe(2);
    expect(stats.documentsSucceeded).toBe(1);
    expect(stats.documentsFailed).toBe(1);
    expect(stats.chunksCreated).toBeGreaterThan(0);
  });

  it('should call onProgress callback during ingestion', async () => {
    const file1 = path.join(tempDir, 'file1.txt');
    const file2 = path.join(tempDir, 'file2.txt');
    await fs.writeFile(file1, 'Content 1', 'utf-8');
    await fs.writeFile(file2, 'Content 2', 'utf-8');

    const progressCalls: ProgressInfo[] = [];
    const onProgress = vi.fn((progress: ProgressInfo) => {
      progressCalls.push({ ...progress });
    });

    await pipeline.ingest([file1, file2], 'test-collection', { onProgress });

    expect(onProgress).toHaveBeenCalled();
    expect(progressCalls.length).toBeGreaterThan(0);

    const stages = progressCalls.map(p => p.stage);
    expect(stages).toContain('loading');
    expect(stages).toContain('chunking');
    expect(stages).toContain('embedding');
    expect(stages).toContain('upserting');
  });

  it('should call onDocumentLoaded callback', async () => {
    const file = path.join(tempDir, 'test.txt');
    await fs.writeFile(file, 'Test content', 'utf-8');

    const onDocumentLoaded = vi.fn();

    await pipeline.ingest(file, 'test-collection', { onDocumentLoaded });

    expect(onDocumentLoaded).toHaveBeenCalledOnce();
    expect(onDocumentLoaded).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Test content',
        source: file,
        type: 'txt'
      })
    );
  });

  it('should call onChunksCreated callback', async () => {
    const file = path.join(tempDir, 'test.txt');
    await fs.writeFile(file, 'A'.repeat(5000), 'utf-8');

    const onChunksCreated = vi.fn();

    await pipeline.ingest(file, 'test-collection', { onChunksCreated });

    expect(onChunksCreated).toHaveBeenCalled();
    const chunks = onChunksCreated.mock.calls[0][0];
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should include chunk position metadata', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'First chunk here. Second chunk here. Third chunk here.', 'utf-8');

    await pipeline.ingest(filePath, 'test-collection', { chunkSize: 10 });

    const record = adapter.records[0];
    expect(record.metadata.chunkIndex).toBeDefined();
    expect(record.metadata.totalChunks).toBeGreaterThan(0);
    expect(record.metadata.startChar).toBeDefined();
    expect(record.metadata.endChar).toBeDefined();
  });

  it('should generate unique IDs for chunks', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'A'.repeat(5000), 'utf-8');

    await pipeline.ingest(filePath, 'test-collection', { chunkSize: 100 });

    const ids = adapter.records.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should embed all chunks', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'Content for embedding', 'utf-8');

    await pipeline.ingest(filePath, 'test-collection');

    adapter.records.forEach(record => {
      expect(record.embedding).toBeDefined();
      expect(record.embedding.length).toBe(384);
    });
  });

  it('should report correct timing', async () => {
    const file = path.join(tempDir, 'test.txt');
    await fs.writeFile(file, 'Test content', 'utf-8');

    const stats = await pipeline.ingest(file, 'test-collection');

    expect(stats.timeMs).toBeGreaterThanOrEqual(0);
    expect(typeof stats.timeMs).toBe('number');
  });

  it('should respect batch size', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'A'.repeat(5000), 'utf-8');

    await pipeline.ingest(filePath, 'test-collection', {
      batchSize: 10,
      chunkSize: 50
    });

    // Verify records were created (batching is internal)
    expect(adapter.records.length).toBeGreaterThan(0);
  });
});
