// packages/core/src/ingestion/types.ts
/**
 * Loaded document with extracted text and metadata.
 */
export interface Document {
  /** Full document text */
  text: string;
  /** File path or source identifier */
  source: string;
  /** File type/extension (pdf, txt, docx, html) */
  type: string;
  /** Optional user-provided or loader-extracted metadata */
  metadata?: Record<string, any>;
}

/**
 * Statistics returned by ingestion operations.
 */
export interface IngestionStats {
  documentsProcessed: number;
  documentsSucceeded: number;
  documentsFailed: number;
  chunksCreated: number;
  chunksUpserted: number;
  timeMs: number;
  errors?: Array<{
    source: string;
    stage: 'load' | 'chunk' | 'embed' | 'upsert';
    error: Error;
  }>;
}

/**
 * Configuration for ingestion operations.
 */
export interface IngestionConfig {
  // Chunking
  chunkSize?: number;           // Default: 500 tokens
  chunkOverlap?: number;        // Default: 50 tokens
  chunker?: any;                // TextChunker (defined later)

  // Metadata
  metadata?: Record<string, any>;  // Applied to all chunks
  metadataExtractor?: (doc: Document) => Record<string, any>;  // Per-document

  // Processing
  batchSize?: number;           // Default: 100 chunks
  concurrency?: number;         // Default: 5

  // Callbacks
  onProgress?: (progress: ProgressInfo) => void;
  onDocumentLoaded?: (doc: Document) => void;
  onChunksCreated?: (chunks: any[]) => void;
}

/**
 * Progress information during ingestion.
 */
export interface ProgressInfo {
  stage: 'loading' | 'chunking' | 'embedding' | 'upserting';
  documentsProcessed: number;
  totalDocuments: number;
  chunksProcessed: number;
  totalChunks?: number;
  currentDocument?: string;
}

/**
 * Text chunk with position metadata.
 */
export interface TextChunk {
  text: string;
  index: number;
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    startChar: number;
    endChar: number;
  };
}

/**
 * Configuration for chunking operations.
 */
export interface ChunkConfig {
  chunkSize?: number;
  chunkOverlap?: number;
}
