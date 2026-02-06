/**
 * Embedding-based theme classifier using cosine similarity
 * Computes similarity between text embeddings and theme embeddings
 */

import type { ThemeClassifier, ThemeClassification } from './theme-classifier';
import type { Embedder } from '../../embedders/embedder';

/**
 * Embedding-based classification using cosine similarity.
 *
 * This classifier computes embeddings for text and themes, then uses cosine
 * similarity to determine which theme is most similar to the text. Theme
 * embeddings are computed lazily on the first classify() call, or can be
 * provided precomputed in the constructor.
 *
 * Features:
 * - Lazy initialization: theme embeddings computed on first classify()
 * - Optional precomputed embeddings for faster startup
 * - Cosine similarity: dotProduct / (normA * normB)
 * - Normalize similarity [-1,1] to confidence [0,1]
 * - Handles empty text with uniform scores
 *
 * @example
 * ```typescript
 * const embedder = new OpenAIEmbedder();
 * const classifier = new EmbeddingThemeClassifier(['technology', 'sports', 'finance'], embedder);
 * const result = await classifier.classify('Machine learning is transforming AI');
 * console.log(result.theme); // 'technology'
 * console.log(result.confidence); // 0.89
 * ```
 */
export class EmbeddingThemeClassifier implements ThemeClassifier {
  private themeEmbeddings: Record<string, number[]> | null = null;
  private embedder: Embedder;
  private themes: string[];

  /**
   * Creates a new EmbeddingThemeClassifier
   *
   * @param themes - Array of theme labels to classify into
   * @param embedder - Embedder instance to use for generating embeddings
   * @param precomputedEmbeddings - Optional precomputed theme embeddings for faster startup
   *
   * @example
   * ```typescript
   * // Lazy initialization
   * const classifier = new EmbeddingThemeClassifier(['technology', 'sports'], embedder);
   *
   * // With precomputed embeddings
   * const themeEmbeddings = {
   *   technology: await embedder.embed('technology'),
   *   sports: await embedder.embed('sports')
   * };
   * const classifier = new EmbeddingThemeClassifier(['technology', 'sports'], embedder, themeEmbeddings);
   * ```
   */
  constructor(
    themes: string[],
    embedder: Embedder,
    precomputedEmbeddings?: Record<string, number[]>
  ) {
    this.themes = themes;
    this.embedder = embedder;
    this.themeEmbeddings = precomputedEmbeddings || null;
  }

  /**
   * Lazy loads theme embeddings on first use
   * Computes embeddings for all theme labels if not already computed
   *
   * @returns Promise that resolves to the theme embeddings map
   */
  private async ensureThemeEmbeddings(): Promise<Record<string, number[]>> {
    if (!this.themeEmbeddings) {
      this.themeEmbeddings = {};

      // Compute embeddings for all themes
      const embeddings = await this.embedder.embedBatch(this.themes);

      for (let i = 0; i < this.themes.length; i++) {
        this.themeEmbeddings[this.themes[i]] = embeddings[i];
      }
    }

    return this.themeEmbeddings;
  }

  /**
   * Compute cosine similarity between two vectors
   *
   * Cosine similarity = dotProduct / (normA * normB)
   * Returns value in range [-1, 1] where:
   * - 1 means vectors point in the same direction
   * - 0 means vectors are orthogonal
   * - -1 means vectors point in opposite directions
   *
   * @param a - First vector
   * @param b - Second vector
   * @returns Cosine similarity between the vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length for cosine similarity');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    // Avoid division by zero
    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Normalize cosine similarity from [-1, 1] to confidence score [0, 1]
   *
   * Uses linear transformation: (similarity + 1) / 2
   *
   * @param similarity - Cosine similarity value in range [-1, 1]
   * @returns Confidence score in range [0, 1]
   */
  private normalizeToConfidence(similarity: number): number {
    return (similarity + 1) / 2;
  }

  /**
   * Classify a single text into one of the provided themes
   *
   * @param text - The text content to classify
   * @returns A promise that resolves to the theme classification result
   *
   * @example
   * ```typescript
   * const classifier = new EmbeddingThemeClassifier(['technology', 'sports'], embedder);
   * const result = await classifier.classify('Machine learning and AI');
   * console.log(result.theme); // 'technology'
   * console.log(result.confidence); // 0.92
   * console.log(result.allScores); // { technology: 0.92, sports: 0.45 }
   * ```
   */
  async classify(text: string): Promise<ThemeClassification> {
    // Handle empty text with uniform scores
    if (!text || text.trim().length === 0) {
      const uniformScore = 1.0 / this.themes.length;
      const allScores: Record<string, number> = {};

      for (const theme of this.themes) {
        allScores[theme] = uniformScore;
      }

      return {
        theme: this.themes[0], // Return first theme
        confidence: uniformScore,
        allScores,
      };
    }

    // Ensure theme embeddings are computed
    const themeEmbeddings = await this.ensureThemeEmbeddings();

    // Compute text embedding
    const textEmbedding = await this.embedder.embed(text);

    // Compute cosine similarity for each theme
    const similarities: Record<string, number> = {};
    let maxSimilarity = -Infinity;
    let winningTheme = this.themes[0];

    for (const theme of this.themes) {
      const themeEmbedding = themeEmbeddings[theme];
      const similarity = this.cosineSimilarity(textEmbedding, themeEmbedding);
      similarities[theme] = similarity;

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        winningTheme = theme;
      }
    }

    // Normalize similarities to confidence scores [0, 1]
    const allScores: Record<string, number> = {};
    for (const theme of this.themes) {
      allScores[theme] = this.normalizeToConfidence(similarities[theme]);
    }

    return {
      theme: winningTheme,
      confidence: this.normalizeToConfidence(maxSimilarity),
      allScores,
    };
  }

  /**
   * Classify multiple texts efficiently
   *
   * Ensures theme embeddings are loaded once, then processes all texts.
   * Text embeddings are computed in batch for efficiency.
   *
   * @param texts - Array of text contents to classify
   * @returns A promise that resolves to an array of theme classifications
   *
   * @example
   * ```typescript
   * const classifier = new EmbeddingThemeClassifier(['technology', 'sports', 'finance'], embedder);
   * const results = await classifier.classifyBatch([
   *   'Machine learning is transforming AI',
   *   'The football team won the championship',
   *   'Stock market hits record high'
   * ]);
   * // results[0].theme === 'technology'
   * // results[1].theme === 'sports'
   * // results[2].theme === 'finance'
   * ```
   */
  async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
    // Ensure theme embeddings are loaded once
    await this.ensureThemeEmbeddings();

    // Process each text (classify already has embeddings cached)
    const results: ThemeClassification[] = [];
    for (const text of texts) {
      const result = await this.classify(text);
      results.push(result);
    }

    return results;
  }
}
