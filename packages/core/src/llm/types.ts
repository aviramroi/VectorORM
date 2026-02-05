/**
 * Options for LLM text generation.
 *
 * These options control how the LLM generates text,
 * allowing fine-grained control over the output behavior.
 */
export interface GenerateOptions {
  /**
   * Controls randomness in generation.
   * Higher values (e.g., 1.0) make output more random.
   * Lower values (e.g., 0.1) make output more deterministic.
   * Range: 0.0 to 2.0
   */
  temperature?: number;

  /**
   * Maximum number of tokens to generate.
   * Limits the length of the generated output.
   */
  maxTokens?: number;

  /**
   * System prompt to set context for the LLM.
   * Used to guide the model's behavior and personality.
   */
  systemPrompt?: string;

  /**
   * Sequences where the LLM should stop generating.
   * When encountered, generation stops immediately.
   */
  stopSequences?: string[];
}
