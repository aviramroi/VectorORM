import type { GenerateOptions } from './types';

/**
 * Abstract base class for LLM (Large Language Model) clients.
 *
 * This abstraction allows the VectorORM to work with any LLM provider
 * (OpenAI, Anthropic, Google, etc.) by implementing a consistent interface.
 *
 * Implementations must provide:
 * - `generate()`: Generate text from a prompt
 * - `generateJSON<T>()`: Generate structured JSON output
 * - `generateBatch()`: Generate multiple responses efficiently
 * - `modelName`: Identifier for the LLM model being used
 * - `provider`: Name of the LLM provider
 *
 * @example
 * ```typescript
 * class OpenAIClient extends LLMClient {
 *   get modelName(): string { return 'gpt-4'; }
 *   get provider(): string { return 'openai'; }
 *
 *   async generate(prompt: string, options?: GenerateOptions): Promise<string> {
 *     // Call OpenAI API
 *   }
 *
 *   async generateJSON<T>(prompt: string, options?: GenerateOptions): Promise<T> {
 *     // Call OpenAI API with JSON mode
 *   }
 *
 *   async generateBatch(prompts: string[], options?: GenerateOptions): Promise<string[]> {
 *     // Batch call to OpenAI API
 *   }
 * }
 * ```
 */
export abstract class LLMClient {
  /**
   * Identifier for the LLM model.
   * Used for tracking which model generated responses.
   */
  abstract get modelName(): string;

  /**
   * Name of the LLM provider.
   * Examples: 'openai', 'anthropic', 'google', 'mock'
   */
  abstract get provider(): string;

  /**
   * Generate text from a prompt.
   *
   * @param prompt - The text prompt to send to the LLM
   * @param options - Optional generation parameters
   * @returns A promise that resolves to the generated text
   */
  abstract generate(prompt: string, options?: GenerateOptions): Promise<string>;

  /**
   * Generate structured JSON output from a prompt.
   * The LLM will be instructed to return valid JSON that matches type T.
   *
   * @param prompt - The text prompt to send to the LLM
   * @param options - Optional generation parameters
   * @returns A promise that resolves to the parsed JSON object
   */
  abstract generateJSON<T>(
    prompt: string,
    options?: GenerateOptions
  ): Promise<T>;

  /**
   * Generate multiple responses efficiently.
   * Implementations should maintain the order of input prompts in the output.
   *
   * @param prompts - Array of prompts to process
   * @param options - Optional generation parameters
   * @returns A promise that resolves to an array of responses, one per input prompt
   */
  abstract generateBatch(
    prompts: string[],
    options?: GenerateOptions
  ): Promise<string[]>;

  /**
   * Constructor is protected to prevent direct instantiation of abstract class.
   * Subclasses can call super() in their constructors.
   */
  protected constructor() {
    if (new.target === LLMClient) {
      throw new Error('Cannot instantiate abstract class LLMClient directly');
    }
  }
}
