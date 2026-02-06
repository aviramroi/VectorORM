// packages/core/tests/ingestion/loaders/loader-registry.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoaderRegistry } from '../../../src/ingestion/loaders/loader-registry';
import type { DocumentLoader } from '../../../src/ingestion/loaders/document-loader';
import type { Document } from '../../../src/ingestion/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('LoaderRegistry', () => {
  let registry: LoaderRegistry;
  let tempDir: string;

  beforeEach(async () => {
    registry = new LoaderRegistry();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'registry-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should register built-in loaders by default', () => {
    expect(registry.canLoad('test.txt')).toBe(true);
    expect(registry.canLoad('test.pdf')).toBe(true);
    expect(registry.canLoad('test.docx')).toBe(true);
    expect(registry.canLoad('test.html')).toBe(true);
    expect(registry.canLoad('test.md')).toBe(true);
    expect(registry.canLoad('test.htm')).toBe(true);
  });

  it('should not handle unknown file types', () => {
    expect(registry.canLoad('test.unknown')).toBe(false);
    expect(registry.canLoad('test.exe')).toBe(false);
  });

  it('should allow registering custom loaders', () => {
    class CustomLoader implements DocumentLoader {
      canHandle(path: string) { return path.endsWith('.custom'); }
      async load(path: string): Promise<Document> {
        return { text: 'custom', source: path, type: 'custom' };
      }
    }

    registry.register(new CustomLoader());

    expect(registry.canLoad('test.custom')).toBe(true);
  });

  it('should throw error when no loader found', async () => {
    await expect(registry.load('test.unknown')).rejects.toThrow('No loader found');
  });

  it('should use correct loader based on extension', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    await fs.writeFile(filePath, 'test content', 'utf-8');

    const doc = await registry.load(filePath);

    expect(doc.type).toBe('txt');
    expect(doc.text).toBe('test content');
  });

  it('should load HTML files through registry', async () => {
    const filePath = path.join(tempDir, 'test.html');
    await fs.writeFile(filePath, '<html><body><p>Hello</p></body></html>', 'utf-8');

    const doc = await registry.load(filePath);

    expect(doc.type).toBe('html');
    expect(doc.text).toContain('Hello');
  });

  it('should use first matching loader when multiple match', async () => {
    class FirstLoader implements DocumentLoader {
      canHandle(p: string) { return p.endsWith('.test'); }
      async load(p: string): Promise<Document> {
        return { text: 'first', source: p, type: 'first' };
      }
    }

    class SecondLoader implements DocumentLoader {
      canHandle(p: string) { return p.endsWith('.test'); }
      async load(p: string): Promise<Document> {
        return { text: 'second', source: p, type: 'second' };
      }
    }

    registry.register(new FirstLoader());
    registry.register(new SecondLoader());

    // First registered custom loader should win
    const doc = await registry.load('file.test');
    expect(doc.type).toBe('first');
  });
});
