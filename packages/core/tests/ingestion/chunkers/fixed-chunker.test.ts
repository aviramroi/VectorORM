// packages/core/tests/ingestion/chunkers/fixed-chunker.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { FixedChunker } from '../../../src/ingestion/chunkers/fixed-chunker';

describe('FixedChunker', () => {
  let chunker: FixedChunker;

  beforeEach(() => {
    chunker = new FixedChunker();
  });

  it('should split text at exact character boundaries', () => {
    const text = 'A'.repeat(1000);
    const chunks = chunker.chunk(text, { chunkSize: 100, chunkOverlap: 0 });

    // Each chunk should be exactly 400 chars (100 tokens * 4) except possibly the last
    expect(chunks.length).toBe(3); // 1000 / 400 = 2.5 → 3 chunks
    expect(chunks[0].text.length).toBe(400);
    expect(chunks[1].text.length).toBe(400);
    expect(chunks[2].text.length).toBe(200);
  });

  it('should add overlap between chunks', () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(5); // 130 chars
    const chunks = chunker.chunk(text, { chunkSize: 10, chunkOverlap: 2 });

    expect(chunks.length).toBeGreaterThan(1);
    // Check overlap exists - second chunk should start with content from end of first
    if (chunks.length > 1) {
      const overlapChars = 2 * 4; // 2 tokens = 8 chars
      const endOfFirst = chunks[0].text.slice(-overlapChars);
      const startOfSecond = chunks[1].text.slice(0, overlapChars);
      expect(startOfSecond).toBe(endOfFirst);
    }
  });

  it('should set correct metadata', () => {
    const text = 'Test text for chunking purposes here';
    const chunks = chunker.chunk(text, { chunkSize: 3, chunkOverlap: 0 });

    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.metadata.chunkIndex).toBe(i);
      expect(chunk.metadata.totalChunks).toBe(chunks.length);
    });
  });

  it('should handle empty text', () => {
    const chunks = chunker.chunk('');
    expect(chunks.length).toBe(0);
  });

  it('should handle text smaller than chunk size', () => {
    const text = 'Short';
    const chunks = chunker.chunk(text, { chunkSize: 1000 });

    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe(text);
  });

  it('should use default config when not provided', () => {
    const text = 'A'.repeat(5000);
    const chunks = chunker.chunk(text);

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('may split mid-word or mid-sentence', () => {
    const text = 'This is a sentence that will be split mid-word definitely.';
    const chunks = chunker.chunk(text, { chunkSize: 5, chunkOverlap: 0 });

    // Fixed chunker doesn't respect word boundaries
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should track startChar and endChar correctly', () => {
    const text = 'ABCDEFGHIJKLMNOPQRST'; // 20 chars
    const chunks = chunker.chunk(text, { chunkSize: 3, chunkOverlap: 0 });
    // 3 tokens = 12 chars per chunk

    expect(chunks[0].metadata.startChar).toBe(0);
    expect(chunks[0].metadata.endChar).toBe(12);
    expect(chunks[1].metadata.startChar).toBe(12);
    expect(chunks[1].metadata.endChar).toBe(20);
  });
});
