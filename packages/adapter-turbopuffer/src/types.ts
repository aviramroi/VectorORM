/**
 * Configuration for TurbopufferAdapter.
 *
 * Supports hybrid config: explicit values or environment variables.
 */
export interface TurbopufferConfig {
  /**
   * Turbopuffer API key.
   * Falls back to TURBOPUFFER_API_KEY environment variable.
   */
  apiKey: string;

  /**
   * Base URL for Turbopuffer API (optional).
   * Defaults to https://api.turbopuffer.com
   * Falls back to TURBOPUFFER_BASE_URL environment variable.
   */
  baseUrl?: string;
}
