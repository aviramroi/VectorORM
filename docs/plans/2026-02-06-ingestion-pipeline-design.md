# Phase 5: Document Ingestion Pipeline - Design Document

**Date:** 2026-02-06
**Status:** Approved for Implementation
**Phase:** 5 of 7

## Executive Summary

Phase 5 adds document ingestion capabilities to Glyph, enabling users to load documents from various formats (text, PDF, DOCX, HTML), chunk them intelligently, and upsert them to vector databases with automatic vertical metadata extraction. The pipeline is designed for production use with progress reporting, error handling, and smart defaults.

## Architecture Overview

**Core Components:**

1. **DocumentLoader** - Abstract interface for loading different file formats
   - `TextLoader` - .txt, .md files (built-in, no deps)
   - `PDFLoader` - .pdf files (using pdf-parse)
   - `DOCXLoader` - .docx files (using mammoth)
   - `HTMLLoader` - .html files (using cheerio)

2. **LoaderRegistry** - Manages loaders and routes files to correct loader
   - Auto-detects format from file extension
   - Users can register custom loaders for proprietary formats

3. **TextChunker** - Abstract interface for chunking strategies
   - `RecursiveChunker` - Default, tries separators hierarchically (paragraphs → sentences → words)
   - `FixedChunker` - Simple fixed-size with overlap
   - `SentenceChunker` - Respects sentence boundaries using NLP
   - `SemanticChunker` - Uses embeddings for semantic breaks (optional, advanced)

4. **IngestionPipeline** - Main orchestrator
   - Loads documents → Chunks text → Embeds chunks → Upserts to vector DB
   - Auto-extracts vertical metadata (source, docType, docId)
   - Batch processing with progress callbacks
   - Best-effort error handling with detailed stats

**Dependencies to add:**
- `pdf-parse` - PDF text extraction
- `mammoth` - DOCX to plain text conversion
- `cheerio` - HTML parsing and text extraction
- `compromise` - Sentence detection (for SentenceChunker)

## Data Flow

```
Files → LoaderRegistry.load() → Document[]
      → TextChunker.chunk() → TextChunk[]
      → Auto-extract vertical metadata
      → Embedder.embedBatch() → Add embeddings
      → Adapter.upsert() → Vector DB
```

**Separation of Concerns:**
- Ingestion focuses on: load → chunk → embed → upsert
- Theme classification happens separately via EnrichmentPipeline
- Clean separation allows fast ingestion, delayed enrichment

## Core Interfaces

### Document

```typescript
interface Document {
  text: string;              // Full document text
  source: string;            // File path
  type: string;              // File extension (pdf, txt, docx, html)
  metadata?: Record<string, any>;  // User-provided metadata
}
```

### TextChunk

```typescript
interface TextChunk {
  text: string;              // Chunk text
  index: number;             // Position in document (0-indexed)
  metadata: {
    source: string;          // Document source path
    chunkIndex: number;      // Same as index
    totalChunks: number;     // Total chunks in this document
    startChar: number;       // Start position in original text
    endChar: number;         // End position in original text
  };
}
```

### DocumentLoader

```typescript
interface DocumentLoader {
  canHandle(filePath: string): boolean;
  load(filePath: string): Promise<Document>;
}
```

**Key decisions:**
- `canHandle()` enables automatic routing by extension
- `load()` is async to support file I/O and external libraries
- Returns standardized `Document` structure

### TextChunker

```typescript
interface TextChunker {
  chunk(text: string, config?: ChunkConfig): TextChunk[];
}

interface ChunkConfig {
  chunkSize?: number;        // Target size in tokens
  chunkOverlap?: number;     // Overlap in tokens
}
```

**Key decisions:**
- Chunking is synchronous (fast, in-memory operation)
- Returns array with positional metadata for each chunk
- Config optional - smart defaults provided

## IngestionPipeline API

### Constructor

```typescript
class IngestionPipeline {
  constructor(
    private adapter: VectorDBAdapter,
    private embedder: Embedder,
    private loaderRegistry: LoaderRegistry,
    private chunker?: TextChunker  // Defaults to RecursiveChunker
  ) {}
}
```

