// packages/core/tests/ingestion/loaders/html-loader.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HTMLLoader } from '../../../src/ingestion/loaders/html-loader';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('HTMLLoader', () => {
  let loader: HTMLLoader;
  let tempDir: string;

  beforeEach(async () => {
    loader = new HTMLLoader();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'html-loader-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should handle .html and .htm files', () => {
    expect(loader.canHandle('test.html')).toBe(true);
    expect(loader.canHandle('test.htm')).toBe(true);
    expect(loader.canHandle('test.HTML')).toBe(true);
  });

  it('should not handle other files', () => {
    expect(loader.canHandle('test.txt')).toBe(false);
    expect(loader.canHandle('test.pdf')).toBe(false);
  });

  it('should extract text from HTML', async () => {
    const filePath = path.join(tempDir, 'sample.html');
    const html = '<html><body><h1>Title</h1><p>Paragraph text</p></body></html>';
    await fs.writeFile(filePath, html, 'utf-8');

    const doc = await loader.load(filePath);

    expect(doc.text).toContain('Title');
    expect(doc.text).toContain('Paragraph text');
    expect(doc.source).toBe(filePath);
    expect(doc.type).toBe('html');
  });

  it('should remove scripts and styles', async () => {
    const filePath = path.join(tempDir, 'with-script.html');
    const html = `
      <html>
        <head><style>.test { color: red; }</style></head>
        <body>
          <script>alert('test');</script>
          <p>Visible text</p>
        </body>
      </html>
    `;
    await fs.writeFile(filePath, html, 'utf-8');

    const doc = await loader.load(filePath);

    expect(doc.text).toContain('Visible text');
    expect(doc.text).not.toContain('alert');
    expect(doc.text).not.toContain('.test');
  });

  it('should normalize whitespace', async () => {
    const filePath = path.join(tempDir, 'whitespace.html');
    const html = '<html><body><p>Text   with\n\nmultiple    spaces</p></body></html>';
    await fs.writeFile(filePath, html, 'utf-8');

    const doc = await loader.load(filePath);

    expect(doc.text).not.toContain('  ');  // No double spaces
    expect(doc.text).toBe('Text with multiple spaces');
  });

  it('should extract title metadata', async () => {
    const filePath = path.join(tempDir, 'with-title.html');
    const html = '<html><head><title>Page Title</title></head><body>Content</body></html>';
    await fs.writeFile(filePath, html, 'utf-8');

    const doc = await loader.load(filePath);

    expect(doc.metadata?.title).toBe('Page Title');
  });

  it('should extract description metadata', async () => {
    const filePath = path.join(tempDir, 'with-meta.html');
    const html = '<html><head><meta name="description" content="A page description"></head><body>Content</body></html>';
    await fs.writeFile(filePath, html, 'utf-8');

    const doc = await loader.load(filePath);

    expect(doc.metadata?.description).toBe('A page description');
  });

  it('should remove nav and footer elements', async () => {
    const filePath = path.join(tempDir, 'with-nav.html');
    const html = `
      <html><body>
        <nav>Navigation menu</nav>
        <p>Main content</p>
        <footer>Footer text</footer>
      </body></html>
    `;
    await fs.writeFile(filePath, html, 'utf-8');

    const doc = await loader.load(filePath);

    expect(doc.text).toContain('Main content');
    expect(doc.text).not.toContain('Navigation menu');
    expect(doc.text).not.toContain('Footer text');
  });
});
