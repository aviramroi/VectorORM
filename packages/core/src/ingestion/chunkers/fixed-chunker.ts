// packages/core/src/ingestion/chunkers/fixed-chunker.ts
import type { TextChunker } from './text-chunker';
import type { TextChunk, ChunkConfig } from '../types';
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  estimateChars
} from './text-chunker';

/**
 * Fixed-size text chunker that splits at exact character boundaries.
 * Fast and predictable, but may split mid-sentence or mid-word.
 */
export class FixedChunker implements TextChunker {
  chunk(text: string, config?: ChunkConfig): TextChunk[] {
    if (!text) return [];

    const chunkSize = config?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const chunkOverlap = config?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

    const maxChars = estimateChars(chunkSize);
    const overlapChars = estimateChars(chunkOverlap);
    const step = maxChars - overlapChars;

    if (text.length <= maxChars) {
      return [{
        text,
        index: 0,
        metadata: {
          source: '',
          chunkIndex: 0,
          totalChunks: 1,
          startChar: 0,
          endChar: text.length
        }
      }];
    }

    const chunks: TextChunk[] = [];
    let position = 0;

    while (position < text.length) {
      const end = Math.min(text.length, position + maxChars);
      const chunkText = text.slice(position, end);

      chunks.push({
        text: chunkText,
        index: chunks.length,
        metadata: {
          source: '',
          chunkIndex: chunks.length,
          totalChunks: 0,  // Updated after loop
          startChar: position,
          endChar: end
        }
      });

      position += step;
      // Prevent infinite loop if step is 0
      if (step <= 0) break;
    }

    // Update totalChunks
    for (const chunk of chunks) {
      chunk.metadata.totalChunks = chunks.length;
    }

    return chunks;
  }
}