### Main Method

```typescript
async ingest(
  sources: string | string[],  // File paths or glob patterns
  collection: string,
  config?: IngestionConfig
): Promise<IngestionStats>
```

### Configuration

```typescript
interface IngestionConfig {
  // Chunking
  chunkSize?: number;           // Default: 500 tokens
  chunkOverlap?: number;        // Default: 50 tokens
  chunker?: TextChunker;        // Override default chunker

  // Metadata
  metadata?: Record<string, any>;  // Applied to all chunks
  metadataExtractor?: (doc: Document) => Record<string, any>;  // Per-document custom extraction

  // Processing
  batchSize?: number;           // Upsert batch size, default: 100 chunks
  concurrency?: number;         // Parallel file loading, default: 5

  // Callbacks
  onProgress?: ProgressCallback;
  onDocumentLoaded?: (doc: Document) => void;
  onChunksCreated?: (chunks: TextChunk[]) => void;
}
```

### Return Stats

```typescript
interface IngestionStats {
  documentsProcessed: number;
  documentsSucceeded: number;
  documentsFailed: number;
  chunksCreated: number;
  chunksUpserted: number;
  timeMs: number;
  errors?: Array<{
    source: string;
    stage: 'load' | 'chunk' | 'embed' | 'upsert';
    error: Error;
  }>;
}
```

**Usage Examples:**

```typescript
// Simple: default settings
const stats = await pipeline.ingest(
  'docs/**/*.pdf',
  'my-collection'
);

// Advanced: custom chunk size and metadata
const stats = await pipeline.ingest(
  ['docs/**/*.pdf', 'notes/**/*.md'],
  'my-collection',
  {
    chunkSize: 1000,
    chunkOverlap: 100,
    metadata: { project: 'legal-docs', version: '2024' },
    onProgress: (p) => console.log(`${p.stage}: ${p.documentsProcessed}/${p.totalDocuments}`)
  }
);
```

## Chunking Strategies

### RecursiveChunker (Default)

```typescript
class RecursiveChunker implements TextChunker {
  private separators = [
    '\n\n',      // Paragraphs (double newline)
    '\n',        // Lines (single newline)
    '. ',        // Sentences (period + space)
    ' ',         // Words (space)
    ''           // Characters (last resort)
  ];

  chunk(text: string, config?: ChunkConfig): TextChunk[] {
    // Algorithm:
    // 1. Try splitting by first separator (paragraphs)
    // 2. If resulting chunks fit target size → done
    // 3. Otherwise, recursively split oversized chunks by next separator
    // 4. Maintain overlap by including trailing tokens from previous chunk
    // 5. Track positions (startChar, endChar) for each chunk
  }
}
```

**Characteristics:**
- Respects natural text boundaries
- Hierarchical approach: tries coarse splits first, refines as needed
- Maintains chunk size targets while preserving readability
- Overlap ensures context continuity

### FixedChunker

```typescript
class FixedChunker implements TextChunker {
  chunk(text: string, config?: ChunkConfig): TextChunk[] {
    // Split at exact character boundaries
    // Add overlap by including last N characters from previous chunk
    // Fast, predictable size, may split mid-sentence
  }
}
```

**Characteristics:**
- Fastest implementation
- Predictable chunk sizes
- May split mid-sentence or mid-word
- Good for size-constrained scenarios

### SentenceChunker

```typescript
class SentenceChunker implements TextChunker {
  chunk(text: string, config?: ChunkConfig): TextChunk[] {
    // Use compromise library for sentence detection
    // Group sentences until target size reached
    // Maintain overlap by including last sentence from previous chunk
  }
}
```

**Characteristics:**
- Clean boundaries at sentence level
- Better semantic coherence than fixed chunking
- Variable chunk sizes (grouped sentences)
- Requires compromise library

### SemanticChunker

