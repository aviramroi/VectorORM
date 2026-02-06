// packages/core/src/ingestion/loaders/text-loader.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import type { DocumentLoader } from './document-loader';
import type { Document } from '../types';

/**
 * Loader for plain text files (.txt, .md).
 * No external dependencies, uses Node.js built-in fs.
 */
export class TextLoader implements DocumentLoader {
  canHandle(filePath: string): boolean {
    return /\.(txt|md)$/i.test(filePath);
  }

  async load(filePath: string): Promise<Document> {
    const text = await fs.readFile(filePath, 'utf-8');
    const type = path.extname(filePath).slice(1).toLowerCase();

    return {
      text,
      source: filePath,
      type
    };
  }
}
