// packages/core/tests/ingestion/loaders/text-loader.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TextLoader } from '../../../src/ingestion/loaders/text-loader';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('TextLoader', () => {
  let loader: TextLoader;
  let tempDir: string;

  beforeEach(async () => {
    loader = new TextLoader();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'text-loader-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle .txt files', () => {
    expect(loader.canHandle('test.txt')).toBe(true);
    expect(loader.canHandle('test.TXT')).toBe(true);
  });

  it('should handle .md files', () => {
    expect(loader.canHandle('test.md')).toBe(true);
    expect(loader.canHandle('test.MD')).toBe(true);
  });

  it('should not handle other files', () => {
    expect(loader.canHandle('test.pdf')).toBe(false);
    expect(loader.canHandle('test.docx')).toBe(false);
  });

  it('should load text file with UTF-8 encoding', async () => {
    const filePath = path.join(tempDir, 'sample.txt');
    const content = 'Hello, World!\nLine 2';
    await fs.writeFile(filePath, content, 'utf-8');

    const doc = await loader.load(filePath);

    expect(doc.text).toBe(content);
    expect(doc.source).toBe(filePath);
    expect(doc.type).toBe('txt');
  });

  it('should preserve line breaks', async () => {
    const filePath = path.join(tempDir, 'multiline.txt');
    const content = 'Line 1\n\nLine 3\nLine 4';
    await fs.writeFile(filePath, content, 'utf-8');

    const doc = await loader.load(filePath);

    expect(doc.text).toBe(content);
    expect(doc.text).toContain('\n\n');
  });

  it('should throw error for missing file', async () => {
    const filePath = path.join(tempDir, 'missing.txt');

    await expect(loader.load(filePath)).rejects.toThrow();
  });
});
