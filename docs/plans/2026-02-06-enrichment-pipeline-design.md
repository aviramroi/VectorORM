# Phase 4: Enrichment Pipeline - Design Document

**Date:** 2026-02-06
**Status:** Approved for Implementation
**Phase:** 4 of 7

## Executive Summary

Phase 4 adds enrichment capabilities to retrofit existing vector databases with Vertical and Horizontal RAG metadata. The enrichment pipeline operates on vectors already stored in the database, updating their metadata in-place without re-embedding.

## Architecture Overview

**Core Components:**

1. **LLMClient** - Abstract class for LLM providers (OpenAI, Anthropic, etc.), used for automatic metadata extraction and theme classification

2. **Theme Classifiers** - Four strategies for horizontal enrichment:
   - `KeywordThemeClassifier` - Fast regex/string matching
   - `ZeroShotThemeClassifier` - Transformers.js zero-shot classification
   - `EmbeddingThemeClassifier` - Cosine similarity using embeddings
   - `LLMThemeClassifier` - LLM-based classification

3. **EnrichmentPipeline** - Main orchestrator that:
   - Handles vertical enrichment (document metadata)
   - Handles horizontal enrichment (themes, sections)
   - Supports both batch and filtered operations
   - Provides individual methods and unified `enrichAll()`

**Dependencies:**
- Uses existing `VectorDBAdapter` for database operations
- Uses existing `Embedder` for embedding-based classification
- Requires new `LLMClient` abstraction
- Uses `@xenova/transformers` (already in dependencies) for zero-shot

**Data Flow:**
```
Records → Filter (optional) → Batch fetch →
Enrich metadata → Batch update → Stats
```

## LLM Abstraction

The `LLMClient` abstract class provides a unified interface for LLM providers, similar to how `Embedder` abstracts embedding models.

**Interface Design:**

```typescript
abstract class LLMClient {
  abstract get modelName(): string;
  abstract get provider(): string; // 'openai', 'anthropic', etc.

  // Core generation method
  abstract generate(
    prompt: string,
    options?: GenerateOptions
  ): Promise<string>;

  // Structured output with JSON mode
  abstract generateJSON<T = any>(
    prompt: string,
    schema?: object,
    options?: GenerateOptions
  ): Promise<T>;

  // Batch generation for efficiency
  abstract generateBatch(
    prompts: string[],
    options?: GenerateOptions
  ): Promise<string[]>;
}

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stopSequences?: string[];
}
```

**Key Design Decisions:**
- `generateJSON()` for structured metadata extraction (uses JSON mode where available)
- Batch support for processing multiple records efficiently
- System prompts for consistent behavior
- Provider identification for debugging/logging
- Simple interface - no streaming, no function calling (YAGNI for enrichment use case)

## Theme Classifiers

All theme classifiers implement a common interface for horizontal enrichment:

```typescript
interface ThemeClassifier {
  classify(text: string): Promise<ThemeClassification>;
  classifyBatch(texts: string[]): Promise<ThemeClassification[]>;
}

interface ThemeClassification {
  theme: string;
  confidence: number;
  allScores?: Record<string, number>; // Optional: scores for all themes
}
```

### 1. KeywordThemeClassifier

**Strategy:** Count keyword matches, highest score wins

```typescript
class KeywordThemeClassifier implements ThemeClassifier {
  constructor(
    private themes: string[],
    private keywords: Record<string, string[]>,
    private caseSensitive = false
  ) {}
}
```

**Characteristics:**
- Fastest, deterministic
- No external dependencies
- Confidence: Normalized match count
- Good for well-defined domains with known keywords

### 2. ZeroShotThemeClassifier

**Strategy:** Transformers.js zero-shot classification

```typescript
class ZeroShotThemeClassifier implements ThemeClassifier {
  constructor(
    private themes: string[],
    private modelName = 'Xenova/distilbert-base-uncased-mnli'
  ) {}
}
```

**Characteristics:**
- No API calls, runs locally
- Good semantic understanding
- No training data needed
- Medium speed

### 3. EmbeddingThemeClassifier

**Strategy:** Cosine similarity between text and theme embeddings