```typescript
class SemanticChunker implements TextChunker {
  constructor(private embedder: Embedder) {}

  chunk(text: string, config?: ChunkConfig): TextChunk[] {
    // 1. Split into sentences
    // 2. Embed each sentence
    // 3. Calculate cosine similarity between consecutive sentences
    // 4. Find topic boundaries (low similarity)
    // 5. Group sentences between boundaries into chunks
  }
}
```

**Characteristics:**
- Highest quality semantic grouping
- Finds natural topic shifts
- Slower (requires embedding API calls)
- Costs money (API usage per sentence)
- Advanced feature for specialized use cases

**Smart Defaults:**
- Chunk size: 500 tokens (~2000 characters for English)
- Overlap: 50 tokens (~200 characters)
- Token estimation: `characters / 4` (simple heuristic, sufficient with overlap buffer)

## Document Loaders

### LoaderRegistry

```typescript
class LoaderRegistry {
  private loaders: DocumentLoader[] = [];

  constructor() {
    // Register built-in loaders
    this.register(new TextLoader());
    this.register(new PDFLoader());
    this.register(new DOCXLoader());
    this.register(new HTMLLoader());
  }

  register(loader: DocumentLoader): void {
    this.loaders.push(loader);
  }

  async load(filePath: string): Promise<Document> {
    const loader = this.loaders.find(l => l.canHandle(filePath));
    if (!loader) {
      throw new Error(`No loader found for file: ${filePath}`);
    }
    return loader.load(filePath);
  }

  canLoad(filePath: string): boolean {
    return this.loaders.some(l => l.canHandle(filePath));
  }
}
```

**Extension mechanism:**
Users can register custom loaders for proprietary formats:
```typescript
class CustomLoader implements DocumentLoader {
  canHandle(path: string) { return path.endsWith('.custom'); }
  async load(path: string) { /* custom logic */ }
}

registry.register(new CustomLoader());
```

### TextLoader

```typescript
class TextLoader implements DocumentLoader {
  canHandle(filePath: string): boolean {
    return /\.(txt|md)$/i.test(filePath);
  }

  async load(filePath: string): Promise<Document> {
    const text = await fs.promises.readFile(filePath, 'utf-8');
    return {
      text,
      source: filePath,
      type: path.extname(filePath).slice(1)
    };
  }
}
```

**Characteristics:**
- No external dependencies (built-in Node.js fs)
- Preserves line breaks and formatting
- UTF-8 encoding

### PDFLoader

```typescript
class PDFLoader implements DocumentLoader {
  canHandle(filePath: string): boolean {
    return /\.pdf$/i.test(filePath);
  }

  async load(filePath: string): Promise<Document> {
    const dataBuffer = await fs.promises.readFile(filePath);
    const pdfData = await pdfParse(dataBuffer);
    return {
      text: pdfData.text,
      source: filePath,
      type: 'pdf',
      metadata: {
        pages: pdfData.numpages,
        info: pdfData.info  // PDF metadata (author, title, etc.)
      }
    };
  }
}
```

**Characteristics:**
- Uses `pdf-parse` library
- Extracts text from all pages
- Handles multi-page documents
- Ignores images/tables (text only)
- Includes PDF metadata (pages, author, title)

### DOCXLoader

```typescript
class DOCXLoader implements DocumentLoader {
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
        warnings: result.messages  // Conversion warnings
      }
    };
  }
}
```

**Characteristics:**
- Uses `mammoth` library
- Converts DOCX to plain text
- Preserves paragraph structure
- Strips formatting, images, tables

### HTMLLoader

```typescript
class HTMLLoader implements DocumentLoader {
  canHandle(filePath: string): boolean {
    return /\.html?$/i.test(filePath);
  }

  async load(filePath: string): Promise<Document> {
    const html = await fs.promises.readFile(filePath, 'utf-8');
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
        title: $('title').text(),
        description: $('meta[name="description"]').attr('content')
      }
    };
  }
}
```

**Characteristics:**
- Uses `cheerio` library (fast, jQuery-like)
- Strips tags, extracts visible text
- Removes scripts, styles, navigation
- Extracts metadata (title, description)

