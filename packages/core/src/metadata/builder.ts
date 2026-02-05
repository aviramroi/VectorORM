import { METADATA_PREFIXES } from './constants';

/**
 * MetadataBuilder provides a fluent API for constructing metadata objects
 * with proper V/H/S prefixes and type safety.
 *
 * Example:
 * ```typescript
 * const metadata = new MetadataBuilder()
 *   .vertical({ doc_id: 'doc123', source: 'file.pdf' })
 *   .horizontal({ theme: 'pricing' })
 *   .structural({ chunk_index: 0, total_chunks: 10 })
 *   .custom({ author: 'John Doe' })
 *   .build();
 * ```
 *
 * Features:
 * - Fluent chaining API
 * - Automatic prefix application
 * - Skips undefined values
 * - Returns immutable copy on build()
 */
export class MetadataBuilder {
  private metadata: Record<string, any> = {};

  /**
   * Add vertical axis metadata (document identity).
   * Automatically prefixes fields with '__v_'.
   *
   * @param fields - Vertical metadata fields (doc_id, source, partition, etc.)
   * @returns This builder for chaining
   */
  vertical(fields: Record<string, any>): this {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        this.metadata[`${METADATA_PREFIXES.VERTICAL}${key}`] = value;
      }
    }
    return this;
  }

  /**
   * Add horizontal axis metadata (theme/section identity).
   * Automatically prefixes fields with '__h_'.
   *
   * @param fields - Horizontal metadata fields (theme, section_path, etc.)
   * @returns This builder for chaining
   */
  horizontal(fields: Record<string, any>): this {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        this.metadata[`${METADATA_PREFIXES.HORIZONTAL}${key}`] = value;
      }
    }
    return this;
  }

  /**
   * Add structural axis metadata (position/hierarchy).
   * Automatically prefixes fields with '__s_'.
   *
   * @param fields - Structural metadata fields (chunk_index, parent_id, etc.)
   * @returns This builder for chaining
   */
  structural(fields: Record<string, any>): this {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        this.metadata[`${METADATA_PREFIXES.STRUCTURAL}${key}`] = value;
      }
    }
    return this;
  }

  /**
   * Add custom user-defined metadata.
   * Fields are added as-is without any prefix.
   *
   * @param fields - Custom metadata fields
   * @returns This builder for chaining
   */
  custom(fields: Record<string, any>): this {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        this.metadata[key] = value;
      }
    }
    return this;
  }

  /**
   * Build and return the complete metadata object.
   * Returns a copy to prevent external modification.
   *
   * @returns Immutable copy of the metadata object
   */
  build(): Record<string, any> {
    return { ...this.metadata };
  }
}
