# Query Composition Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build RAGQueryComposer for V/H-aware retrieval combining filters with similarity search.

**Architecture:** RAGQueryComposer orchestrates vector search with vertical (document-level) and horizontal (theme/section-level) filtering. Builds unified filter from multiple sources, translates via adapter, and executes search. Supports coverage-aware horizontal retrieval ensuring results span all document groups.

**Tech Stack:** TypeScript, extends existing core abstractions, uses VectorDBAdapter and FilterTranslator

---

## Task 1: Retrieval Types and Interfaces

**Files:**
- Create: `packages/core/src/query/types.ts`
- Create: `packages/core/src/query/index.ts`
- Test: `packages/core/tests/query/types.test.ts`

**Step 1: Write test for retrieval types**

```bash
mkdir -p packages/core/tests/query
cat > packages/core/tests/query/types.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import type {
  RetrievalParams,
  RetrievalResult,
  SearchOptions
} from '../../src/query/types';

describe('Query Types', () => {
  it('should accept basic retrieval params', () => {
    const params: RetrievalParams = {
      query: 'test query',
      topK: 10
    };

    expect(params.query).toBe('test query');
    expect(params.topK).toBe(10);
  });

  it('should accept vertical params', () => {
    const params: RetrievalParams = {
      query: 'test',
      vertical: { region: 'ny' },
      partitions: ['ny', 'ca'],
      documents: ['doc1']
    };

    expect(params.vertical).toEqual({ region: 'ny' });
  });

  it('should accept horizontal params', () => {
    const params: RetrievalParams = {
      query: 'test',
      horizontal: { theme: 'pricing' },
      themes: ['pricing', 'coverage'],
      sectionPattern: 'Chapter*'
    };

    expect(params.horizontal).toEqual({ theme: 'pricing' });
  });

  it('should accept retrieval result', () => {
    const result: RetrievalResult = {
      records: [],
      query: 'test',
      filtersApplied: { region: 'ny' }
    };

    expect(result.query).toBe('test');
  });
});
EOF
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npm test`
Expected: FAIL - Cannot find module '../../src/query/types'

**Step 3: Create query types**

```bash
mkdir -p packages/core/src/query
cat > packages/core/src/query/types.ts << 'EOF'
import type { VectorRecord } from '../types';
import type { UniversalFilter } from '../filters';

/**
 * Parameters for retrieval operations.
 */
export interface RetrievalParams {
  /** Natural language query */
  query: string;

  /** Collection name (optional if default set) */
  collection?: string;

  /** Number of results to return */
  topK?: number;

  // ══════════════════════════════════════════════════════════════
  // VERTICAL SLICING (Document-Level)
  // ══════════════════════════════════════════════════════════════

  /** Vertical filters (document-level metadata) */
  vertical?: Record<string, any>;

  /** Shorthand for __v_partition filter */
  partitions?: string[];

  /** Shorthand for __v_doc_id filter */
  documents?: string[];

  // ══════════════════════════════════════════════════════════════
  // HORIZONTAL SLICING (Content/Theme-Level)
  // ══════════════════════════════════════════════════════════════

  /** Horizontal filters (theme/section metadata) */
  horizontal?: Record<string, any>;

  /** Shorthand for __h_theme filter */
  themes?: string[];

  /** Pattern for section path matching */
  sectionPattern?: string;

  /** Specific section level */
  sectionLevel?: number;

  // ══════════════════════════════════════════════════════════════
  // ADDITIONAL OPTIONS
  // ══════════════════════════════════════════════════════════════

  /** Additional custom filters */
  filters?: Record<string, any>;

  /** Include embeddings in results */
  includeEmbeddings?: boolean;

  /** Ensure coverage across groups (for horizontal queries) */
  ensureCoverage?: boolean;

  /** Field to ensure coverage across */
  coverageField?: string;

  /** Minimum results per coverage group */
  minPerGroup?: number;
}

/**
 * Result from a retrieval operation.
 */
export interface RetrievalResult {
  /** Retrieved vector records */
  records: VectorRecord[];

  /** Original query */
  query: string;

  /** Filters that were applied */
  filtersApplied: Record<string, any>;

  /** Total candidate count (if available) */
  totalCandidates?: number;
}

/**
 * Options for search operations.
 */
export interface SearchOptions {
  /** Number of results */
  topK?: number;

  /** Filter to apply */
  filter?: UniversalFilter;

  /** Include embeddings */
  includeEmbeddings?: boolean;

  /** Ensure coverage */
  ensureCoverage?: boolean;

  /** Coverage field */
  coverageField?: string;

  /** Min per group */
  minPerGroup?: number;
}

/**
 * Grouped results for comparison queries.
 */
export interface GroupedResults {
  /** Results grouped by field value */
  groups: Record<string, VectorRecord[]>;

  /** Original query */
  query: string;

  /** Field used for grouping */
  groupedBy: string;
}
EOF
```

