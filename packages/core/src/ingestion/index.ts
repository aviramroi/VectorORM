// packages/core/src/ingestion/index.ts
export { IngestionPipeline } from './ingestion-pipeline';
export { LoaderRegistry } from './loaders/loader-registry';
export { TextLoader } from './loaders/text-loader';
export { PDFLoader } from './loaders/pdf-loader';
export { DOCXLoader } from './loaders/docx-loader';
export { HTMLLoader } from './loaders/html-loader';
export { RecursiveChunker } from './chunkers/recursive-chunker';
export { FixedChunker } from './chunkers/fixed-chunker';
export { SentenceChunker } from './chunkers/sentence-chunker';
export type { Document, IngestionConfig, IngestionStats, TextChunk, ChunkConfig, ProgressInfo } from './types';
export type { DocumentLoader } from './loaders/document-loader';
export type { TextChunker } from './chunkers/text-chunker';
export { DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP, estimateTokens, estimateChars } from './chunkers/text-chunker';