### Automatic Vertical Metadata Extraction

All loaders automatically populate vertical metadata fields:

```typescript
// For file: /docs/legal/contracts/lease-2024.pdf
{
  __v_source: '/docs/legal/contracts/lease-2024.pdf',
  __v_doc_type: 'pdf',
  __v_doc_id: 'lease-2024',
  __v_partition: 'legal/contracts'  // Parent directory path
}
```

**Extraction logic:**
- `__v_source`: Full file path
- `__v_doc_type`: File extension (from `type` field)
- `__v_doc_id`: Filename without extension
- `__v_partition`: Parent directory path (for organizational grouping)

**User override:**
Users can override auto-extracted metadata:
```typescript
await pipeline.ingest(files, collection, {
  metadata: { __v_partition: 'custom-partition' },  // Override
  metadataExtractor: (doc) => ({
    __v_doc_id: extractIdFromFilename(doc.source)  // Custom logic
  })
});
```

## Error Handling & Progress Reporting

### Error Handling Strategy

**Best-effort processing** - Continue on errors, report at end:

```typescript
// Error scenarios:
// 1. Document fails to load → Log error, continue to next document
// 2. Chunking fails → Log error, skip document
// 3. Embedding fails → Retry batch with smaller size, then fail document
// 4. Upsert fails → Retry once, then fail batch

interface IngestionStats {
  documentsProcessed: number;
  documentsSucceeded: number;
  documentsFailed: number;
  chunksCreated: number;
  chunksUpserted: number;
  timeMs: number;
  errors?: Array<{
    source: string;
    stage: 'load' | 'chunk' | 'embed' | 'upsert';
    error: Error;
  }>;
}
```

**Error recovery:**
- Individual document failures don't stop the job
- Embedding failures retry with smaller batches (handle rate limits)
- Upsert failures retry once (handle transient network issues)
- All errors collected in stats for inspection

**Rationale:**
- Large ingestion jobs (100s of documents) need resilience
- Users can inspect errors and retry failed documents separately
- Partial success better than total failure for large jobs

### Progress Reporting

```typescript
type ProgressCallback = (progress: {
  stage: 'loading' | 'chunking' | 'embedding' | 'upserting';
  documentsProcessed: number;
  totalDocuments: number;
  chunksProcessed: number;
  totalChunks?: number;  // Known after chunking stage completes
  currentDocument?: string;  // File being processed
}) => void;
```

**Usage:**
```typescript
await pipeline.ingest(files, collection, {
  onProgress: (p) => {
    console.log(
      `[${p.stage}] ${p.documentsProcessed}/${p.totalDocuments} docs, ` +
      `${p.chunksProcessed}/${p.totalChunks || '?'} chunks`
    );
  }
});
```

**Progress stages:**
1. **loading** - Reading files from disk
2. **chunking** - Splitting documents into chunks
3. **embedding** - Generating embeddings (slowest stage)
4. **upserting** - Writing to vector DB

**Rationale:**
- Large jobs need visibility (prevent "is it stuck?" questions)
- Stage information helps identify bottlenecks
- Optional callback keeps API simple by default

## Testing Strategy

### Unit Tests

**Loaders:**
- `tests/ingestion/loaders/text-loader.test.ts` - Text/MD loading
  - UTF-8 encoding, line breaks preserved
  - Error handling for missing files
- `tests/ingestion/loaders/pdf-loader.test.ts` - PDF extraction
  - Mock pdf-parse library
  - Multi-page handling, metadata extraction
- `tests/ingestion/loaders/docx-loader.test.ts` - DOCX conversion
  - Mock mammoth library
  - Paragraph preservation
- `tests/ingestion/loaders/html-loader.test.ts` - HTML parsing
  - Tag stripping, whitespace normalization
  - Script/style removal
- `tests/ingestion/loaders/loader-registry.test.ts` - Routing logic
  - Extension detection
  - Custom loader registration
  - Error handling for unsupported formats

