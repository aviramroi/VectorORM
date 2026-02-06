// packages/core/src/ingestion/chunkers/sentence-chunker.ts
import type { TextChunker } from './text-chunker';
import type { TextChunk, ChunkConfig } from '../types';
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  estimateChars
} from './text-chunker';

/**
 * Sentence-aware chunker that splits on sentence boundaries.
 * Uses a simple regex-based sentence splitter for portability.
 */
export class SentenceChunker implements TextChunker {
  chunk(text: string, config?: ChunkConfig): TextChunk[] {
    if (!text) return [];

    const chunkSize = config?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const chunkOverlap = config?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

    const maxChars = estimateChars(chunkSize);
    const overlapChars = estimateChars(chunkOverlap);

    // Split into sentences using regex
    const sentences = this.splitSentences(text);

    if (sentences.length === 0) {
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

    // Group sentences into chunks
    const rawChunks: Array<{ text: string; start: number; end: number }> = [];
    let currentSentences: string[] = [];
    let currentStart = 0;

    for (const sentence of sentences) {
      const combined = currentSentences.length > 0
        ? [...currentSentences, sentence].join(' ')
        : sentence;

      if (currentSentences.length === 0) {
        currentSentences = [sentence];
        currentStart = text.indexOf(sentence);
      } else if (combined.length <= maxChars) {
        currentSentences.push(sentence);
      } else {
        // Save current chunk
        const chunkText = currentSentences.join(' ');
        rawChunks.push({
          text: chunkText,
          start: currentStart,
          end: currentStart + chunkText.length
        });

        // Start new chunk
        currentSentences = [sentence];
        currentStart = text.indexOf(sentence, currentStart + 1);
        if (currentStart === -1) currentStart = 0;
      }
    }

    // Save last chunk
    if (currentSentences.length > 0) {
      const chunkText = currentSentences.join(' ');
      rawChunks.push({
        text: chunkText,
        start: currentStart,
        end: currentStart + chunkText.length
      });
    }

    // Add overlap
    const withOverlap = this.addSentenceOverlap(rawChunks, overlapChars);

    return withOverlap.map((chunk, index) => ({
      text: chunk.text,
      index,
      metadata: {
        source: '',
        chunkIndex: index,
        totalChunks: withOverlap.length,
        startChar: chunk.start,
        endChar: chunk.end
      }
    }));
  }

  private splitSentences(text: string): string[] {
    // Split on sentence-ending punctuation followed by space or end of string
    const parts = text.match(/[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g);
    if (!parts) return [text];
    return parts.map(s => s.trim()).filter(s => s.length > 0);
  }

  private addSentenceOverlap(
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

      // Find last sentence from previous chunk to use as overlap
      const prevSentences = this.splitSentences(prevChunk.text);
      const lastSentence = prevSentences[prevSentences.length - 1] || '';

      if (lastSentence && lastSentence.length <= overlapChars) {
        result.push({
          text: lastSentence + ' ' + currChunk.text,
          start: Math.max(0, prevChunk.end - lastSentence.length),
          end: currChunk.end
        });
      } else {
        result.push(currChunk);
      }
    }

    return result;
  }
}
