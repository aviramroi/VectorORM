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
   * Turbopuffer region (e.g. 'aws-us-east-1', 'gcp-us-central1').
   * Sets the base URL to https://{region}.turbopuffer.com
   * Falls back to TURBOPUFFER_REGION environment variable.
   * Ignored if baseUrl is provided.
   */
  region?: string;

  /**
   * Base URL for Turbopuffer API (optional).
   * Overrides region if both are provided.
   * Defaults to https://api.turbopuffer.com (or region-based URL if region is set).
   * Falls back to TURBOPUFFER_BASE_URL environment variable.
   */
  baseUrl?: string;
}
