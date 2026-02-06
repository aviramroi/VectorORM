// packages/core/src/ingestion/loaders/pdf-loader.ts
import * as fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import type { DocumentLoader } from './document-loader';
import type { Document } from '../types';

/**
 * Loader for PDF files using pdf-parse library.
 * Extracts text from all pages and includes PDF metadata.
 */
export class PDFLoader implements DocumentLoader {
  canHandle(filePath: string): boolean {
    return /\.pdf$/i.test(filePath);
  }

  async load(filePath: string): Promise<Document> {
    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(dataBuffer);

    return {
      text: pdfData.text,
      source: filePath,
      type: 'pdf',
      metadata: {
        pages: pdfData.numpages,
        info: pdfData.info
      }
    };
  }
}
