// packages/core/src/ingestion/chunkers/text-chunker.ts
import type { TextChunk, ChunkConfig } from '../types';

/**
 * Abstract interface for text chunking strategies.
 * Implementations split text into chunks with different algorithms.
 */
export interface TextChunker {
  /**
   * Chunk text into smaller pieces.
   * @param text - Text to chunk
   * @param config - Optional chunking configuration
   * @returns Array of text chunks with position metadata
   */
  chunk(text: string, config?: ChunkConfig): TextChunk[];
}

/**
 * Default chunk size in tokens (approximate).
 */
export const DEFAULT_CHUNK_SIZE = 500;

/**
 * Default chunk overlap in tokens (approximate).
 */
export const DEFAULT_CHUNK_OVERLAP = 50;

/**
 * Estimate token count from character count.
 * Simple heuristic: 1 token ≈ 4 characters for English text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate character count from token count.
 */
export function estimateChars(tokens: number): number {
  return tokens * 4;
}
