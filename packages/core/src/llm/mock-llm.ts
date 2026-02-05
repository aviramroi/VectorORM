import { LLMClient } from './llm-client';
import type { GenerateOptions } from './types';

/**
 * MockLLM for testing purposes only.
 * Returns canned responses that can be set programmatically.
 *
 * @example
 * ```typescript
 * const llm = new MockLLM();
 * llm.setResponse('Hello, world!');
 * const result = await llm.generate('Say hello'); // Returns 'Hello, world!'
 * ```
 */
export class MockLLM extends LLMClient {
  private _response: string = '';

  constructor() {
    super();
  }

  get modelName(): string {
    return 'mock-llm-v1';
  }

  get provider(): string {
    return 'mock';
  }

  /**
   * Set the canned response that will be returned by generate methods.
   *
   * @param response - The response text to return
   */
  setResponse(response: string): void {
    this._response = response;
  }

  async generate(
    prompt: string,
    options?: GenerateOptions
  ): Promise<string> {
    // Ignore prompt and options, return canned response
    return this._response;
  }

  async generateJSON<T>(
    prompt: string,
    options?: GenerateOptions
  ): Promise<T> {
    // Parse the canned response as JSON
    try {
      return JSON.parse(this._response) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse mock response as JSON: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  async generateBatch(
    prompts: string[],
    options?: GenerateOptions
  ): Promise<string[]> {
    // Return the same canned response for all prompts
    return prompts.map(() => this._response);
  }
}