**Step 4: Create query index**

```bash
cat > packages/core/src/query/index.ts << 'EOF'
export type {
  RetrievalParams,
  RetrievalResult,
  SearchOptions,
  GroupedResults
} from './types';
EOF
```

**Step 5: Run test to verify it passes**

Run: `cd packages/core && npm test`
Expected: PASS - 4 new tests (37 total)

**Step 6: Update main index**

```bash
cat >> packages/core/src/index.ts << 'EOF'

// Query
export type {
  RetrievalParams,
  RetrievalResult,
  SearchOptions,
  GroupedResults
} from './query';
EOF
```

**Step 7: Build and verify**

Run: `cd packages/core && npm run build && npm run lint`
Expected: Build successful, no errors

**Step 8: Commit**

```bash
git add packages/core/src/query/ packages/core/tests/query/ packages/core/src/index.ts
git commit -m "feat(query): add retrieval types and interfaces

Implement types for V/H-aware retrieval:
- RetrievalParams with vertical/horizontal options
- RetrievalResult with filter tracking
- GroupedResults for comparison queries

Tests: 37 passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Embedder Abstraction

**Files:**
- Create: `packages/core/src/embedders/types.ts`
- Create: `packages/core/src/embedders/index.ts`
- Test: `packages/core/tests/embedders/embedder.test.ts`

**Step 1: Write test for embedder interface**

```bash
mkdir -p packages/core/tests/embedders
cat > packages/core/tests/embedders/embedder.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import type { Embedder } from '../../src/embedders/types';

// Mock embedder for testing
class MockEmbedder implements Embedder {
  dimension = 384;

  async embed(text: string): Promise<number[]> {
    return new Array(this.dimension).fill(0.1);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => new Array(this.dimension).fill(0.1));
  }
}

describe('Embedder', () => {
  it('should implement embedder interface', () => {
    const embedder = new MockEmbedder();

    expect(embedder.dimension).toBe(384);
    expect(typeof embedder.embed).toBe('function');
    expect(typeof embedder.embedBatch).toBe('function');
  });

  it('should embed single text', async () => {
    const embedder = new MockEmbedder();
    const embedding = await embedder.embed('test text');

    expect(embedding).toHaveLength(384);
    expect(embedding[0]).toBe(0.1);
  });

  it('should embed batch of texts', async () => {
    const embedder = new MockEmbedder();
    const embeddings = await embedder.embedBatch(['text1', 'text2', 'text3']);

    expect(embeddings).toHaveLength(3);
    expect(embeddings[0]).toHaveLength(384);
    expect(embeddings[1]).toHaveLength(384);
  });
});
EOF
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npm test`
Expected: FAIL - Cannot find module '../../src/embedders/types'

**Step 3: Create embedder types**

```bash
mkdir -p packages/core/src/embedders
cat > packages/core/src/embedders/types.ts << 'EOF'
/**
 * Embedder interface for generating vector embeddings from text.
 *
 * Implementations wrap various embedding models (OpenAI, Cohere, local models, etc.)
 * and provide a consistent interface for the query composer.
 */
export interface Embedder {
  /**
   * Dimension of the embeddings produced by this embedder.
   */
  dimension: number;

  /**
   * Embed a single text string.
   *
   * @param text - Text to embed
   * @returns Embedding vector
   */
  embed(text: string): Promise<number[]>;

