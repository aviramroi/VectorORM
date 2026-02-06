import { describe, it, expect } from 'vitest';
import { EmbeddingThemeClassifier } from '../../../src/enrichment/classifiers/embedding-classifier';
import { Embedder } from '../../../src/embedders/embedder';

/**
 * MockEmbedder for testing purposes only.
 * Returns fixed-size deterministic embeddings based on text content.
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

describe('EmbeddingThemeClassifier', () => {
  it('should classify text based on cosine similarity to theme embeddings', async () => {
    const embedder = new MockEmbedder(384);
    const classifier = new EmbeddingThemeClassifier(
      ['technology', 'sports', 'finance'],
      embedder
    );

    // Text similar in length to 'technology' should match it better
    const result = await classifier.classify('tech');

    expect(result.theme).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.allScores).toBeDefined();
  });

  it('should lazy initialize theme embeddings on first classify call', async () => {
    const embedder = new MockEmbedder(384);
    const classifier = new EmbeddingThemeClassifier(
      ['technology', 'sports'],
      embedder
    );

    // First call should compute theme embeddings
    const result1 = await classifier.classify('some text');
    expect(result1.theme).toBeDefined();

    // Second call should reuse computed embeddings
    const result2 = await classifier.classify('other text');
    expect(result2.theme).toBeDefined();
  });

  it('should accept precomputed theme embeddings in constructor', async () => {
    const embedder = new MockEmbedder(384);

    // Precompute embeddings
    const themeEmbeddings: Record<string, number[]> = {
      technology: await embedder.embed('technology'),
      sports: await embedder.embed('sports'),
    };

    const classifier = new EmbeddingThemeClassifier(
      ['technology', 'sports'],
      embedder,
      themeEmbeddings
    );

    const result = await classifier.classify('some text');
    expect(result.theme).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should return confidence scores between 0 and 1', async () => {
    const embedder = new MockEmbedder(384);
    const classifier = new EmbeddingThemeClassifier(
      ['technology', 'sports', 'finance'],
      embedder
    );

    const result = await classifier.classify('machine learning and artificial intelligence');

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    if (result.allScores) {
      Object.values(result.allScores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    }
  });

  it('should handle empty text with uniform scores', async () => {
    const embedder = new MockEmbedder(384);
    const classifier = new EmbeddingThemeClassifier(
      ['technology', 'sports', 'finance'],
      embedder
    );

    const result = await classifier.classify('');

    expect(result.theme).toBe('technology'); // First theme
    expect(result.confidence).toBeCloseTo(1 / 3, 5); // Uniform score
    expect(result.allScores).toBeDefined();

    if (result.allScores) {
      expect(result.allScores['technology']).toBeCloseTo(1 / 3, 5);
      expect(result.allScores['sports']).toBeCloseTo(1 / 3, 5);
      expect(result.allScores['finance']).toBeCloseTo(1 / 3, 5);
    }
  });

  it('should include all theme scores in result', async () => {
    const embedder = new MockEmbedder(384);
    const classifier = new EmbeddingThemeClassifier(
      ['technology', 'sports', 'finance'],
      embedder
    );

    const result = await classifier.classify('software development');

    expect(result.allScores).toBeDefined();
    expect(Object.keys(result.allScores || {})).toHaveLength(3);
    expect(result.allScores).toHaveProperty('technology');
    expect(result.allScores).toHaveProperty('sports');
    expect(result.allScores).toHaveProperty('finance');
  });

  it('should classify batch of texts', async () => {
    const embedder = new MockEmbedder(384);
    const classifier = new EmbeddingThemeClassifier(
      ['technology', 'sports', 'finance'],
      embedder
    );

    const results = await classifier.classifyBatch([
      'machine learning',
      'football game',
      'stock market',
    ]);

    expect(results).toHaveLength(3);
    results.forEach((result) => {
      expect(result.theme).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});
