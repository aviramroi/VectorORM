// packages/core/tests/ingestion/loaders/document-loader.test.ts
import { describe, it, expect } from 'vitest';
import type { Document } from '../../../src/ingestion/loaders/document-loader';

describe('DocumentLoader Interface', () => {
  it('should define the correct interface shape', () => {
    const doc: Document = {
      text: 'sample text',
      source: '/path/to/file.txt',
      type: 'txt',
      metadata: { key: 'value' }
    };

    expect(doc.text).toBe('sample text');
    expect(doc.source).toBe('/path/to/file.txt');
    expect(doc.type).toBe('txt');
  });
});