  /**
   * Embed multiple texts in a batch.
   *
   * More efficient than calling embed() multiple times.
   *
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}
EOF
```

**Step 4: Create embedders index**

```bash
cat > packages/core/src/embedders/index.ts << 'EOF'
export type { Embedder } from './types';
EOF
```

**Step 5: Run test to verify it passes**

Run: `cd packages/core && npm test`
Expected: PASS - 3 new tests (40 total)

**Step 6: Update main index**

```bash
cat >> packages/core/src/index.ts << 'EOF'

// Embedders
export type { Embedder } from './embedders';
EOF
```

**Step 7: Build and verify**

Run: `cd packages/core && npm run build && npm run lint`
Expected: Build successful

**Step 8: Commit**

```bash
git add packages/core/src/embedders/ packages/core/tests/embedders/ packages/core/src/index.ts
git commit -m "feat(embedders): add Embedder abstraction interface

Implement embedder interface for text-to-vector conversion:
- Single text embedding
- Batch embedding support
- Dimension property

Tests: 40 passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Filter Builder Utility

**Files:**
- Create: `packages/core/src/query/filter-builder.ts`
- Test: `packages/core/tests/query/filter-builder.test.ts`

**Step 1: Write test for FilterBuilder**

```bash
cat > packages/core/tests/query/filter-builder.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { FilterBuilder } from '../../src/query/filter-builder';
import { VerticalFields, HorizontalFields } from '../../src/metadata';

describe('FilterBuilder', () => {
  describe('buildFilter', () => {
    it('should return null for no params', () => {
      const filter = FilterBuilder.buildFilter({});
      expect(filter).toBeNull();
    });

    it('should build vertical filters', () => {
      const filter = FilterBuilder.buildFilter({
        vertical: { region: 'ny' }
      });

      expect(filter).toEqual({
        field: 'region',
        op: 'eq',
        value: 'ny'
      });
    });

    it('should build partition filter', () => {
      const filter = FilterBuilder.buildFilter({
        partitions: ['ny', 'ca']
      });

      expect(filter).toEqual({
        field: VerticalFields.PARTITION,
        op: 'in',
        value: ['ny', 'ca']
      });
    });

    it('should build document filter', () => {
      const filter = FilterBuilder.buildFilter({
        documents: ['doc1', 'doc2']
      });

      expect(filter).toEqual({
        field: VerticalFields.DOC_ID,
        op: 'in',
        value: ['doc1', 'doc2']
      });
    });

    it('should build horizontal theme filter', () => {
      const filter = FilterBuilder.buildFilter({
        themes: ['pricing']
      });

      expect(filter).toEqual({
        field: HorizontalFields.THEME,
        op: 'eq',
        value: 'pricing'
      });
    });

    it('should build section level filter', () => {
      const filter = FilterBuilder.buildFilter({
        sectionLevel: 2
      });

      expect(filter).toEqual({
        field: HorizontalFields.SECTION_LEVEL,
        op: 'eq',
        value: 2
      });
    });

    it('should combine multiple filters with AND', () => {
      const filter = FilterBuilder.buildFilter({
        vertical: { region: 'ny' },
        themes: ['pricing']
      });

      expect(filter).toEqual({
        and: [
          { field: 'region', op: 'eq', value: 'ny' },
          { field: HorizontalFields.THEME, op: 'eq', value: 'pricing' }
        ]
      });
    });

    it('should handle custom filters', () => {
      const filter = FilterBuilder.buildFilter({
        filters: { company: 'Acme' }
      });

      expect(filter).toEqual({
        field: 'company',
        op: 'eq',
        value: 'Acme'
      });
    });
  });
});
EOF
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npm test`
Expected: FAIL - Cannot find module '../../src/query/filter-builder'

**Step 3: Create FilterBuilder implementation**

```bash
cat > packages/core/src/query/filter-builder.ts << 'EOF'
import type { UniversalFilter, FilterCondition } from '../filters';
import { VerticalFields, HorizontalFields } from '../metadata';
import type { RetrievalParams } from './types';

/**
 * Utility for building universal filters from retrieval parameters.
 *
 * Combines vertical, horizontal, and custom filters into a single
 * UniversalFilter that can be translated by adapters.
 */
export class FilterBuilder {
  /**
   * Build a universal filter from retrieval parameters.
   *
   * @param params - Retrieval parameters containing filter specifications
   * @returns Universal filter or null if no filters specified
   */
  static buildFilter(params: Partial<RetrievalParams>): UniversalFilter | null {
    const conditions: FilterCondition[] = [];

    // Vertical filters
    if (params.vertical) {
      for (const [key, value] of Object.entries(params.vertical)) {
        conditions.push({ field: key, op: 'eq', value });
      }
    }

    // Partition filter (shorthand)
    if (params.partitions && params.partitions.length > 0) {
      conditions.push({
        field: VerticalFields.PARTITION,
        op: 'in',
        value: params.partitions
      });
    }

    // Document filter (shorthand)
    if (params.documents && params.documents.length > 0) {
      conditions.push({
        field: VerticalFields.DOC_ID,
        op: 'in',
        value: params.documents
      });
    }

    // Horizontal filters
    if (params.horizontal) {
      for (const [key, value] of Object.entries(params.horizontal)) {
        conditions.push({ field: key, op: 'eq', value });
      }
    }

    // Theme filter (shorthand)
    if (params.themes && params.themes.length > 0) {
      if (params.themes.length === 1) {
        conditions.push({
          field: HorizontalFields.THEME,
          op: 'eq',
          value: params.themes[0]
        });
      } else {
        conditions.push({
          field: HorizontalFields.THEME,
          op: 'in',
          value: params.themes
        });
      }
    }

    // Section level filter
    if (params.sectionLevel !== undefined) {
      conditions.push({
        field: HorizontalFields.SECTION_LEVEL,
        op: 'eq',
        value: params.sectionLevel
      });
    }

    // Section pattern filter
    if (params.sectionPattern) {
      // Convert glob pattern to contains search
      const searchTerm = params.sectionPattern
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/\//g, '')
        .trim();

      if (searchTerm) {
        conditions.push({
          field: HorizontalFields.SECTION_PATH,
          op: 'contains',
          value: searchTerm
        });
      }
    }

    // Custom filters
    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        // Parse operator suffix if present
        if (key.includes('__') && !key.startsWith('__')) {
          const lastIndex = key.lastIndexOf('__');
          const field = key.substring(0, lastIndex);
          const op = key.substring(lastIndex + 2) as any;
          conditions.push({ field, op, value });
        } else {
          conditions.push({ field: key, op: 'eq', value });
        }
      }
    }

