// packages/core/src/ingestion/loaders/document-loader.ts
import type { Document } from '../types';

// Re-export Document type for convenience
export type { Document };

/**
 * Abstract interface for document loaders.
 * Implementations load specific file formats and return standardized Document objects.
 */
export interface DocumentLoader {
  /**
   * Check if this loader can handle the given file.
   * @param filePath - Path to the file
   * @returns true if loader can handle this file type
   */
  canHandle(filePath: string): boolean;

  /**
   * Load a document from the given file path.
   * @param filePath - Path to the file to load
   * @returns Promise resolving to Document
   */
  load(filePath: string): Promise<Document>;
}
