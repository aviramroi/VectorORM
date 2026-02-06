// packages/core/src/ingestion/chunkers/recursive-chunker.ts
import type { TextChunker } from './text-chunker';
import type { TextChunk, ChunkConfig } from '../types';
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  estimateChars
} from './text-chunker';

/**
 * Recursive text chunker that tries different separators hierarchically.
 * Tries to split by paragraphs first, then sentences, then words, then characters.
 */
export class RecursiveChunker implements TextChunker {
  private readonly separators = [
    '\n\n',      // Paragraphs (double newline)
    '\n',        // Lines (single newline)
    '. ',        // Sentences (period + space)
    ' ',         // Words (space)
    ''           // Characters (last resort)
  ];

  chunk(text: string, config?: ChunkConfig): TextChunk[] {
    if (!text) return [];

    const chunkSize = config?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const chunkOverlap = config?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

    const maxChars = estimateChars(chunkSize);
    const overlapChars = estimateChars(chunkOverlap);

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

    const splits = this.recursiveSplit(text, maxChars, 0);
    const chunks = this.addOverlap(splits, overlapChars);

    return chunks.map((chunk, index) => ({
      text: chunk.text,
      index,
      metadata: {
        source: '',  // Will be set by pipeline
        chunkIndex: index,
        totalChunks: chunks.length,
        startChar: chunk.start,
        endChar: chunk.end
      }
    }));
  }

  private recursiveSplit(
    text: string,
    maxChars: number,
    separatorIndex: number
  ): Array<{ text: string; start: number; end: number }> {
    if (text.length <= maxChars) {
      return [{ text, start: 0, end: text.length }];
    }

    if (separatorIndex >= this.separators.length) {
      // Last resort: split by character
      const result: Array<{ text: string; start: number; end: number }> = [];
      for (let i = 0; i < text.length; i += maxChars) {
        result.push({
          text: text.slice(i, i + maxChars),
          start: i,
          end: Math.min(i + maxChars, text.length)
        });
      }
      return result;
    }

    const separator = this.separators[separatorIndex];
    const parts = separator ? text.split(separator) : [text];

    if (parts.length <= 1) {
      // Separator didn't split, try next separator
      return this.recursiveSplit(text, maxChars, separatorIndex + 1);
    }

    // Group parts into chunks that fit within maxChars
    const result: Array<{ text: string; start: number; end: number }> = [];
    let currentParts: string[] = [];
    let currentStart = 0;
    let runningOffset = 0;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const combined = currentParts.length > 0
        ? [...currentParts, part].join(separator)
        : part;

      if (combined.length <= maxChars) {
        if (currentParts.length === 0) {
          currentStart = runningOffset;
        }
        currentParts.push(part);
      } else {
        // Save current chunk if non-empty
        if (currentParts.length > 0) {
          const chunkText = currentParts.join(separator);
          result.push({
            text: chunkText,
            start: currentStart,
            end: currentStart + chunkText.length
          });
        }
        // Start new chunk with current part
        currentStart = runningOffset;
        // If single part is too large, recursively split it
        if (part.length > maxChars) {
          const subSplits = this.recursiveSplit(part, maxChars, separatorIndex + 1);
          for (const sub of subSplits) {
            result.push({
              text: sub.text,
              start: currentStart + sub.start,
              end: currentStart + sub.end
            });
          }
          currentParts = [];
        } else {
          currentParts = [part];
        }
      }
      runningOffset += part.length + (i < parts.length - 1 ? separator.length : 0);
    }

    // Save remaining chunk
    if (currentParts.length > 0) {
      const chunkText = currentParts.join(separator);
      result.push({
        text: chunkText,
        start: currentStart,
        end: currentStart + chunkText.length
      });
    }

    return result;
  }

  private addOverlap(
    chunks: Array<{ text: string; start: number; end: number }>,
    overlapChars: number
  ): Array<{ text: string; start: number; end: number }> {
    if (overlapChars === 0 || chunks.length <= 1) {
      return chunks;
    }

    const result = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currChunk = chunks[i];

      // Get last N chars from previous chunk
      const overlapText = prevChunk.text.slice(-overlapChars);

      result.push({
        text: overlapText + currChunk.text,
        start: Math.max(0, prevChunk.end - overlapChars),
        end: currChunk.end
      });
    }

    return result;
  }
}
