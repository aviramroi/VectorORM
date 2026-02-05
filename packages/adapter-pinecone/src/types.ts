/**
 * Configuration for PineconeAdapter.
 *
 * Supports hybrid config: explicit values or environment variables.
 */
export interface PineconeConfig {
  /**
   * Pinecone API key.
   * Falls back to PINECONE_API_KEY environment variable.
   */
  apiKey: string;

  /**
   * Pinecone environment (e.g., 'us-east1-gcp').
   * Falls back to PINECONE_ENVIRONMENT environment variable.
   */
  environment?: string;

  /**
   * Pinecone project ID (optional).
   */
  projectId?: string;
}