```typescript
class EmbeddingThemeClassifier implements ThemeClassifier {
  constructor(
    private themes: string[],
    private embedder: Embedder,
    private themeEmbeddings?: number[][] // Optional: pre-computed
  ) {}
}
```

**Characteristics:**
- Precompute theme embeddings in constructor for efficiency
- Good semantic understanding
- Requires embedder instance
- Fast at inference time

### 4. LLMThemeClassifier

**Strategy:** LLM classification with structured JSON output

```typescript
class LLMThemeClassifier implements ThemeClassifier {
  constructor(
    private themes: string[],
    private llm: LLMClient,
    private promptTemplate?: string
  ) {}
}
```

**Characteristics:**
- Highest quality, most flexible
- Can understand nuanced context
- Requires API calls (cost consideration)
- Customizable via prompt templates

**All classifiers support batching for efficiency.**

## Vertical Enrichment

Vertical enrichment adds document-level metadata (`__v_*` fields). Three approaches supported:

### 1. Field Mapping

Simple copying/transformation of existing metadata fields:

```typescript
interface FieldMappingConfig {
  mapping: Record<string, string>;  // source → target
  filter?: UniversalFilter;
  batchSize?: number;
}

await pipeline.enrichVertical(collection, {
  mapping: {
    'source': '__v_source',           // Direct copy
    'document_id': '__v_doc_id',      // Rename
    'type': '__v_doc_type'            // Map field
  },
  filter?: UniversalFilter,  // Optional: enrich subset
  batchSize?: 100
});
```

### 2. Extractor Functions

User-provided logic for complex extraction:

```typescript
interface ExtractorConfig {
  extractor: (record: VectorRecord) => Record<string, any>;
  filter?: UniversalFilter;
  batchSize?: number;
}

await pipeline.enrichVertical(collection, {
  extractor: (record: VectorRecord) => {
    // Extract from filename, content, existing metadata
    const filename = record.metadata.source || '';
    return {
      docId: filename.split('/').pop()?.split('.')[0],
      partition: filename.includes('2024') ? '2024' : '2023',
      docType: filename.endsWith('.pdf') ? 'pdf' : 'text'
    };
  },
  filter?: UniversalFilter,
  batchSize?: 100
});
```

### 3. Automatic LLM Extraction

LLM analyzes content and extracts metadata:

```typescript
interface AutomaticExtractionConfig {
  automatic: {
    llm: LLMClient;
    fields: string[];  // What to extract
    promptTemplate?: string;  // Optional custom prompt
    textField?: string;  // Which field to analyze (default: 'text')
  };
  filter?: UniversalFilter;
  batchSize?: number;
}

await pipeline.enrichVertical(collection, {
  automatic: {
    llm: myLLMClient,
    fields: ['docType', 'source', 'tags'],
    promptTemplate?: string,
    textField?: 'text'
  },
  filter?: UniversalFilter,
  batchSize?: 10  // Smaller batches for LLM
});
```

**All three approaches can be combined in a single enrichment operation.**

## Horizontal Enrichment

Horizontal enrichment adds theme and section metadata (`__h_*` fields).

### Theme Classification

```typescript
interface ThemeEnrichmentConfig {
  themes: string[];
  classifier: ThemeClassifier;
  textField?: string;  // Default: 'text'
  confidenceThreshold?: number;  // Default: 0.5
  multiTheme?: boolean;  // Default: false
  filter?: UniversalFilter;
  batchSize?: number;
  onProgress?: ProgressCallback;
}

await pipeline.enrichThemes(collection, {
  themes: ['legal', 'financial', 'technical'],
  classifier: keywordClassifier,  // or zeroShot, embedding, llm
  textField?: 'text',
  confidenceThreshold?: 0.5,
  multiTheme?: false,
  filter?: UniversalFilter,
  batchSize?: 100,
  onProgress?: (current, total, stats) => void
});
```

**Enriches with:**
- `__h_theme`: Primary theme
- `__h_theme_confidence`: Confidence score
- `__h_themes`: Array of themes (if multiTheme enabled)

### Section Detection

