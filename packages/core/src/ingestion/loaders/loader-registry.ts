// packages/core/src/ingestion/loaders/loader-registry.ts
import type { DocumentLoader } from './document-loader';
import type { Document } from '../types';
import { TextLoader } from './text-loader';
import { PDFLoader } from './pdf-loader';
import { DOCXLoader } from './docx-loader';
import { HTMLLoader } from './html-loader';

/**
 * Registry for document loaders.
 * Manages loaders and routes files to correct loader based on extension.
 */
export class LoaderRegistry {
  private loaders: DocumentLoader[] = [];

  constructor() {
    // Register built-in loaders
    this.register(new TextLoader());
    this.register(new PDFLoader());
    this.register(new DOCXLoader());
    this.register(new HTMLLoader());
  }

  /**
   * Register a custom document loader.
   * @param loader - Loader to register
   */
  register(loader: DocumentLoader): void {
    this.loaders.push(loader);
  }

  /**
   * Check if any loader can handle this file.
   * @param filePath - Path to check
   * @returns true if a loader exists for this file type
   */
  canLoad(filePath: string): boolean {
    return this.loaders.some(l => l.canHandle(filePath));
  }

  /**
   * Load a document using the appropriate loader.
   * @param filePath - Path to the file to load
   * @returns Promise resolving to Document
   * @throws Error if no loader found for file type
   */
  async load(filePath: string): Promise<Document> {
    const loader = this.loaders.find(l => l.canHandle(filePath));
    if (!loader) {
      throw new Error(`No loader found for file: ${filePath}`);
    }
    return loader.load(filePath);
  }
}
