/**
 * Zero-shot theme classifier using Transformers.js
 * Uses pre-trained models without requiring fine-tuning or training data
 */

import { pipeline } from '@xenova/transformers';
import type { ThemeClassifier, ThemeClassification } from './theme-classifier';

/**
 * Zero-shot classification using pre-trained transformer models.
 *
 * This classifier uses Hugging Face's zero-shot classification pipeline
 * to classify text into themes without requiring training data or fine-tuning.
 * The model is loaded lazily on the first classify() call to improve startup time.
 *
 * Features:
 * - No training data required
 * - Works with any set of theme labels
 * - Lazy model loading (loads on first classification)
 * - Sequential batch processing to avoid memory issues
 * - Handles empty text with uniform scores
 *
 * @example
 * ```typescript
 * const classifier = new ZeroShotThemeClassifier(['technology', 'sports', 'business']);
 * const result = await classifier.classify('Machine learning is transforming AI');
 * console.log(result.theme); // 'technology'
 * console.log(result.confidence); // 0.95
 * ```
 */
export class ZeroShotThemeClassifier implements ThemeClassifier {
  private model: any = null;
  private modelName: string;
  private themes: string[];

  /**
   * Creates a new ZeroShotThemeClassifier
   *
   * @param themes - Array of theme labels to classify into
   * @param modelName - Name of the Hugging Face model to use (default: 'Xenova/distilbert-base-uncased-mnli')
   *
   * @example
   * ```typescript
   * // Use default model
   * const classifier = new ZeroShotThemeClassifier(['technology', 'sports', 'finance']);
   *
   * // Use custom model
   * const classifier = new ZeroShotThemeClassifier(
   *   ['positive', 'negative'],
   *   'Xenova/distilbert-base-uncased-mnli'
   * );
   * ```
   */
  constructor(
    themes: string[],
    modelName: string = 'Xenova/distilbert-base-uncased-mnli'
  ) {
    this.themes = themes;
    this.modelName = modelName;
  }

  /**
   * Lazy loads the zero-shot classification model
   * Only loads once on first call, subsequent calls reuse the loaded model
   *
   * @returns Promise that resolves to the loaded pipeline
   */
  private async ensureModelLoaded(): Promise<any> {
    if (!this.model) {
      this.model = await pipeline('zero-shot-classification', this.modelName);
    }
    return this.model;
  }

  /**
   * Classify a single text into one of the provided themes
   *
   * @param text - The text content to classify
   * @returns A promise that resolves to the theme classification result
   *
   * @example
   * ```typescript
   * const classifier = new ZeroShotThemeClassifier(['technology', 'sports']);
   * const result = await classifier.classify('Machine learning and AI');
   * console.log(result.theme); // 'technology'
   * console.log(result.confidence); // 0.92
   * console.log(result.allScores); // { technology: 0.92, sports: 0.08 }
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

    const model = await this.ensureModelLoaded();

    // Run zero-shot classification
    const result = await model(text, this.themes) as {
      labels: string[];
      scores: number[];
    };

    // Build scores map
    const allScores: Record<string, number> = {};
    for (let i = 0; i < result.labels.length; i++) {
      allScores[result.labels[i]] = result.scores[i];
    }

    // Return highest scoring theme (first in result)
    return {
      theme: result.labels[0],
      confidence: result.scores[0],
      allScores,
    };
  }

  /**
   * Classify multiple texts efficiently
   *
   * Processes texts sequentially to avoid memory issues with large batches.
   * The model is loaded once and reused for all texts.
   *
   * @param texts - Array of text contents to classify
   * @returns A promise that resolves to an array of theme classifications
   *
   * @example
   * ```typescript
   * const classifier = new ZeroShotThemeClassifier(['technology', 'sports', 'finance']);
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
    // Ensure model is loaded once
    await this.ensureModelLoaded();

    // Process sequentially to avoid memory issues
    const results: ThemeClassification[] = [];
    for (const text of texts) {
      const result = await this.classify(text);
      results.push(result);
    }

    return results;
  }
}