```typescript
interface SectionEnrichmentConfig {
  existingField?: string;  // Map from existing field
  autoDetect?: {
    textField: string;
    strategy: 'markdown' | 'html' | 'pattern';
    customPattern?: RegExp;
  };
  filter?: UniversalFilter;
  batchSize?: number;
}

await pipeline.enrichSections(collection, {
  // Option 1: Map existing field
  existingField?: 'section',

  // Option 2: Auto-detect from text
  autoDetect?: {
    textField: 'text',
    strategy: 'markdown' | 'html' | 'pattern',
    customPattern?: RegExp
  },

  // Fallback: use existingField if present, else autoDetect
  filter?: UniversalFilter,
  batchSize?: 100
});
```

**Enriches with:**
- `__h_section_path`: Full section hierarchy (e.g., "Chapter 1/Section 1.2")
- `__h_section_level`: Nesting depth
- `__h_section_title`: Section heading text

## EnrichmentPipeline API

The pipeline provides both granular methods and a unified convenience method:

### Granular Methods

```typescript
class EnrichmentPipeline {
  constructor(
    private adapter: VectorDBAdapter,
    private embedder?: Embedder,
    private llm?: LLMClient
  ) {}

  // Individual enrichment methods
  async enrichVertical(
    collection: string,
    config: VerticalEnrichmentConfig
  ): Promise<EnrichmentStats>;

  async enrichThemes(
    collection: string,
    config: ThemeEnrichmentConfig
  ): Promise<EnrichmentStats>;

  async enrichSections(
    collection: string,
    config: SectionEnrichmentConfig
  ): Promise<EnrichmentStats>;
}
```

### Unified Method

```typescript
async enrichAll(
  collection: string,
  config: {
    vertical?: VerticalEnrichmentConfig;
    themes?: ThemeEnrichmentConfig;
    sections?: SectionEnrichmentConfig;
    filter?: UniversalFilter;  // Global filter
    batchSize?: number;  // Global batch size
    onProgress?: ProgressCallback;  // Global progress
  }
): Promise<EnrichmentStats>;
```

**The unified `enrichAll()` runs enrichment steps in order:**
1. Vertical enrichment
2. Theme classification
3. Section detection

Each step processes the same filtered set of records efficiently.

### Return Stats

```typescript
interface EnrichmentStats {
  recordsProcessed: number;
  recordsUpdated: number;
  recordsSkipped: number;
  timeMs: number;
  errors?: Error[];  // Only present if errors occurred
}

type ProgressCallback = (
  current: number,
  total: number,
  stats: Partial<EnrichmentStats>
) => void;
```

## Error Handling & Progress

### Error Handling (Fail-Fast)

When any record fails during enrichment, the entire operation stops immediately:

```typescript
try {
  const stats = await pipeline.enrichThemes(collection, config);
  // Success: all records processed
} catch (error) {
  // Failure: operation stopped at first error
  // error.message includes which record failed
  // Some records may have been updated before failure
}
```

**Error Context:**
- Record ID that failed
- Batch number
- Original error cause (via error.cause)

**Rationale:**
This ensures data integrity - you know exactly what succeeded and what failed. Users can handle errors and retry with adjustments (e.g., smaller batch size, different classifier).

### Progress Reporting

By default, enrichment is silent (just returns final stats). Optional progress callback:

```typescript
await pipeline.enrichThemes(collection, {
  themes: ['legal', 'financial'],
  classifier: myClassifier,
  onProgress: (current, total, stats) => {
    console.log(`Processed ${current}/${total} records`);
    console.log(`Updated: ${stats.recordsUpdated}`);
  }
});
```

**Progress callback receives:**
- `current`: Records processed so far
- `total`: Total records to process
- `stats`: Current stats (updated, skipped)

Callbacks fire after each batch completes. Useful for long-running operations (especially LLM-based enrichment).

## Testing Strategy

Three-tier testing approach matching Phase 3 adapters:

### 1. Unit Tests

Test each component in isolation with mocks:

**Theme Classifiers:**
- `tests/unit/classifiers/keyword-classifier.test.ts` - keyword matching accuracy
- `tests/unit/classifiers/zero-shot-classifier.test.ts` - transformers.js integration
- `tests/unit/classifiers/embedding-classifier.test.ts` - cosine similarity calculations
- `tests/unit/classifiers/llm-classifier.test.ts` - prompt construction, JSON parsing

