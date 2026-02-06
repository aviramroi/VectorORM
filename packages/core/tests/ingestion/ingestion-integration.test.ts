// packages/core/tests/ingestion/ingestion-integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IngestionPipeline } from '../../src/ingestion/ingestion-pipeline';
import { LoaderRegistry } from '../../src/ingestion/loaders/loader-registry';
import { RecursiveChunker } from '../../src/ingestion/chunkers/recursive-chunker';
import { FixedChunker } from '../../src/ingestion/chunkers/fixed-chunker';
import { SentenceChunker } from '../../src/ingestion/chunkers/sentence-chunker';
import { VerticalFields } from '../../src/metadata/constants';
import type { VectorRecord } from '../../src/types/vector-record';
import type { DocumentLoader } from '../../src/ingestion/loaders/document-loader';
import type { Document } from '../../src/ingestion/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

class MockAdapter {
  records: VectorRecord[] = [];
  upsertCalls: number = 0;

  async upsert(collection: string, records: VectorRecord[]): Promise<void> {
    this.records.push(...records);
    this.upsertCalls++;
  }

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isConnected(): Promise<boolean> { return true; }
}

class MockEmbedder {
  embedCalls: number = 0;
  get dimensions() { return 384; }
  get modelName() { return 'mock'; }

  async embed(text: string): Promise<number[]> {
    this.embedCalls++;
    return new Array(384).fill(0);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    this.embedCalls++;
    return texts.map(() => new Array(384).fill(0));
  }
}

