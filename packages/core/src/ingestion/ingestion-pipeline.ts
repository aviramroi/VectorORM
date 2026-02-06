// packages/core/src/ingestion/ingestion-pipeline.ts
import type { VectorDBAdapter } from '../adapters/vector-db-adapter';
import type { Embedder } from '../embedders/embedder';
import type { VectorRecord } from '../types/vector-record';
import type { LoaderRegistry } from './loaders/loader-registry';
import type { TextChunker } from './chunkers/text-chunker';
import type { Document, IngestionConfig, IngestionStats, TextChunk } from './types';
import { RecursiveChunker } from './chunkers/recursive-chunker';
import { VerticalFields } from '../metadata/constants';
import * as path from 'path';

/**
 * Main ingestion pipeline orchestrator.
 * Coordinates loading, chunking, embedding, and upserting documents.
 */
export class IngestionPipeline {
  private defaultChunker: TextChunker;

  constructor(
    private adapter: VectorDBAdapter,
    private embedder: Embedder,
    private loaderRegistry: LoaderRegistry,
    chunker?: TextChunker
  ) {
    this.defaultChunker = chunker || new RecursiveChunker();
  }

  /**
   * Ingest documents into a vector database collection.
   * @param sources - File paths
   * @param collection - Target collection name
   * @param config - Optional ingestion configuration
   * @returns Statistics about the ingestion operation
   */
  async ingest(
    sources: string | string[],
    collection: string,
    config?: IngestionConfig
  ): Promise<IngestionStats> {
    const startTime = Date.now();
    const sourceArray = Array.isArray(sources) ? sources : [sources];

    const stats: IngestionStats = {
      documentsProcessed: 0,
      documentsSucceeded: 0,
      documentsFailed: 0,
      chunksCreated: 0,
      chunksUpserted: 0,
      timeMs: 0,
      errors: []
    };

    const totalDocuments = sourceArray.length;

    for (const source of sourceArray) {
      // Report loading stage
      config?.onProgress?.({
        stage: 'loading',
        documentsProcessed: stats.documentsProcessed,
        totalDocuments,
        chunksProcessed: stats.chunksUpserted,
        currentDocument: source
      });

      try {
        await this.ingestFile(source, collection, config, stats, totalDocuments);
        stats.documentsSucceeded++;
      } catch (error) {
        stats.documentsFailed++;
        stats.errors!.push({
          source,
          stage: 'load',
          error: error as Error
        });
      }
      stats.documentsProcessed++;
    }

    stats.timeMs = Date.now() - startTime;
    return stats;
  }

  private async ingestFile(
    filePath: string,
    collection: string,
    config: IngestionConfig | undefined,
    stats: IngestionStats,
    totalDocuments: number
  ): Promise<void> {
    // Load document
    const doc = await this.loaderRegistry.load(filePath);
    config?.onDocumentLoaded?.(doc);

    // Report chunking stage
    config?.onProgress?.({
      stage: 'chunking',
      documentsProcessed: stats.documentsProcessed,
      totalDocuments,
      chunksProcessed: stats.chunksUpserted,
      currentDocument: filePath
    });

    // Chunk text
    const chunker = config?.chunker || this.defaultChunker;
    const chunks = chunker.chunk(doc.text, {
      chunkSize: config?.chunkSize,
      chunkOverlap: config?.chunkOverlap
    });

    // Update source in chunk metadata
    for (const chunk of chunks) {
      chunk.metadata.source = doc.source;
    }

    stats.chunksCreated += chunks.length;
    config?.onChunksCreated?.(chunks);

    // Report embedding stage
    config?.onProgress?.({
      stage: 'embedding',
      documentsProcessed: stats.documentsProcessed,
      totalDocuments,
      chunksProcessed: stats.chunksUpserted,
      totalChunks: stats.chunksCreated,
      currentDocument: filePath
    });

    // Embed chunks
    const texts = chunks.map(c => c.text);
    const embeddings = await this.embedder.embedBatch(texts);

    // Build vector records with metadata
    const records: VectorRecord[] = chunks.map((chunk, i) => {
      const metadata = this.buildMetadata(doc, chunk, config);

      return {
        id: `${path.basename(doc.source)}:${chunk.index}`,
        embedding: embeddings[i],
        text: chunk.text,
        metadata
      };
    });

    // Report upserting stage
    config?.onProgress?.({
      stage: 'upserting',
      documentsProcessed: stats.documentsProcessed,
      totalDocuments,
      chunksProcessed: stats.chunksUpserted,
      totalChunks: stats.chunksCreated,
      currentDocument: filePath
    });

    // Upsert to database in batches
    const batchSize = config?.batchSize || 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await this.adapter.upsert(collection, batch);
      stats.chunksUpserted += batch.length;
    }
  }

  private buildMetadata(
    doc: Document,
    chunk: TextChunk,
    config: IngestionConfig | undefined
  ): Record<string, any> {
    // Auto-extract vertical metadata
    const basename = path.basename(doc.source, path.extname(doc.source));
    const dirname = path.dirname(doc.source);

    const autoMetadata: Record<string, any> = {
      [VerticalFields.SOURCE]: doc.source,
      [VerticalFields.DOC_TYPE]: doc.type,
      [VerticalFields.DOC_ID]: basename,
      [VerticalFields.PARTITION]: dirname
    };

    // Apply custom extractor
    const extractedMetadata = config?.metadataExtractor?.(doc) || {};

    // Apply user metadata
    const userMetadata = config?.metadata || {};

    // Add chunk metadata
    const chunkMetadata = {
      chunkIndex: chunk.metadata.chunkIndex,
      totalChunks: chunk.metadata.totalChunks,
      startChar: chunk.metadata.startChar,
      endChar: chunk.metadata.endChar
    };

    // Merge all metadata (user overrides auto-extracted)
    return {
      ...autoMetadata,
      ...extractedMetadata,
      ...userMetadata,
      ...chunkMetadata
    };
  }
}
