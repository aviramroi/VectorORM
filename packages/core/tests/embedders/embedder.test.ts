/**
 * Tests for Embedder abstraction layer.
 *
 * Following TDD:
 * 1. Write tests first (they will fail)
 * 2. Implement minimal code to pass
 * 3. Verify all tests pass
 */

import { describe, it, expect } from 'vitest';
import { Embedder } from '../../src/embedders/embedder';

/**
 * MockEmbedder for testing purposes only.
 * Returns fixed-size random embeddings for testing the abstract interface.
 */
class MockEmbedder extends Embedder {
  constructor(
    private readonly _dimensions: number = 384,
    private readonly _modelName: string = 'mock-embedder-v1'
  ) {
    super();
  }

  get dimensions(): number {
    return this._dimensions;
  }

  get modelName(): string {
    return this._modelName;
  }

  async embed(text: string): Promise<number[]> {
    // Generate deterministic but varied embeddings based on text length
    const seed = text.length;
    const embedding = new Array(this._dimensions);
    for (let i = 0; i < this._dimensions; i++) {
      // Simple deterministic pseudo-random generation for testing
      embedding[i] = Math.sin(seed + i) * 0.5 + 0.5;
    }
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Process in order to maintain sequence
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

describe('Embedder', () => {
  describe('Abstract Class', () => {
    it('should not allow direct instantiation of abstract class', () => {
      // TypeScript prevents this at compile time, but we can verify the concept
      // by ensuring our mock implementation is required
      expect(() => {
        // @ts-expect-error - Testing that abstract class cannot be instantiated
        new Embedder();
      }).toThrow();
    });
  });

  describe('MockEmbedder', () => {
    it('should return embeddings with correct dimensions', async () => {
      const embedder = new MockEmbedder(384);
      const text = 'test text';

      const embedding = await embedder.embed(text);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(384);
      expect(embedding.every((val) => typeof val === 'number')).toBe(true);
    });

    it('should return array of embeddings for batch processing', async () => {
      const embedder = new MockEmbedder(384);
      const texts = ['text one', 'text two', 'text three'];

      const embeddings = await embedder.embedBatch(texts);

      expect(embeddings).toBeInstanceOf(Array);
      expect(embeddings.length).toBe(3);
      expect(embeddings[0].length).toBe(384);
      expect(embeddings[1].length).toBe(384);
      expect(embeddings[2].length).toBe(384);
    });

    it('should maintain order in batch embeddings', async () => {
      const embedder = new MockEmbedder(384);
      const texts = ['first', 'second', 'third'];

      const embeddings = await embedder.embedBatch(texts);

      // Verify that embeddings are deterministic and order-preserving
      const embedding1 = await embedder.embed('first');
      const embedding2 = await embedder.embed('second');
      const embedding3 = await embedder.embed('third');

      expect(embeddings[0]).toEqual(embedding1);
      expect(embeddings[1]).toEqual(embedding2);
      expect(embeddings[2]).toEqual(embedding3);
    });
  });

  describe('Embedder Properties', () => {
    it('should expose dimensions property', () => {
      const embedder = new MockEmbedder(768, 'test-model');

      expect(embedder.dimensions).toBe(768);
    });

    it('should expose modelName property', () => {
      const embedder = new MockEmbedder(384, 'custom-model-v2');

      expect(embedder.modelName).toBe('custom-model-v2');
    });
  });
});