**Chunkers:**
- `tests/ingestion/chunkers/recursive-chunker.test.ts` - Recursive algorithm
  - Separator hierarchy
  - Overlap calculation
  - Position tracking
- `tests/ingestion/chunkers/fixed-chunker.test.ts` - Fixed-size chunking
  - Exact size boundaries
  - Overlap handling
- `tests/ingestion/chunkers/sentence-chunker.test.ts` - Sentence detection
  - Mock compromise library
  - Sentence grouping

### Integration Tests

- `tests/ingestion/ingestion-integration.test.ts` - Full pipeline with mock adapter
  - Load → chunk → embed → upsert flow
  - Metadata extraction and merging
  - User metadata override
  - Batch processing
  - Error handling and stats collection
  - Progress callback invocation

### E2E Tests

- `tests/ingestion/ingestion-e2e.test.ts` - Real files, real vector DB
  - Test fixture documents:
    - `fixtures/sample.txt`
    - `fixtures/sample.pdf`
    - `fixtures/sample.docx`
    - `fixtures/sample.html`
  - Verify chunks written to actual vector DB
  - Verify metadata structure (__v_* fields)
  - Verify embeddings generated correctly

**Coverage Target:** 80%+ on ingestion logic

## Package Structure

```
packages/core/src/ingestion/
├── loaders/
│   ├── document-loader.ts      # Interface
│   ├── text-loader.ts
│   ├── pdf-loader.ts
│   ├── docx-loader.ts
│   ├── html-loader.ts
│   ├── loader-registry.ts
│   └── index.ts
├── chunkers/
│   ├── text-chunker.ts         # Interface
│   ├── recursive-chunker.ts
│   ├── fixed-chunker.ts
│   ├── sentence-chunker.ts
│   └── index.ts
├── ingestion-pipeline.ts
├── types.ts                    # Document, TextChunk, IngestionConfig, IngestionStats
└── index.ts
```

## Implementation Tasks

1. **Document Loaders** (Task 1-5)
   - Task 1: DocumentLoader interface + types
   - Task 2: TextLoader (no deps)
   - Task 3: PDFLoader (pdf-parse)
   - Task 4: DOCXLoader (mammoth)
   - Task 5: HTMLLoader (cheerio)

2. **LoaderRegistry** (Task 6)
   - Registry with auto-detection
   - Custom loader registration

3. **Text Chunkers** (Task 7-10)
   - Task 7: TextChunker interface + ChunkConfig types
   - Task 8: RecursiveChunker (default)
   - Task 9: FixedChunker
   - Task 10: SentenceChunker (compromise)

4. **IngestionPipeline** (Task 11-12)
   - Task 11: Core pipeline (load → chunk → embed → upsert)
   - Task 12: Metadata extraction, progress callbacks, error handling

5. **Integration Tests** (Task 13)

6. **E2E Tests with fixtures** (Task 14)

## Success Criteria

- [ ] All 4 document loaders working (text, PDF, DOCX, HTML)
- [ ] RecursiveChunker, FixedChunker, SentenceChunker implemented
- [ ] IngestionPipeline orchestrates full flow
- [ ] Automatic vertical metadata extraction
- [ ] Progress callbacks and error handling
- [ ] 80%+ test coverage
- [ ] E2E tests with real fixtures passing

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chunking priority | RecursiveChunker default | Best balance of quality and simplicity |
| Document formats | All (text, PDF, DOCX, HTML) | Comprehensive support from start |
| Theme classification | Separate enrichment step | Clean separation, faster ingestion |
| Vertical metadata | Automatic with override | Smart defaults, flexible when needed |
| Chunking config | Smart defaults | Easy to start, customizable |
| Error handling | Best-effort | Resilient for large jobs |
| Progress reporting | Optional callbacks | Visibility for long jobs, simple by default |
| Token estimation | characters / 4 heuristic | Sufficient with overlap buffer |

---

**Design approved by:** User
**Ready for implementation:** Yes
**Next step:** Create implementation plan with git worktree