    // Return appropriate filter structure
    if (conditions.length === 0) {
      return null;
    }

    if (conditions.length === 1) {
      return conditions[0];
    }

    return { and: conditions };
  }
}
EOF
```

**Step 4: Update query index**

```bash
cat >> packages/core/src/query/index.ts << 'EOF'

export { FilterBuilder } from './filter-builder';
EOF
```

**Step 5: Run test to verify it passes**

Run: `cd packages/core && npm test`
Expected: PASS - 8 new tests (48 total)

**Step 6: Build and verify**

Run: `cd packages/core && npm run build && npm run lint`
Expected: Build successful

**Step 7: Commit**

```bash
git add packages/core/src/query/ packages/core/tests/query/
git commit -m "feat(query): add FilterBuilder utility

Implement filter builder for V/H-aware retrieval:
- Combines vertical, horizontal, custom filters
- Handles shorthand syntax (partitions, themes)
- Section pattern and level filtering

Tests: 48 passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: RAGQueryComposer Core

**Files:**
- Create: `packages/core/src/query/rag-query-composer.ts`
- Test: `packages/core/tests/query/rag-query-composer.test.ts`

**Step 1: Write test for RAGQueryComposer**

```bash
cat > packages/core/tests/query/rag-query-composer.test.ts << 'EOF'
import { describe, it, expect, beforeEach } from 'vitest';
import { RAGQueryComposer } from '../../src/query/rag-query-composer';
import type { VectorDBAdapter } from '../../src/adapters';
import type { Embedder } from '../../src/embedders';
import type { VectorRecord, SearchResult } from '../../src/types';
import type { UniversalFilter } from '../../src/filters';

// Mock adapter
class MockAdapter implements VectorDBAdapter {
  lastSearchParams: any = null;

  async connect() {}
  async disconnect() {}
  async isConnected() { return true; }
  async createCollection() {}
  async deleteCollection() {}
  async collectionExists() { return true; }
  async getCollectionStats() { return { vectorCount: 0, dimension: 384, metric: 'cosine' }; }
  async upsert() { return 0; }
  async fetch() { return []; }
  async delete() { return 0; }
  async updateMetadata() {}

  async search(
    collection: string,
    queryVector: number[],
    options: any
  ): Promise<SearchResult> {
    this.lastSearchParams = { collection, queryVector, options };
    return {
      records: [
        {
          id: 'test-1',
          embedding: queryVector,
          metadata: { text: 'test result' },
          score: 0.95
        }
      ]
    };
  }

  translateFilter(filter: UniversalFilter): any {
    return filter;
  }

  async *iterate() {}

  supportsMetadataUpdate() { return false; }
  supportsFiltering() { return true; }
  supportsBatchOperations() { return false; }
}

// Mock embedder
class MockEmbedder implements Embedder {
  dimension = 384;

  async embed(text: string): Promise<number[]> {
    return new Array(this.dimension).fill(0.1);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => this.embed(''));
  }
}

describe('RAGQueryComposer', () => {
  let adapter: MockAdapter;
  let embedder: MockEmbedder;
  let composer: RAGQueryComposer;

  beforeEach(() => {
    adapter = new MockAdapter();
    embedder = new MockEmbedder();
    composer = new RAGQueryComposer(adapter, embedder, 'test-collection');
  });

  describe('constructor', () => {
    it('should create composer with default collection', () => {
      expect(composer).toBeInstanceOf(RAGQueryComposer);
    });
  });

  describe('retrieve', () => {
    it('should perform basic retrieval', async () => {
      const result = await composer.retrieve({
        query: 'test query',
        topK: 10
      });

      expect(result.records).toHaveLength(1);
      expect(result.query).toBe('test query');
      expect(adapter.lastSearchParams.collection).toBe('test-collection');
    });

    it('should embed query text', async () => {
      await composer.retrieve({
        query: 'test query'
      });

      expect(adapter.lastSearchParams.queryVector).toHaveLength(384);
    });

    it('should apply vertical filters', async () => {
      await composer.retrieve({
        query: 'test',
        vertical: { region: 'ny' }
      });

      expect(adapter.lastSearchParams.options.filter).toEqual({
        field: 'region',
        op: 'eq',
        value: 'ny'
      });
    });

    it('should apply partition filter', async () => {
      await composer.retrieve({
        query: 'test',
        partitions: ['ny', 'ca']
      });

      const filter = adapter.lastSearchParams.options.filter;
      expect(filter.field).toBe('__v_partition');
      expect(filter.op).toBe('in');
    });

    it('should use specified collection', async () => {
      await composer.retrieve({
        query: 'test',
        collection: 'other-collection'
      });

      expect(adapter.lastSearchParams.collection).toBe('other-collection');
    });

    it('should pass topK parameter', async () => {
      await composer.retrieve({
        query: 'test',
        topK: 5
      });

      expect(adapter.lastSearchParams.options.topK).toBe(5);
    });
  });

  describe('retrieveVertical', () => {
    it('should retrieve with partition filter', async () => {
      const result = await composer.retrieveVertical(
        'test query',
        'ny'
      );

      expect(result.records).toHaveLength(1);
      const filter = adapter.lastSearchParams.options.filter;
      expect(filter.field).toBe('__v_partition');
    });

    it('should retrieve with document filter', async () => {
      const result = await composer.retrieveVertical(
        'test query',
        undefined,
        ['doc1', 'doc2']
      );

      const filter = adapter.lastSearchParams.options.filter;
      expect(filter.field).toBe('__v_doc_id');
    });
  });

  describe('retrieveHorizontal', () => {
    it('should retrieve with theme filter', async () => {
      const result = await composer.retrieveHorizontal(
        'test query',
        'pricing'
      );

      const filter = adapter.lastSearchParams.options.filter;
      expect(filter.field).toBe('__h_theme');
      expect(filter.value).toBe('pricing');
    });

    it('should retrieve with multiple themes', async () => {
      const result = await composer.retrieveHorizontal(
        'test query',
        undefined,
        ['pricing', 'coverage']
      );

      const filter = adapter.lastSearchParams.options.filter;
      expect(filter.field).toBe('__h_theme');
      expect(filter.op).toBe('in');
    });
  });
});
EOF
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npm test`
Expected: FAIL - Cannot find module '../../src/query/rag-query-composer'

