/**
 * Configuration for ChromaAdapter.
 *
 * Supports hybrid config: explicit values or environment variables.
 * Chroma can be self-hosted or used via cloud service.
 */
export interface ChromaConfig {
  /**
   * Chroma API key (optional for self-hosted).
   * Falls back to CHROMA_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Chroma server host.
   * Falls back to CHROMA_HOST environment variable.
   * Defaults to 'localhost'.
   */
  host?: string;

  /**
   * Chroma server port.
   * Falls back to CHROMA_PORT environment variable.
   * Defaults to 8000.
   */
  port?: number;

  /**
   * Use SSL/TLS for connection.
   * Falls back to CHROMA_SSL environment variable.
   * Defaults to false for localhost, true for remote hosts.
   */
  ssl?: boolean;

  /**
   * Optional tenant ID for multi-tenancy support.
   */
  tenant?: string;

  /**
   * Optional database name.
   */
  database?: string;
}
