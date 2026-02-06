/**
 * LLM-based theme classifier using language models for high-quality classification
 * Provides the most flexible and accurate theme classification using LLMs
 */

import type { ThemeClassifier, ThemeClassification } from './theme-classifier';
import type { LLMClient } from '../../llm/llm-client';

/**
 * Default prompt template for theme classification.
 * Uses {themes} and {text} placeholders that are replaced at runtime.
 */
const DEFAULT_PROMPT_TEMPLATE = `You are a theme classification system. Classify the following text into one of the provided themes.

Available themes: {themes}

Text to classify:
{text}

Return a JSON object with the following structure:
- theme: the most appropriate theme from the list (string)
- confidence: confidence score between 0 and 1 (number)
- allScores: an object mapping each theme to its confidence score (object)

Return only valid JSON, no additional text.`;

/**
 * LLM-based theme classification using language models.
 *
 * This classifier uses LLMs to provide the highest quality theme classification
 * with semantic understanding and nuanced reasoning. It supports custom prompt
 * templates for domain-specific classification needs.
 *
 * Features:
 * - Default prompt template with {themes} and {text} placeholders
 * - Custom prompt template support for specialized domains
 * - Structured JSON output using LLM.generateJSON<>
 * - Sequential batch processing to avoid rate limits
 * - Comprehensive error handling with cause chain
 * - Empty text handling with uniform scores
 *
 * @example
 * ```typescript
 * const llm = new OpenAIClient('gpt-4');
 * const classifier = new LLMThemeClassifier(
 *   ['technology', 'sports', 'finance'],
 *   llm
 * );
 * const result = await classifier.classify('Machine learning is transforming AI');
 * console.log(result.theme); // 'technology'
 * console.log(result.confidence); // 0.95
 * ```
 *
 * @example Custom prompt template
 * ```typescript
 * const customTemplate = `Classify this medical text: {text}
 * Themes: {themes}
 * Return JSON with theme, confidence, allScores.`;
 *
 * const classifier = new LLMThemeClassifier(
 *   ['cardiology', 'neurology', 'oncology'],
 *   llm,
 *   customTemplate
 * );
 * ```
 */
export class LLMThemeClassifier implements ThemeClassifier {
  private themes: string[];
  private llm: LLMClient;
  private promptTemplate: string;

  /**
   * Creates a new LLMThemeClassifier
   *
   * @param themes - Array of theme labels to classify into
   * @param llm - LLM client instance to use for classification
   * @param promptTemplate - Optional custom prompt template with {themes} and {text} placeholders
   *
   * @example
   * ```typescript
   * const classifier = new LLMThemeClassifier(
   *   ['technology', 'sports', 'finance'],
   *   llm
   * );
   * ```
   *
   * @example With custom prompt
   * ```typescript
   * const customTemplate = `Classify: {text}\nThemes: {themes}\nReturn JSON.`;
   * const classifier = new LLMThemeClassifier(
   *   ['technology', 'sports'],
   *   llm,
   *   customTemplate
   * );
   * ```
   */
  constructor(
    themes: string[],
    llm: LLMClient,
    promptTemplate: string = DEFAULT_PROMPT_TEMPLATE
  ) {
    this.themes = themes;
    this.llm = llm;
    this.promptTemplate = promptTemplate;
  }

  /**
   * Build the classification prompt by replacing placeholders
   *
   * @param text - The text to classify
   * @returns The complete prompt with placeholders replaced
   */
  private buildPrompt(text: string): string {
    const themesStr = this.themes.join(', ');
    return this.promptTemplate
      .replace('{themes}', themesStr)
      .replace('{text}', text);
  }

  /**
   * Classify a single text into one of the provided themes
   *
   * @param text - The text content to classify
   * @returns A promise that resolves to the theme classification result
   *
   * @example
   * ```typescript
   * const classifier = new LLMThemeClassifier(['technology', 'sports'], llm);
   * const result = await classifier.classify('Machine learning and AI');
   * console.log(result.theme); // 'technology'
   * console.log(result.confidence); // 0.95
   * console.log(result.allScores); // { technology: 0.95, sports: 0.05 }
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

    // Build prompt and call LLM
    const prompt = this.buildPrompt(text);

    try {
      const result = await this.llm.generateJSON<ThemeClassification>(prompt);
      return result;
    } catch (error) {
      // Chain the error with context
      const message = `Failed to classify text with LLM: ${error instanceof Error ? error.message : 'unknown error'}`;
      const classificationError = new Error(message);

      // Preserve the original error as the cause
      if (error instanceof Error) {
        (classificationError as any).cause = error;
      }

      throw classificationError;
    }
  }

  /**
   * Classify multiple texts sequentially
   *
   * Processes texts one at a time to avoid rate limits and ensure predictable behavior.
   * Sequential processing provides better error handling and rate limit compliance.
   *
   * @param texts - Array of text contents to classify
   * @returns A promise that resolves to an array of theme classifications
   *
   * @example
   * ```typescript
   * const classifier = new LLMThemeClassifier(['technology', 'sports', 'finance'], llm);
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
    // Sequential processing to avoid rate limits
    const results: ThemeClassification[] = [];

    for (const text of texts) {
      const result = await this.classify(text);
      results.push(result);
    }

    return results;
  }
}