**Step 3: Create RAGQueryComposer implementation**

```bash
cat > packages/core/src/query/rag-query-composer.ts << 'EOF'
import type { VectorDBAdapter } from '../adapters';
import type { Embedder } from '../embedders';
import type { UniversalFilter } from '../filters';
import type { RetrievalParams, RetrievalResult, SearchOptions } from './types';
import { FilterBuilder } from './filter-builder';

/**
 * Composes and executes queries with vertical/horizontal awareness.
 *
 * This is the main interface for retrieval operations in VectorORM.
 * Combines filter building, query embedding, and vector search.
 */
export class RAGQueryComposer {
  /**
   * Create a new query composer.
   *
   * @param adapter - Vector database adapter
   * @param embedder - Text embedding model
   * @param defaultCollection - Default collection for queries
   */
  constructor(
    private adapter: VectorDBAdapter,
    private embedder: Embedder,
    private defaultCollection?: string
  ) {}

  /**
   * Unified retrieval with vertical/horizontal support.
   *
   * @param params - Retrieval parameters
   * @returns Retrieval result with records and metadata
   */
  async retrieve(params: RetrievalParams): Promise<RetrievalResult> {
    // Determine collection
    const collection = params.collection || this.defaultCollection;
    if (!collection) {
      throw new Error('No collection specified and no default collection set');
    }

    // Build combined filter
    const filter = FilterBuilder.buildFilter(params);

    // Embed query
    const queryVector = await this.embedder.embed(params.query);

    // Build search options
    const searchOptions: SearchOptions = {
      topK: params.topK || 10,
      filter: filter || undefined,
      includeEmbeddings: params.includeEmbeddings || false
    };

    // Translate filter to native format
    const nativeFilter = filter ? this.adapter.translateFilter(filter) : undefined;

    // Execute search
    const searchResult = await this.adapter.search(
      collection,
      queryVector,
      {
        ...searchOptions,
        filter: nativeFilter
      }
    );

    // Build result
    return {
      records: searchResult.records,
      query: params.query,
      filtersApplied: filter ? this.filterToObject(filter) : {},
      totalCandidates: searchResult.totalCount
    };
  }

  /**
   * Convenience method for vertical-focused retrieval.
   *
   * @param query - Natural language query
   * @param partition - Partition to filter by
   * @param documents - Document IDs to filter by
   * @param options - Additional options
   * @returns Retrieval result
   */
  async retrieveVertical(
    query: string,
    partition?: string,
    documents?: string[],
    options?: Partial<RetrievalParams>
  ): Promise<RetrievalResult> {
    return this.retrieve({
      query,
      partitions: partition ? [partition] : undefined,
      documents,
      ...options
    });
  }

  /**
   * Convenience method for horizontal-focused retrieval.
   *
   * @param query - Natural language query
   * @param theme - Theme to filter by
   * @param themes - Multiple themes to filter by
   * @param options - Additional options
   * @returns Retrieval result
   */
  async retrieveHorizontal(
    query: string,
    theme?: string,
    themes?: string[],
    options?: Partial<RetrievalParams>
  ): Promise<RetrievalResult> {
    return this.retrieve({
      query,
      themes: themes || (theme ? [theme] : undefined),
      ...options
    });
  }

  /**
   * Convert filter to plain object for result metadata.
   */
  private filterToObject(filter: UniversalFilter): Record<string, any> {
    if ('and' in filter) {
      return { and: filter.and.map(f => this.filterToObject(f)) };
    }
    if ('or' in filter) {
      return { or: filter.or.map(f => this.filterToObject(f)) };
    }
    return { [filter.field]: filter.value };
  }
}
EOF
```

