/**
 * Abstract base class for text embedding models.
 *
 * This abstraction allows the VectorORM to work with any embedding provider
 * (OpenAI, Cohere, HuggingFace, etc.) by implementing a consistent interface.
 *
 * Implementations must provide:
 * - `embed()`: Convert a single text string into a vector embedding
 * - `embedBatch()`: Convert multiple texts into embeddings efficiently
 * - `dimensions`: The size of the embedding vectors produced
 * - `modelName`: Identifier for the embedding model being used
 *
 * @example
 * ```typescript
 * class OpenAIEmbedder extends Embedder {
 *   get dimensions(): number { return 1536; }
 *   get modelName(): string { return 'text-embedding-ada-002'; }
 *
 *   async embed(text: string): Promise<number[]> {
 *     // Call OpenAI API
 *   }
 *
 *   async embedBatch(texts: string[]): Promise<number[][]> {
 *     // Batch call to OpenAI API
 *   }
 * }
 * ```
 */
export abstract class Embedder {
  /**
   * The dimensionality of embeddings produced by this model.
   * Must be consistent across all embeddings from the same model.
   */
  abstract get dimensions(): number;

  /**
   * Identifier for the embedding model.
   * Used for tracking which model generated embeddings.
   */
  abstract get modelName(): string;

  /**
   * Embed a single text string into a vector.
   *
   * @param text - The text to embed
   * @returns A promise that resolves to a number array representing the embedding
   */
  abstract embed(text: string): Promise<number[]>;

  /**
   * Embed multiple texts into vectors efficiently.
   * Implementations should maintain the order of input texts in the output.
   *
   * @param texts - Array of texts to embed
   * @returns A promise that resolves to an array of embeddings, one per input text
   */
  abstract embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Constructor is protected to prevent direct instantiation of abstract class.
   * Subclasses can call super() in their constructors.
   */
  protected constructor() {
    if (new.target === Embedder) {
      throw new Error('Cannot instantiate abstract class Embedder directly');
    }
  }
}
