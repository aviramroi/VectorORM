// packages/core/tests/ingestion/chunkers/text-chunker.test.ts
import { describe, it, expect } from 'vitest';
import type { TextChunk, ChunkConfig } from '../../../src/ingestion/types';
import { estimateTokens, estimateChars, DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP } from '../../../src/ingestion/chunkers/text-chunker';

describe('TextChunker Interface', () => {
  it('should define TextChunk with correct shape', () => {
    const chunk: TextChunk = {
      text: 'sample text',
      index: 0,
      metadata: {
        source: '/path/to/doc.txt',
        chunkIndex: 0,
        totalChunks: 5,
        startChar: 0,
        endChar: 11
      }
    };

    expect(chunk.text).toBe('sample text');
    expect(chunk.index).toBe(0);
    expect(chunk.metadata.chunkIndex).toBe(0);
  });

  it('should define ChunkConfig with optional fields', () => {
    const config: ChunkConfig = {
      chunkSize: 500,
      chunkOverlap: 50
    };

    expect(config.chunkSize).toBe(500);
    expect(config.chunkOverlap).toBe(50);
  });

  it('should have correct default values', () => {
    expect(DEFAULT_CHUNK_SIZE).toBe(500);
    expect(DEFAULT_CHUNK_OVERLAP).toBe(50);
  });

  it('should estimate tokens from text', () => {
    expect(estimateTokens('Hello World!')).toBe(3); // 12 chars / 4
  });

  it('should estimate chars from tokens', () => {
    expect(estimateChars(100)).toBe(400); // 100 * 4
  });
});
