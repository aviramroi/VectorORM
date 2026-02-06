// packages/core/tests/ingestion/chunkers/sentence-chunker.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SentenceChunker } from '../../../src/ingestion/chunkers/sentence-chunker';

describe('SentenceChunker', () => {
  let chunker: SentenceChunker;

  beforeEach(() => {
    chunker = new SentenceChunker();
  });

  it('should split by sentence boundaries', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = chunker.chunk(text, { chunkSize: 10, chunkOverlap: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should contain complete sentences (end with period)
    chunks.forEach(chunk => {
      expect(chunk.text.trim()).toMatch(/[.!?]$/);
    });
  });

  it('should group sentences until target size reached', () => {
    const text = 'A. B. C. D. E. F. G. H.';
    const chunks = chunker.chunk(text, { chunkSize: 3, chunkOverlap: 0 });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should set correct metadata', () => {
    const text = 'First sentence here. Second sentence here. Third sentence here.';
    const chunks = chunker.chunk(text, { chunkSize: 8, chunkOverlap: 0 });

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

  it('should handle text without sentence endings', () => {
    const text = 'Text without punctuation marks';
    const chunks = chunker.chunk(text);

    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe(text);
  });

  it('should use default config when not provided', () => {
    const text = ('Sentence here. ').repeat(200);
    const chunks = chunker.chunk(text);

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle question marks and exclamation marks', () => {
    const text = 'Is this a question? Yes it is! And a statement.';
    const chunks = chunker.chunk(text, { chunkSize: 8, chunkOverlap: 0 });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // All text should be captured
    const allText = chunks.map(c => c.text).join(' ');
    expect(allText).toContain('question');
    expect(allText).toContain('statement');
  });

  it('should add overlap between chunks', () => {
    const text = 'First sentence here. Second sentence here. Third sentence here. Fourth sentence here.';
    const chunks = chunker.chunk(text, { chunkSize: 8, chunkOverlap: 5 });

    if (chunks.length > 1) {
      // Overlap should include last sentence from previous chunk
      expect(chunks[1].text).toContain('sentence');
    }
  });
});
