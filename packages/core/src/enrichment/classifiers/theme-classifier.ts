/**
 * Theme classification result containing the identified theme and confidence score.
 *
 * @property theme - The identified theme label (e.g., 'technology', 'business', 'science')
 * @property confidence - Confidence score between 0 and 1 indicating classification certainty
 * @property allScores - Optional map of all theme labels to their respective confidence scores
 */
export interface ThemeClassification {
  /**
   * The identified theme label.
   * Examples: 'technology', 'business', 'science', 'healthcare', 'education', etc.
   */
  theme: string;

  /**
   * Confidence score between 0 and 1 indicating classification certainty.
   * Higher values indicate greater confidence in the classification.
   */
  confidence: number;

  /**
   * Optional map of all theme labels to their respective confidence scores.
   * Useful for understanding alternative themes and their relative probabilities.
   *
   * @example
   * ```typescript
   * {
   *   'technology': 0.85,
   *   'business': 0.10,
   *   'science': 0.05
   * }
   * ```
   */
  allScores?: Record<string, number>;
}

/**
 * Interface for theme classification strategies.
 *
 * Theme classifiers identify the primary theme or topic of text content.
 * Different implementations can use various strategies:
 *
 * 1. **Keyword-based Classification**: Uses predefined keyword lists to match themes
 *    - Fast and deterministic
 *    - Good for well-defined domains with clear vocabulary
 *    - Example: Medical texts with specific terminology
 *
 * 2. **Zero-shot Classification**: Uses pre-trained models without fine-tuning
 *    - No training data required
 *    - Good for general-purpose classification
 *    - Example: Hugging Face zero-shot classification models
 *
 * 3. **Embedding-based Classification**: Uses vector similarity between text and theme embeddings
 *    - Semantic understanding of themes
 *    - Can find nuanced thematic relationships
 *    - Example: Comparing document embeddings to theme prototype embeddings
 *
 * 4. **LLM-based Classification**: Uses language models for theme identification
 *    - Most flexible and powerful
 *    - Can understand complex, nuanced themes
 *    - Example: GPT-4, Claude, or other LLMs with structured output
 *
 * Implementations should:
 * - Return confidence scores between 0 and 1
 * - Handle empty or invalid input gracefully
 * - Maintain consistent theme labels across calls
 * - Optionally provide all theme scores for transparency
 *
 * @example
 * ```typescript
 * class KeywordThemeClassifier implements ThemeClassifier {
 *   async classify(text: string): Promise<ThemeClassification> {
 *     // Keyword matching logic
 *     const theme = 'technology';
 *     const confidence = 0.92;
 *     return { theme, confidence };
 *   }
 *
 *   async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
 *     return Promise.all(texts.map(text => this.classify(text)));
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * class LLMThemeClassifier implements ThemeClassifier {
 *   constructor(private llm: LLMClient, private themes: string[]) {}
 *
 *   async classify(text: string): Promise<ThemeClassification> {
 *     const prompt = `Classify the following text into one of these themes: ${this.themes.join(', ')}
 *
 * Text: ${text}
 *
 * Return JSON with: theme (string), confidence (number 0-1), allScores (object)`;
 *
 *     const result = await this.llm.generateJSON<ThemeClassification>(prompt);
 *     return result;
 *   }
 *
 *   async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
 *     // Efficient batch processing
 *     return Promise.all(texts.map(text => this.classify(text)));
 *   }
 * }
 * ```
 */
export interface ThemeClassifier {
  /**
   * Classify a single text and return the identified theme with confidence score.
   *
   * @param text - The text content to classify
   * @returns A promise that resolves to the theme classification result
   *
   * @example
   * ```typescript
   * const classifier = new KeywordThemeClassifier();
   * const result = await classifier.classify('Machine learning is transforming AI');
   * console.log(result.theme); // 'technology'
   * console.log(result.confidence); // 0.92
   * ```
   */
  classify(text: string): Promise<ThemeClassification>;

  /**
   * Classify multiple texts efficiently and return their theme classifications.
   *
   * Implementations should maintain the order of input texts in the output array.
   * May use parallel processing or batching for efficiency.
   *
   * @param texts - Array of text contents to classify
   * @returns A promise that resolves to an array of theme classifications
   *
   * @example
   * ```typescript
   * const classifier = new KeywordThemeClassifier();
   * const texts = [
   *   'Machine learning is transforming AI',
   *   'The stock market reached new highs',
   *   'New cancer treatment shows promise'
   * ];
   * const results = await classifier.classifyBatch(texts);
   * // results[0].theme === 'technology'
   * // results[1].theme === 'business'
   * // results[2].theme === 'healthcare'
   * ```
   */
  classifyBatch(texts: string[]): Promise<ThemeClassification[]>;
}
