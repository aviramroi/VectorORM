// packages/core/tests/ingestion/loaders/pdf-loader.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PDFLoader } from '../../../src/ingestion/loaders/pdf-loader';

describe('PDFLoader', () => {
  let loader: PDFLoader;

  beforeEach(() => {
    loader = new PDFLoader();
  });

  describe('canHandle', () => {
    it('should handle .pdf files', () => {
      expect(loader.canHandle('test.pdf')).toBe(true);
      expect(loader.canHandle('document.pdf')).toBe(true);
    });

    it('should handle .pdf files case-insensitively', () => {
      expect(loader.canHandle('test.PDF')).toBe(true);
      expect(loader.canHandle('test.Pdf')).toBe(true);
      expect(loader.canHandle('test.pDf')).toBe(true);
    });

    it('should handle .pdf files with complex paths', () => {
      expect(loader.canHandle('/path/to/document.pdf')).toBe(true);
      expect(loader.canHandle('./relative/path/file.pdf')).toBe(true);
      expect(loader.canHandle('C:\\Windows\\Path\\file.pdf')).toBe(true);
    });

    it('should not handle files without .pdf extension', () => {
      expect(loader.canHandle('test.txt')).toBe(false);
      expect(loader.canHandle('test.docx')).toBe(false);
      expect(loader.canHandle('test.doc')).toBe(false);
      expect(loader.canHandle('test.md')).toBe(false);
    });

    it('should not handle files with pdf in name but different extension', () => {
      expect(loader.canHandle('pdf-file.txt')).toBe(false);
      expect(loader.canHandle('mypdf.docx')).toBe(false);
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
      const result = loader.load('test.pdf');
      expect(result).toBeInstanceOf(Promise);
      // Catch the promise rejection since file doesn't exist
      result.catch(() => {});
    });
  });

  // Note: Full integration tests with actual PDF files would require
  // test fixtures. Those tests would verify:
  // - PDF text extraction works correctly
  // - Multi-page PDFs are handled with all pages combined
  // - PDF metadata is extracted (pages, author, title, etc.)
  // - Document type is set to 'pdf'
  // - Proper error handling for corrupt PDFs
  // - Empty PDFs are handled correctly
});
