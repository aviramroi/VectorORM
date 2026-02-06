// packages/core/src/ingestion/loaders/html-loader.ts
import * as fs from 'fs/promises';
import * as cheerio from 'cheerio';
import type { DocumentLoader } from './document-loader';
import type { Document } from '../types';

/**
 * Loader for HTML files using cheerio library.
 * Strips tags, extracts visible text, removes scripts/styles.
 */
export class HTMLLoader implements DocumentLoader {
  canHandle(filePath: string): boolean {
    return /\.html?$/i.test(filePath);
  }

  async load(filePath: string): Promise<Document> {
    const html = await fs.readFile(filePath, 'utf-8');
    const $ = cheerio.load(html);

    // Remove script, style, nav, footer
    $('script, style, nav, footer').remove();

    // Extract text from body
    const text = $('body').text()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    return {
      text,
      source: filePath,
      type: 'html',
      metadata: {
        title: $('title').text() || undefined,
        description: $('meta[name="description"]').attr('content') || undefined
      }
    };
  }
}