**Step 4: Update query index**

```bash
cat >> packages/core/src/query/index.ts << 'EOF'

export { RAGQueryComposer } from './rag-query-composer';
EOF
```

**Step 5: Run test to verify it passes**

Run: `cd packages/core && npm test`
Expected: PASS - 12 new tests (60 total)

**Step 6: Update main index**

```bash
cat >> packages/core/src/index.ts << 'EOF'

export { RAGQueryComposer, FilterBuilder } from './query';
EOF
```

**Step 7: Build and verify**

Run: `cd packages/core && npm run build && npm run lint`
Expected: Build successful

**Step 8: Commit**

```bash
git add packages/core/src/query/ packages/core/tests/query/ packages/core/src/index.ts
git commit -m "feat(query): add RAGQueryComposer for V/H-aware retrieval

Implement query composer:
- Unified retrieve() with V/H filter support
- retrieveVertical() convenience method
- retrieveHorizontal() convenience method
- Filter building and translation
- Query embedding integration

Tests: 60 passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

**Phase 2 Complete: Query Composition Layer**

✅ Task 1: Retrieval types and interfaces
✅ Task 2: Embedder abstraction
✅ Task 3: FilterBuilder utility
✅ Task 4: RAGQueryComposer core

**Test Coverage:** 60 tests passing
**New Components:**
- RetrievalParams, RetrievalResult types
- Embedder interface
- FilterBuilder for combining V/H filters
- RAGQueryComposer with retrieve(), retrieveVertical(), retrieveHorizontal()

**Next Steps:**
- Phase 3: Enrichment Pipeline
- Phase 4: First Concrete Adapter
- Phase 5: Document Ingestion Pipeline

---

**Plan complete and saved to `docs/plans/2026-02-05-query-composition-layer.md`.**