**EnrichmentPipeline:**
- `tests/unit/vertical-enrichment.test.ts` - mapping, extractors, auto-extraction
- `tests/unit/theme-enrichment.test.ts` - classifier integration, batching
- `tests/unit/section-enrichment.test.ts` - field mapping, auto-detection
- `tests/unit/enrichment-pipeline.test.ts` - enrichAll() coordination

**LLMClient:**
- `tests/unit/llm-client.test.ts` - Mock implementations for testing

### 2. Integration Tests

Test components working together with real (in-memory) adapters:
- `tests/integration/enrichment-integration.test.ts` - Full enrichment workflows
- Use mock adapter with in-memory storage
- Verify metadata updates persist correctly

### 3. E2E Tests

Test with real vector databases (skip if no API keys):
- `tests/e2e/pinecone-enrichment.test.ts` - Enrichment on real Pinecone index
- `tests/e2e/chroma-enrichment.test.ts` - Enrichment on real Chroma collection
- Uses `describe.skipIf(!hasApiKey)` pattern from Phase 3

**Target:** 80%+ coverage on core enrichment logic.

## Package Structure

All enrichment code lives in `@glyph/core`:

```
packages/core/src/
├── llm/
│   ├── llm-client.ts          # Abstract LLMClient
│   ├── types.ts               # GenerateOptions, etc.
│   └── index.ts
├── enrichment/
│   ├── classifiers/
│   │   ├── theme-classifier.ts      # Interface
│   │   ├── keyword-classifier.ts
│   │   ├── zero-shot-classifier.ts
│   │   ├── embedding-classifier.ts
│   │   ├── llm-classifier.ts
│   │   └── index.ts
│   ├── enrichment-pipeline.ts
│   ├── types.ts               # Config interfaces, stats
│   └── index.ts
└── index.ts                   # Re-export all
```

## Implementation Order

1. **LLM Abstraction** (Task 1)
   - LLMClient abstract class
   - Types and interfaces
   - Mock implementation for testing

2. **Theme Classifiers** (Tasks 2-5)
   - Interface and types
   - KeywordThemeClassifier
   - ZeroShotThemeClassifier
   - EmbeddingThemeClassifier
   - LLMThemeClassifier

3. **Vertical Enrichment** (Task 6)
   - Field mapping
   - Extractor functions
   - Automatic LLM extraction

4. **Horizontal Enrichment** (Tasks 7-8)
   - Theme enrichment
   - Section detection

5. **EnrichmentPipeline** (Task 9)
   - Individual methods
   - Unified enrichAll()
   - Progress callbacks
   - Error handling

6. **Integration Tests** (Task 10)

## Success Criteria

- [ ] LLMClient abstraction with generate, generateJSON, generateBatch
- [ ] All 4 theme classifiers implemented and tested
- [ ] Vertical enrichment supports mapping, extractors, and automatic LLM
- [ ] Horizontal enrichment supports themes and sections
- [ ] EnrichmentPipeline provides individual + unified methods
- [ ] Fail-fast error handling with detailed error context
- [ ] Optional progress callbacks
- [ ] 80%+ test coverage
- [ ] E2E tests pass with real vector databases

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Batch vs filtered | Both | Flexibility for different use cases |
| Theme classifiers | All 4 | Speed/accuracy trade-offs for different scenarios |
| Vertical sources | Mapping + extractors + LLM | Simple to complex, automatic option |
| Progress reporting | Silent + optional callback | Simple default, observable when needed |
| Error handling | Fail-fast | Data integrity, clear success/failure |
| Section detection | Existing field + auto-detect | Use what's available, fallback to detection |
| Dry-run mode | No | Keep simple, test on filtered subset |
| API structure | Granular + unified | Flexibility + convenience |
| LLM abstraction | Build now | Required for LLM classifier and auto-extraction |
| Testing | Unit + integration + E2E | Match Phase 3 quality standards |

---

**Design approved by:** User
**Ready for implementation:** Yes
**Next step:** Create implementation plan with git worktree
