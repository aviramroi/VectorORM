// packages/core/src/ingestion/loaders/docx-loader.ts
import mammoth from 'mammoth';
import type { DocumentLoader } from './document-loader';
import type { Document } from '../types';

/**
 * Loader for DOCX files using mammoth library.
 * Converts DOCX to plain text, preserves paragraph structure.
 */
export class DOCXLoader implements DocumentLoader {
  canHandle(filePath: string): boolean {
    return /\.docx$/i.test(filePath);
  }

  async load(filePath: string): Promise<Document> {
    const result = await mammoth.extractRawText({ path: filePath });

    return {
      text: result.value,
      source: filePath,
      type: 'docx',
      metadata: {
        warnings: result.messages  // Conversion warnings from mammoth
      }
    };
  }
}
