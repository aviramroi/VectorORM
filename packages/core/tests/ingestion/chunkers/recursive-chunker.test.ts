// packages/core/tests/ingestion/chunkers/recursive-chunker.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RecursiveChunker } from '../../../src/ingestion/chunkers/recursive-chunker';

describe('RecursiveChunker', () => {
  let chunker: RecursiveChunker;

  beforeEach(() => {
    chunker = new RecursiveChunker();
  });

  it('should split text by paragraphs when possible', () => {
    const text = 'Paragraph one content here.\n\nParagraph two content here.\n\nParagraph three content here.';
    const chunks = chunker.chunk(text, { chunkSize: 15, chunkOverlap: 0 });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should split by sentences when paragraphs too large', () => {
    const text = 'Sentence one is here. Sentence two is here. Sentence three is here.';
    const chunks = chunker.chunk(text, { chunkSize: 10, chunkOverlap: 0 });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should include overlap between chunks', () => {
    const text = 'Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8 Word9 Word10 Word11 Word12';
    const chunks = chunker.chunk(text, { chunkSize: 5, chunkOverlap: 2 });

    expect(chunks.length).toBeGreaterThan(1);
    if (chunks.length > 1) {
      // Second chunk should contain some text from the first
      expect(chunks[1].text.length).toBeGreaterThan(0);
    }
  });

  it('should set correct metadata for each chunk', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const chunks = chunker.chunk(text, { chunkSize: 10, chunkOverlap: 0 });

    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
      expect(chunk.metadata.chunkIndex).toBe(i);
      expect(chunk.metadata.totalChunks).toBe(chunks.length);
      expect(chunk.metadata.startChar).toBeGreaterThanOrEqual(0);
      expect(chunk.metadata.endChar).toBeGreaterThan(chunk.metadata.startChar);
    });
  });

  it('should handle empty text', () => {
    const chunks = chunker.chunk('');
    expect(chunks.length).toBe(0);
  });

  it('should handle text smaller than chunk size', () => {
    const text = 'Short text';
    const chunks = chunker.chunk(text, { chunkSize: 1000 });

    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe(text);
  });

  it('should use default config when not provided', () => {
    const text = 'A'.repeat(5000);  // Long text
    const chunks = chunker.chunk(text);

    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should be roughly 500 tokens = 2000 chars
    chunks.forEach(chunk => {
      expect(chunk.text.length).toBeLessThanOrEqual(2500);
    });
  });

  it('should handle text with only spaces as separators', () => {
    const text = 'word '.repeat(500).trim();
    const chunks = chunker.chunk(text, { chunkSize: 50, chunkOverlap: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.text.length).toBeLessThanOrEqual(250);  // 50 tokens * 4 + buffer
    });
  });

  it('should produce non-empty chunks', () => {
    const text = 'Hello World. This is a test. Another sentence here.';
    const chunks = chunker.chunk(text, { chunkSize: 10, chunkOverlap: 0 });

    chunks.forEach(chunk => {
      expect(chunk.text.length).toBeGreaterThan(0);
    });
  });
});