describe('Ingestion Integration Tests', () => {
  let adapter: MockAdapter;
  let embedder: MockEmbedder;
  let registry: LoaderRegistry;
  let tempDir: string;

  beforeEach(async () => {
    adapter = new MockAdapter();
    embedder = new MockEmbedder();
    registry = new LoaderRegistry();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'integration-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Full Pipeline Flow', () => {
    it('should complete load → chunk → embed → upsert for a text file', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'This is a test document with some meaningful content that should be chunked and embedded properly.', 'utf-8');

      const stats = await pipeline.ingest(filePath, 'test-collection');

      expect(stats.documentsProcessed).toBe(1);
      expect(stats.documentsSucceeded).toBe(1);
      expect(stats.documentsFailed).toBe(0);
      expect(stats.chunksCreated).toBeGreaterThan(0);
      expect(stats.chunksUpserted).toBe(stats.chunksCreated);
      expect(adapter.records.length).toBe(stats.chunksCreated);
      expect(embedder.embedCalls).toBeGreaterThan(0);
    });

    it('should complete pipeline for HTML file', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const filePath = path.join(tempDir, 'test.html');
      await fs.writeFile(filePath, '<html><body><h1>Title</h1><p>Content paragraph here.</p></body></html>', 'utf-8');

      const stats = await pipeline.ingest(filePath, 'test-collection');

      expect(stats.documentsSucceeded).toBe(1);
      expect(adapter.records.length).toBeGreaterThan(0);
      expect(adapter.records[0].metadata['__v_doc_type']).toBe('html');
    });

    it('should process multiple files of different types', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const txtFile = path.join(tempDir, 'doc.txt');
      const htmlFile = path.join(tempDir, 'page.html');
      const mdFile = path.join(tempDir, 'readme.md');

      await fs.writeFile(txtFile, 'Text document content.', 'utf-8');
      await fs.writeFile(htmlFile, '<html><body>HTML content here.</body></html>', 'utf-8');
      await fs.writeFile(mdFile, '# Markdown\n\nMarkdown content here.', 'utf-8');

      const stats = await pipeline.ingest([txtFile, htmlFile, mdFile], 'test-collection');

      expect(stats.documentsProcessed).toBe(3);
      expect(stats.documentsSucceeded).toBe(3);
      expect(stats.documentsFailed).toBe(0);
      expect(adapter.records.length).toBeGreaterThan(0);
    });
  });

  describe('Vertical Metadata Extraction', () => {
    it('should auto-extract all vertical fields', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const subDir = path.join(tempDir, 'legal', 'contracts');
      await fs.mkdir(subDir, { recursive: true });
      const filePath = path.join(subDir, 'lease-2024.txt');
      await fs.writeFile(filePath, 'Lease agreement content.', 'utf-8');

      await pipeline.ingest(filePath, 'test-collection');

      const record = adapter.records[0];
      expect(record.metadata[VerticalFields.SOURCE]).toBe(filePath);
      expect(record.metadata[VerticalFields.DOC_TYPE]).toBe('txt');
      expect(record.metadata[VerticalFields.DOC_ID]).toBe('lease-2024');
      expect(record.metadata[VerticalFields.PARTITION]).toContain('contracts');
    });

    it('should allow user metadata to override auto-extracted fields', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Content', 'utf-8');

      await pipeline.ingest(filePath, 'test-collection', {
        metadata: {
          [VerticalFields.PARTITION]: 'custom-partition',
          [VerticalFields.DOC_ID]: 'custom-id'
        }
      });

      const record = adapter.records[0];
      expect(record.metadata[VerticalFields.PARTITION]).toBe('custom-partition');
      expect(record.metadata[VerticalFields.DOC_ID]).toBe('custom-id');
      // Source should still be auto-extracted since not overridden
      expect(record.metadata[VerticalFields.SOURCE]).toBe(filePath);
    });

    it('should support metadataExtractor for custom logic', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const filePath = path.join(tempDir, 'report_2024_Q1.txt');
      await fs.writeFile(filePath, 'Quarterly report content.', 'utf-8');

      await pipeline.ingest(filePath, 'test-collection', {
        metadataExtractor: (doc) => {
          const match = doc.source.match(/(\d{4})_Q(\d)/);
          return {
            year: match?.[1],
            quarter: match?.[2]
          };
        }
      });

      const record = adapter.records[0];
      expect(record.metadata.year).toBe('2024');
      expect(record.metadata.quarter).toBe('1');
    });
  });

  describe('Chunking Strategies', () => {
    it('should work with RecursiveChunker (default)', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const filePath = path.join(tempDir, 'long.txt');
      await fs.writeFile(filePath, 'Paragraph one.\n\nParagraph two.\n\nParagraph three.\n\nParagraph four.', 'utf-8');

      const stats = await pipeline.ingest(filePath, 'test-collection', {
        chunkSize: 10,
        chunkOverlap: 0
      });

      expect(stats.chunksCreated).toBeGreaterThan(1);
    });

    it('should work with FixedChunker override', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const filePath = path.join(tempDir, 'long.txt');
      await fs.writeFile(filePath, 'A'.repeat(2000), 'utf-8');

      const stats = await pipeline.ingest(filePath, 'test-collection', {
        chunker: new FixedChunker(),
        chunkSize: 100,
        chunkOverlap: 0
      });

      expect(stats.chunksCreated).toBe(5); // 2000 / 400 = 5
    });

    it('should work with SentenceChunker override', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const filePath = path.join(tempDir, 'sentences.txt');
      await fs.writeFile(filePath, 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.', 'utf-8');

      const stats = await pipeline.ingest(filePath, 'test-collection', {
        chunker: new SentenceChunker(),
        chunkSize: 10,
        chunkOverlap: 0
      });

      expect(stats.chunksCreated).toBeGreaterThan(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle mixed success and failure', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const goodFile = path.join(tempDir, 'good.txt');
      const badFile = path.join(tempDir, 'missing.txt');
      const anotherGood = path.join(tempDir, 'also-good.txt');

      await fs.writeFile(goodFile, 'Good content', 'utf-8');
      await fs.writeFile(anotherGood, 'Also good content', 'utf-8');

      const stats = await pipeline.ingest(
        [goodFile, badFile, anotherGood],
        'test-collection'
      );

      expect(stats.documentsProcessed).toBe(3);
      expect(stats.documentsSucceeded).toBe(2);
      expect(stats.documentsFailed).toBe(1);
      expect(stats.errors!.length).toBe(1);
      expect(stats.errors![0].source).toBe(badFile);
    });

    it('should handle unsupported file types', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const filePath = path.join(tempDir, 'test.xyz');
      await fs.writeFile(filePath, 'content', 'utf-8');

      const stats = await pipeline.ingest(filePath, 'test-collection');

      expect(stats.documentsFailed).toBe(1);
      expect(stats.errors![0].error.message).toContain('No loader found');
    });
  });

  describe('Custom Loader Registration', () => {
    it('should work with custom loaders through registry', async () => {
      const customRegistry = new LoaderRegistry();

      class CSVLoader implements DocumentLoader {
        canHandle(p: string) { return /\.csv$/i.test(p); }
        async load(p: string): Promise<Document> {
          const text = await fs.readFile(p, 'utf-8');
          return { text, source: p, type: 'csv' };
        }
      }

      customRegistry.register(new CSVLoader());

      const pipeline = new IngestionPipeline(adapter as any, embedder as any, customRegistry);
      const filePath = path.join(tempDir, 'data.csv');
      await fs.writeFile(filePath, 'name,age\nAlice,30\nBob,25', 'utf-8');

      const stats = await pipeline.ingest(filePath, 'test-collection');

      expect(stats.documentsSucceeded).toBe(1);
      expect(adapter.records[0].metadata[VerticalFields.DOC_TYPE]).toBe('csv');
    });
  });

  describe('Batch Processing', () => {
    it('should batch upserts correctly', async () => {
      const pipeline = new IngestionPipeline(adapter as any, embedder as any, registry);
      const filePath = path.join(tempDir, 'long.txt');
      await fs.writeFile(filePath, 'A'.repeat(5000), 'utf-8');

      await pipeline.ingest(filePath, 'test-collection', {
        batchSize: 2,
        chunkSize: 50,
        chunkOverlap: 0
      });

      // With batchSize=2 and many chunks, there should be multiple upsert calls
      expect(adapter.upsertCalls).toBeGreaterThan(1);
      expect(adapter.records.length).toBeGreaterThan(2);
    });
  });
});
