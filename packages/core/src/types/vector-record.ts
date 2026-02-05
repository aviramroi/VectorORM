/**
 * Represents a vector record in the database.
 *
 * This is the fundamental unit of storage in Glyph, containing:
 * - Unique identifier
 * - Embedding vector
 * - Metadata (including V/H/S fields)
 * - Optional text and score
 */
export interface VectorRecord {
  /** Unique identifier for this record */
  id: string;

  /** Embedding vector (dimensionality depends on embedding model) */
  embedding: number[];

  /**
   * Metadata fields including:
   * - Vertical fields (__v_*): Document-level metadata
   * - Horizontal fields (__h_*): Theme/section metadata
   * - Structural fields (__s_*): Position/hierarchy metadata
   * - Custom user fields
   */
  metadata: Record<string, any>;

  /** Optional text content of this chunk */
  text?: string;

  /** Optional similarity score (populated during search) */
  score?: number;
}
