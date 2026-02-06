// packages/core/tests/ingestion/loaders/docx-loader.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DOCXLoader } from '../../../src/ingestion/loaders/docx-loader';

describe('DOCXLoader', () => {
  let loader: DOCXLoader;

  beforeEach(() => {
    loader = new DOCXLoader();
  });

  describe('canHandle', () => {
    it('should handle .docx files', () => {
      expect(loader.canHandle('test.docx')).toBe(true);
      expect(loader.canHandle('document.docx')).toBe(true);
    });

    it('should handle .docx files case-insensitively', () => {
      expect(loader.canHandle('test.DOCX')).toBe(true);
      expect(loader.canHandle('test.Docx')).toBe(true);
      expect(loader.canHandle('test.dOcX')).toBe(true);
    });

    it('should handle .docx files with complex paths', () => {
      expect(loader.canHandle('/path/to/document.docx')).toBe(true);
      expect(loader.canHandle('./relative/path/file.docx')).toBe(true);
      expect(loader.canHandle('C:\\Windows\\Path\\file.docx')).toBe(true);
    });

    it('should not handle files without .docx extension', () => {
      expect(loader.canHandle('test.txt')).toBe(false);
      expect(loader.canHandle('test.pdf')).toBe(false);
      expect(loader.canHandle('test.html')).toBe(false);
      expect(loader.canHandle('test.md')).toBe(false);
    });

    it('should not handle old .doc files', () => {
      expect(loader.canHandle('test.doc')).toBe(false);
      expect(loader.canHandle('legacy.DOC')).toBe(false);
    });

    it('should not handle files with docx in name but different extension', () => {
      expect(loader.canHandle('docx-file.txt')).toBe(false);
      expect(loader.canHandle('mydocx.pdf')).toBe(false);
    });

    it('should not handle files without extension', () => {
      expect(loader.canHandle('document')).toBe(false);
      expect(loader.canHandle('/path/to/file')).toBe(false);
    });
  });

  describe('interface', () => {
    it('should have canHandle method', () => {
      expect(typeof loader.canHandle).toBe('function');
    });

    it('should have load method', () => {
      expect(typeof loader.load).toBe('function');
    });

    it('should have load method that returns Promise', () => {
      const result = loader.load('test.docx');
      expect(result).toBeInstanceOf(Promise);
      // Catch the promise rejection since file doesn't exist
      result.catch(() => {});
    });
  });

  // Note: Full integration tests with actual DOCX files would require
  // test fixtures. Those tests would verify:
  // - DOCX text extraction works correctly
  // - Multi-paragraph documents preserve structure
  // - Document metadata includes conversion warnings from mammoth
  // - Document type is set to 'docx'
  // - Proper error handling for corrupt DOCX files
  // - Empty DOCX files are handled correctly
  // - Tables and formatted text are converted to plain text
});
