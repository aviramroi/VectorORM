# Glyph Core Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the foundational core package (@glyph/core) with type system, adapter abstractions, filter language, and metadata schema.

**Architecture:** Monorepo using Turborepo with TypeScript strict mode. Abstract adapter pattern for DB agnosticism. Universal filter language that normalizes to standard format then translates to native DB syntax. Metadata schema with prefixed fields for V/H/S axes.

**Tech Stack:** TypeScript 5.3+, Turborepo, Vitest, TSup for building, Zod for validation

---

## Task 1: Initialize Monorepo Structure

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `.npmrc`

**Step 1: Create root package.json**

```bash
cat > package.json << 'EOF'
{
  "name": "glyph-monorepo",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev"
  },
  "devDependencies": {
    "turbo": "^1.12.0",
    "typescript": "^5.3.3"
  }
}
EOF
```

**Step 2: Create Turborepo config**

```bash
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false
    }
  }
}
EOF
```

**Step 3: Create core package.json**

```bash
mkdir -p packages/core
cat > packages/core/package.json << 'EOF'
{
  "name": "@glyph/core",
  "version": "0.1.0",
  "description": "Core abstractions for Glyph vectorORM",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.4",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^20.11.5",
    "tsup": "^8.0.1",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  },
  "keywords": [
    "vector",
    "orm",
    "rag",
    "embeddings",
    "vectordb"
  ],
  "license": "MIT"
}
EOF
```

**Step 4: Create TypeScript config**

```bash
cat > packages/core/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
EOF
```

**Step 5: Create Vitest config**

```bash
cat > packages/core/vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/dist/**', '**/node_modules/**']
    }
  }
});
EOF
```

**Step 6: Create tsup config**

```bash
cat > packages/core/tsup.config.ts << 'EOF'
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
EOF
```

**Step 7: Create .npmrc**

```bash
cat > .npmrc << 'EOF'
engine-strict=true
save-exact=true
EOF
```

**Step 8: Install dependencies**

Run: `npm install`
Expected: Dependencies installed, package-lock.json created

**Step 9: Verify structure**

Run: `tree -L 3 -I node_modules`
Expected:
```
.
├── package.json
├── turbo.json
├── .npmrc
└── packages
    └── core
        ├── package.json
        ├── tsconfig.json
        ├── vitest.config.ts
        └── tsup.config.ts
```

**Step 10: Commit**

```bash
git add package.json turbo.json .npmrc packages/core/
git commit -m "chore: initialize monorepo with Turborepo and core package

Set up:
- Turborepo for monorepo management
- @glyph/core package with TypeScript strict mode
- Vitest for testing
- TSup for building CJS/ESM bundles

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Core Types and Metadata Schema

**Files:**
- Create: `packages/core/src/types/index.ts`
- Create: `packages/core/src/types/vector-record.ts`
- Create: `packages/core/src/types/search-result.ts`
- Create: `packages/core/src/metadata/constants.ts`
- Create: `packages/core/src/metadata/fields.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/tests/types/vector-record.test.ts`
- Test: `packages/core/tests/metadata/constants.test.ts`

**Step 1: Write test for VectorRecord type**

```bash
mkdir -p packages/core/tests/types
cat > packages/core/tests/types/vector-record.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import type { VectorRecord } from '../../src/types/vector-record';

describe('VectorRecord', () => {
  it('should accept valid vector record', () => {
    const record: VectorRecord = {
      id: 'test-id',
      embedding: [0.1, 0.2, 0.3],
      metadata: {
        text: 'test text',
        custom: 'value'
      }
    };

    expect(record.id).toBe('test-id');
    expect(record.embedding).toHaveLength(3);
  });

  it('should accept optional fields', () => {
    const record: VectorRecord = {
      id: 'test-id',
      embedding: [0.1],
      metadata: {},
      text: 'optional text',
      score: 0.95
    };

    expect(record.text).toBe('optional text');
    expect(record.score).toBe(0.95);
  });
});
EOF
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npm test`
Expected: FAIL - Cannot find module '../../src/types/vector-record'

**Step 3: Create VectorRecord type**

```bash
mkdir -p packages/core/src/types
cat > packages/core/src/types/vector-record.ts << 'EOF'
/**
 * Represents a vector record in the database.
 *
 * This is the fundamental unit of storage in Glyph, containing:
 * - Unique identifier
 * - Embedding vector
 * - Metadata (including V/H/S fields)
 * - Optional text and score
 */
export interface VectorRecord {
  /** Unique identifier for this record */
  id: string;

  /** Embedding vector (dimensionality depends on embedding model) */
  embedding: number[];

  /**
   * Metadata fields including:
   * - Vertical fields (__v_*): Document-level metadata
   * - Horizontal fields (__h_*): Theme/section metadata
   * - Structural fields (__s_*): Position/hierarchy metadata
   * - Custom user fields
   */
  metadata: Record<string, any>;

  /** Optional text content of this chunk */
  text?: string;

  /** Optional similarity score (populated during search) */
  score?: number;
}
EOF
```

**Step 4: Create SearchResult type**

```bash
cat > packages/core/src/types/search-result.ts << 'EOF'
import type { VectorRecord } from './vector-record';

/**
 * Result from a vector search operation.
 */
export interface SearchResult {
  /** Matching vector records */
  records: VectorRecord[];

  /** Total count of matches (if available from DB) */
  totalCount?: number;

  /** Cursor for pagination (if supported by DB) */
  nextCursor?: string;
}
EOF
```

**Step 5: Create types index**

```bash
cat > packages/core/src/types/index.ts << 'EOF'
export type { VectorRecord } from './vector-record';
export type { SearchResult } from './search-result';
EOF
```

**Step 6: Run test to verify it passes**

Run: `cd packages/core && npm test`
Expected: PASS - 2 tests passing

**Step 7: Write test for metadata constants**

```bash
mkdir -p packages/core/tests/metadata
cat > packages/core/tests/metadata/constants.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import {
  METADATA_PREFIXES,
  VerticalFields,
  HorizontalFields,
  StructuralFields
} from '../../src/metadata/constants';

describe('Metadata Constants', () => {
  it('should define metadata prefixes', () => {
    expect(METADATA_PREFIXES.VERTICAL).toBe('__v_');
    expect(METADATA_PREFIXES.HORIZONTAL).toBe('__h_');
    expect(METADATA_PREFIXES.STRUCTURAL).toBe('__s_');
  });

  it('should define vertical fields', () => {
    expect(VerticalFields.DOC_ID).toBe('__v_doc_id');
    expect(VerticalFields.SOURCE).toBe('__v_source');
    expect(VerticalFields.PARTITION).toBe('__v_partition');
  });

  it('should define horizontal fields', () => {
    expect(HorizontalFields.THEME).toBe('__h_theme');
    expect(HorizontalFields.SECTION_PATH).toBe('__h_section_path');
  });

  it('should define structural fields', () => {
    expect(StructuralFields.CHUNK_INDEX).toBe('__s_chunk_index');
    expect(StructuralFields.TOTAL_CHUNKS).toBe('__s_total_chunks');
  });
});
EOF
```

**Step 8: Run test to verify it fails**

Run: `cd packages/core && npm test`
Expected: FAIL - Cannot find module '../../src/metadata/constants'

**Step 9: Create metadata constants**

```bash
mkdir -p packages/core/src/metadata
cat > packages/core/src/metadata/constants.ts << 'EOF'
/**
 * Metadata field prefixes for the three axes of Glyph's schema.
 *
 * These prefixes separate framework fields from user-defined metadata:
 * - __v_: Vertical axis (document identity)
 * - __h_: Horizontal axis (content/theme identity)
 * - __s_: Structural axis (position/hierarchy)
 */
export const METADATA_PREFIXES = {
  VERTICAL: '__v_',
  HORIZONTAL: '__h_',
  STRUCTURAL: '__s_',
} as const;

/**
 * Vertical axis fields - identify WHICH document a chunk belongs to.
 */
export const VerticalFields = {
  /** Unique document identifier */
  DOC_ID: '__v_doc_id',

  /** Original source path/URL */
  SOURCE: '__v_source',

  /** Logical partition key (for filtering by document subsets) */
  PARTITION: '__v_partition',

  /** Document type classification */
  DOC_TYPE: '__v_doc_type',

  /** Arbitrary vertical tags */
  TAGS: '__v_tags',
} as const;

/**
 * Horizontal axis fields - identify WHAT topic/theme a chunk covers.
 */
export const HorizontalFields = {
  /** Primary theme classification */
  THEME: '__h_theme',

  /** Multiple themes (if applicable) */
  THEMES: '__h_themes',

  /** Classification confidence score */
  THEME_CONFIDENCE: '__h_theme_confidence',

  /** Hierarchical section path (e.g., "Chapter 3/Pricing/Rates") */
  SECTION_PATH: '__h_section_path',

  /** Depth level in hierarchy (0 = root) */
  SECTION_LEVEL: '__h_section_level',

  /** Section header text */
  SECTION_TITLE: '__h_section_title',
} as const;

/**
 * Structural axis fields - track chunk position and relationships.
 */
export const StructuralFields = {
  /** Position in document (0-indexed) */
  CHUNK_INDEX: '__s_chunk_index',

  /** Parent chunk ID (for hierarchical chunking) */
  PARENT_ID: '__s_parent_id',

  /** Whether this chunk has children */
  HAS_CHILDREN: '__s_has_children',

  /** Total chunks in this document */
  TOTAL_CHUNKS: '__s_total_chunks',
} as const;
EOF
```

**Step 10: Create metadata fields helper types**

```bash
cat > packages/core/src/metadata/fields.ts << 'EOF'
/**
 * Type-safe metadata field names.
 *
 * Use these instead of string literals to get autocomplete and catch typos.
 */

/** Type for vertical field keys */
export type VerticalFieldKey =
  | 'docId'
  | 'source'
  | 'partition'
  | 'docType'
  | 'tags';

/** Type for horizontal field keys */
export type HorizontalFieldKey =
  | 'theme'
  | 'themes'
  | 'themeConfidence'
  | 'sectionPath'
  | 'sectionLevel'
  | 'sectionTitle';

/** Type for structural field keys */
export type StructuralFieldKey =
  | 'chunkIndex'
  | 'parentId'
  | 'hasChildren'
  | 'totalChunks';
EOF
```

**Step 11: Create metadata index**

```bash
cat > packages/core/src/metadata/index.ts << 'EOF'
export {
  METADATA_PREFIXES,
  VerticalFields,
  HorizontalFields,
  StructuralFields
} from './constants';

export type {
  VerticalFieldKey,
  HorizontalFieldKey,
  StructuralFieldKey
} from './fields';
EOF
```

**Step 12: Run test to verify it passes**

Run: `cd packages/core && npm test`
Expected: PASS - 6 tests passing

**Step 13: Create main index with exports**

```bash
cat > packages/core/src/index.ts << 'EOF'
// Types
export type { VectorRecord, SearchResult } from './types';

// Metadata
export {
  METADATA_PREFIXES,
  VerticalFields,
  HorizontalFields,
  StructuralFields
} from './metadata';

export type {
  VerticalFieldKey,
  HorizontalFieldKey,
  StructuralFieldKey
} from './metadata';
EOF
```

**Step 14: Build and verify exports**

Run: `cd packages/core && npm run build`
Expected: dist/ created with index.js, index.mjs, index.d.ts

**Step 15: Commit**

```bash
git add packages/core/src/ packages/core/tests/
git commit -m "feat(core): add core types and metadata schema

Implement:
- VectorRecord and SearchResult types
- Metadata field constants (V/H/S axes)
- Type-safe field name exports

Tests: 6 passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Universal Filter Language

**Files:**
- Create: `packages/core/src/filters/types.ts`
- Create: `packages/core/src/filters/translator.ts`
- Test: `packages/core/tests/filters/translator.test.ts`

**Step 1: Write test for filter types**

```bash
mkdir -p packages/core/tests/filters
cat > packages/core/tests/filters/translator.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { FilterTranslator } from '../../src/filters/translator';
import type { UniversalFilter, FilterCondition } from '../../src/filters/types';

describe('FilterTranslator', () => {
  describe('normalize', () => {
    it('should pass through standard format', () => {
      const filter: FilterCondition = {
        field: 'region',
        op: 'eq',
        value: 'ny'
      };

      const normalized = FilterTranslator.normalize(filter);
      expect(normalized).toEqual(filter);
    });

    it('should convert shorthand with implicit eq', () => {
      const shorthand = { region: 'ny' };
      const normalized = FilterTranslator.normalize(shorthand);

      expect(normalized).toEqual({
        field: 'region',
        op: 'eq',
        value: 'ny'
      });
    });

    it('should convert shorthand with operator suffix', () => {
      const shorthand = { year__gte: 2023 };
      const normalized = FilterTranslator.normalize(shorthand);

      expect(normalized).toEqual({
        field: 'year',
        op: 'gte',
        value: 2023
      });
    });

    it('should convert multiple shorthand fields to AND', () => {
      const shorthand = {
        region: 'ny',
        year__gte: 2023
      };
      const normalized = FilterTranslator.normalize(shorthand);

      expect(normalized).toEqual({
        and: [
          { field: 'region', op: 'eq', value: 'ny' },
          { field: 'year', op: 'gte', value: 2023 }
        ]
      });
    });

    it('should preserve compound filters', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'region', op: 'eq', value: 'ny' },
          { field: 'year', op: 'gte', value: 2023 }
        ]
      };

      const normalized = FilterTranslator.normalize(filter);
      expect(normalized).toEqual(filter);
    });
  });

  describe('validate', () => {
    it('should accept valid filter condition', () => {
      const filter: FilterCondition = {
        field: 'test',
        op: 'eq',
        value: 'value'
      };

      expect(() => FilterTranslator.validate(filter)).not.toThrow();
    });

    it('should accept valid AND filter', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'a', op: 'eq', value: 1 },
          { field: 'b', op: 'gt', value: 2 }
        ]
      };

      expect(() => FilterTranslator.validate(filter)).not.toThrow();
    });

    it('should reject invalid operator', () => {
      const filter = {
        field: 'test',
        op: 'invalid',
        value: 'value'
      } as any;

      expect(() => FilterTranslator.validate(filter)).toThrow();
    });

    it('should reject empty field name', () => {
      const filter = {
        field: '',
        op: 'eq',
        value: 'value'
      } as FilterCondition;

      expect(() => FilterTranslator.validate(filter)).toThrow();
    });
  });

  describe('isCompound', () => {
    it('should return true for AND filter', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'test', op: 'eq', value: 1 }
        ]
      };

      expect(FilterTranslator.isCompound(filter)).toBe(true);
    });

    it('should return true for OR filter', () => {
      const filter: UniversalFilter = {
        or: [
          { field: 'test', op: 'eq', value: 1 }
        ]
      };

      expect(FilterTranslator.isCompound(filter)).toBe(true);
    });

    it('should return false for simple condition', () => {
      const filter: FilterCondition = {
        field: 'test',
        op: 'eq',
        value: 1
      };

      expect(FilterTranslator.isCompound(filter)).toBe(false);
    });
  });
});
EOF
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npm test`
Expected: FAIL - Cannot find module '../../src/filters/types'

**Step 3: Create filter types**

```bash
mkdir -p packages/core/src/filters
cat > packages/core/src/filters/types.ts << 'EOF'
/**
 * Universal filter language for database-agnostic queries.
 *
 * Filters are expressed in a standard format, then translated
 * to native database syntax by each adapter.
 */

/**
 * Supported filter operators.
 */
export type FilterOperator =
  | 'eq'       // Equals
  | 'neq'      // Not equals
  | 'in'       // In list
  | 'nin'      // Not in list
  | 'gt'       // Greater than
  | 'gte'      // Greater than or equal
  | 'lt'       // Less than
  | 'lte'      // Less than or equal
  | 'contains' // Contains substring
  | 'exists';  // Field exists

/**
 * Basic filter condition.
 */
export interface FilterCondition {
  field: string;
  op: FilterOperator;
  value: any;
}

/**
 * Compound AND filter (all conditions must match).
 */
export interface AndFilter {
  and: UniversalFilter[];
}

/**
 * Compound OR filter (any condition must match).
 */
export interface OrFilter {
  or: UniversalFilter[];
}

/**
 * Universal filter - can be a simple condition or compound.
 */
export type UniversalFilter = FilterCondition | AndFilter | OrFilter;

/**
 * Shorthand filter format (user-friendly).
 *
 * Examples:
 * - {region: "ny"} → {field: "region", op: "eq", value: "ny"}
 * - {year__gte: 2023} → {field: "year", op: "gte", value: 2023}
 * - {region: "ny", year__gte: 2023} → {and: [...]}
 */
export type ShorthandFilter = Record<string, any>;
EOF
```

**Step 4: Create FilterTranslator implementation**

```bash
cat > packages/core/src/filters/translator.ts << 'EOF'
import type {
  UniversalFilter,
  FilterCondition,
  AndFilter,
  OrFilter,
  ShorthandFilter,
  FilterOperator
} from './types';

/**
 * Valid filter operators.
 */
const VALID_OPERATORS: FilterOperator[] = [
  'eq', 'neq', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists'
];

/**
 * Translates filters between formats and validates structure.
 */
export class FilterTranslator {
  /**
   * Normalize any filter input to standard UniversalFilter format.
   *
   * Handles:
   * - Standard format (pass through)
   * - Shorthand format (convert to standard)
   * - Operator suffixes (field__op syntax)
   */
  static normalize(input: ShorthandFilter | UniversalFilter): UniversalFilter {
    // Already standard format
    if (this.isStandardFormat(input)) {
      return input as UniversalFilter;
    }

    // Convert shorthand
    return this.fromShorthand(input as ShorthandFilter);
  }

  /**
   * Validate filter structure and operators.
   *
   * Throws error if filter is invalid.
   */
  static validate(filter: UniversalFilter): void {
    if (this.isCompound(filter)) {
      const compound = filter as AndFilter | OrFilter;
      const conditions = 'and' in compound ? compound.and : compound.or;

      if (!Array.isArray(conditions) || conditions.length === 0) {
        throw new Error('Compound filter must have at least one condition');
      }

      conditions.forEach(c => this.validate(c));
    } else {
      const condition = filter as FilterCondition;

      if (!condition.field || typeof condition.field !== 'string') {
        throw new Error('Filter field must be a non-empty string');
      }

      if (!VALID_OPERATORS.includes(condition.op)) {
        throw new Error(`Invalid filter operator: ${condition.op}`);
      }

      if (condition.value === undefined) {
        throw new Error('Filter value is required');
      }
    }
  }

  /**
   * Check if filter is compound (AND/OR).
   */
  static isCompound(filter: UniversalFilter): boolean {
    return 'and' in filter || 'or' in filter;
  }

  /**
   * Check if input is already in standard format.
   */
  private static isStandardFormat(input: any): boolean {
    if (!input || typeof input !== 'object') {
      return false;
    }

    // Check for compound filter
    if ('and' in input || 'or' in input) {
      return true;
    }

    // Check for filter condition
    if ('field' in input && 'op' in input && 'value' in input) {
      return true;
    }

    return false;
  }

  /**
   * Convert shorthand format to standard.
   */
  private static fromShorthand(shorthand: ShorthandFilter): UniversalFilter {
    const conditions: FilterCondition[] = [];

    for (const [key, value] of Object.entries(shorthand)) {
      // Parse field__op syntax
      let field: string;
      let op: FilterOperator;

      if (key.includes('__') && !key.startsWith('__')) {
        // Has operator suffix
        const lastIndex = key.lastIndexOf('__');
        field = key.substring(0, lastIndex);
        op = key.substring(lastIndex + 2) as FilterOperator;
      } else {
        // Implicit eq
        field = key;
        op = 'eq';
      }

      conditions.push({ field, op, value });
    }

    // Single condition - return as-is
    if (conditions.length === 1) {
      return conditions[0];
    }

    // Multiple conditions - wrap in AND
    return { and: conditions };
  }
}
EOF
```

**Step 5: Create filters index**

```bash
cat > packages/core/src/filters/index.ts << 'EOF'
export type {
  FilterOperator,
  FilterCondition,
  AndFilter,
  OrFilter,
  UniversalFilter,
  ShorthandFilter
} from './types';

export { FilterTranslator } from './translator';
EOF
```

**Step 6: Run tests to verify they pass**

Run: `cd packages/core && npm test`
Expected: PASS - All filter tests passing (11 tests total)

**Step 7: Update main index**

```bash
cat >> packages/core/src/index.ts << 'EOF'

// Filters
export type {
  FilterOperator,
  FilterCondition,
  AndFilter,
  OrFilter,
  UniversalFilter,
  ShorthandFilter
} from './filters';

export { FilterTranslator } from './filters';
EOF
```

**Step 8: Build and verify**

Run: `cd packages/core && npm run build && npm run lint`
Expected: Build successful, no TypeScript errors

**Step 9: Commit**

```bash
git add packages/core/src/filters/ packages/core/tests/filters/
git commit -m "feat(core): add universal filter language

Implement:
- Filter types (condition, AND, OR)
- FilterTranslator for normalization and validation
- Shorthand syntax support (field__op)

Tests: 11 passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Metadata Builder

**Files:**
- Create: `packages/core/src/metadata/builder.ts`
- Test: `packages/core/tests/metadata/builder.test.ts`

**Step 1: Write test for MetadataBuilder**

```bash
cat > packages/core/tests/metadata/builder.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { MetadataBuilder } from '../../src/metadata/builder';
import { VerticalFields, HorizontalFields, StructuralFields } from '../../src/metadata/constants';

describe('MetadataBuilder', () => {
  it('should build vertical metadata', () => {
    const meta = new MetadataBuilder()
      .vertical({
        docId: 'doc-123',
        source: '/path/to/doc.pdf',
        partition: 'ny'
      })
      .build();

    expect(meta[VerticalFields.DOC_ID]).toBe('doc-123');
    expect(meta[VerticalFields.SOURCE]).toBe('/path/to/doc.pdf');
    expect(meta[VerticalFields.PARTITION]).toBe('ny');
  });

  it('should build horizontal metadata', () => {
    const meta = new MetadataBuilder()
      .horizontal({
        theme: 'pricing',
        themeConfidence: 0.95,
        sectionPath: 'Chapter 3/Pricing'
      })
      .build();

    expect(meta[HorizontalFields.THEME]).toBe('pricing');
    expect(meta[HorizontalFields.THEME_CONFIDENCE]).toBe(0.95);
    expect(meta[HorizontalFields.SECTION_PATH]).toBe('Chapter 3/Pricing');
  });

  it('should build structural metadata', () => {
    const meta = new MetadataBuilder()
      .structural({
        chunkIndex: 5,
        totalChunks: 20,
        hasChildren: false
      })
      .build();

    expect(meta[StructuralFields.CHUNK_INDEX]).toBe(5);
    expect(meta[StructuralFields.TOTAL_CHUNKS]).toBe(20);
    expect(meta[StructuralFields.HAS_CHILDREN]).toBe(false);
  });

  it('should add custom metadata', () => {
    const meta = new MetadataBuilder()
      .custom('region', 'ny')
      .custom('year', 2024)
      .build();

    expect(meta.region).toBe('ny');
    expect(meta.year).toBe(2024);
  });

  it('should chain multiple metadata types', () => {
    const meta = new MetadataBuilder()
      .vertical({ docId: 'doc-123', source: 'test.pdf' })
      .horizontal({ theme: 'pricing' })
      .structural({ chunkIndex: 0 })
      .custom('company', 'Acme')
      .build();

    expect(meta[VerticalFields.DOC_ID]).toBe('doc-123');
    expect(meta[HorizontalFields.THEME]).toBe('pricing');
    expect(meta[StructuralFields.CHUNK_INDEX]).toBe(0);
    expect(meta.company).toBe('Acme');
  });

  it('should handle array fields', () => {
    const meta = new MetadataBuilder()
      .vertical({ tags: ['active', 'retail'] })
      .horizontal({ themes: ['pricing', 'coverage'] })
      .build();

    expect(meta[VerticalFields.TAGS]).toEqual(['active', 'retail']);
    expect(meta[HorizontalFields.THEMES]).toEqual(['pricing', 'coverage']);
  });

  it('should skip undefined values', () => {
    const meta = new MetadataBuilder()
      .vertical({ docId: 'doc-123', source: undefined })
      .build();

    expect(meta[VerticalFields.DOC_ID]).toBe('doc-123');
    expect(meta[VerticalFields.SOURCE]).toBeUndefined();
  });
});
EOF
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npm test`
Expected: FAIL - Cannot find module '../../src/metadata/builder'

**Step 3: Create MetadataBuilder implementation**

```bash
cat > packages/core/src/metadata/builder.ts << 'EOF'
import { VerticalFields, HorizontalFields, StructuralFields } from './constants';
import type { VerticalFieldKey, HorizontalFieldKey, StructuralFieldKey } from './fields';

/**
 * Type-safe builder for constructing metadata objects.
 *
 * Provides fluent API for adding vertical, horizontal, structural,
 * and custom metadata fields.
 *
 * @example
 * ```typescript
 * const metadata = new MetadataBuilder()
 *   .vertical({ docId: 'doc-123', source: 'test.pdf' })
 *   .horizontal({ theme: 'pricing' })
 *   .custom('company', 'Acme')
 *   .build();
 * ```
 */
export class MetadataBuilder {
  private metadata: Record<string, any> = {};

  /**
   * Add vertical metadata (document-level).
   */
  vertical(data: {
    docId?: string;
    source?: string;
    partition?: string;
    docType?: string;
    tags?: string[];
  }): this {
    if (data.docId !== undefined) {
      this.metadata[VerticalFields.DOC_ID] = data.docId;
    }
    if (data.source !== undefined) {
      this.metadata[VerticalFields.SOURCE] = data.source;
    }
    if (data.partition !== undefined) {
      this.metadata[VerticalFields.PARTITION] = data.partition;
    }
    if (data.docType !== undefined) {
      this.metadata[VerticalFields.DOC_TYPE] = data.docType;
    }
    if (data.tags !== undefined) {
      this.metadata[VerticalFields.TAGS] = data.tags;
    }
    return this;
  }

  /**
   * Add horizontal metadata (theme/section-level).
   */
  horizontal(data: {
    theme?: string;
    themes?: string[];
    themeConfidence?: number;
    sectionPath?: string;
    sectionLevel?: number;
    sectionTitle?: string;
  }): this {
    if (data.theme !== undefined) {
      this.metadata[HorizontalFields.THEME] = data.theme;
    }
    if (data.themes !== undefined) {
      this.metadata[HorizontalFields.THEMES] = data.themes;
    }
    if (data.themeConfidence !== undefined) {
      this.metadata[HorizontalFields.THEME_CONFIDENCE] = data.themeConfidence;
    }
    if (data.sectionPath !== undefined) {
      this.metadata[HorizontalFields.SECTION_PATH] = data.sectionPath;
    }
    if (data.sectionLevel !== undefined) {
      this.metadata[HorizontalFields.SECTION_LEVEL] = data.sectionLevel;
    }
    if (data.sectionTitle !== undefined) {
      this.metadata[HorizontalFields.SECTION_TITLE] = data.sectionTitle;
    }
    return this;
  }

  /**
   * Add structural metadata (position/hierarchy).
   */
  structural(data: {
    chunkIndex?: number;
    parentId?: string;
    hasChildren?: boolean;
    totalChunks?: number;
  }): this {
    if (data.chunkIndex !== undefined) {
      this.metadata[StructuralFields.CHUNK_INDEX] = data.chunkIndex;
    }
    if (data.parentId !== undefined) {
      this.metadata[StructuralFields.PARENT_ID] = data.parentId;
    }
    if (data.hasChildren !== undefined) {
      this.metadata[StructuralFields.HAS_CHILDREN] = data.hasChildren;
    }
    if (data.totalChunks !== undefined) {
      this.metadata[StructuralFields.TOTAL_CHUNKS] = data.totalChunks;
    }
    return this;
  }

  /**
   * Add custom user-defined metadata field.
   */
  custom(key: string, value: any): this {
    this.metadata[key] = value;
    return this;
  }

  /**
   * Build and return the metadata object.
   */
  build(): Record<string, any> {
    return { ...this.metadata };
  }
}
EOF
```

**Step 4: Update metadata index**

```bash
cat >> packages/core/src/metadata/index.ts << 'EOF'

export { MetadataBuilder } from './builder';
EOF
```

**Step 5: Run tests to verify they pass**

Run: `cd packages/core && npm test`
Expected: PASS - All MetadataBuilder tests passing (7 tests, 18 total)

**Step 6: Update main index**

```bash
cat >> packages/core/src/index.ts << 'EOF'

export { MetadataBuilder } from './metadata';
EOF
```

**Step 7: Build and verify**

Run: `cd packages/core && npm run build && npm run lint`
Expected: Build successful, no errors

**Step 8: Commit**

```bash
git add packages/core/src/metadata/ packages/core/tests/metadata/
git commit -m "feat(core): add MetadataBuilder for type-safe metadata construction

Implement fluent builder API for:
- Vertical metadata (document-level)
- Horizontal metadata (theme/section-level)
- Structural metadata (position/hierarchy)
- Custom user fields

Tests: 18 passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: VectorDBAdapter Abstract Class

**Files:**
- Create: `packages/core/src/adapters/vector-db-adapter.ts`
- Create: `packages/core/src/adapters/types.ts`
- Test: `packages/core/tests/adapters/vector-db-adapter.test.ts`

**Step 1: Write test for adapter types**

```bash
mkdir -p packages/core/tests/adapters
cat > packages/core/tests/adapters/vector-db-adapter.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { VectorDBAdapter } from '../../src/adapters/vector-db-adapter';
import type { VectorRecord, SearchResult } from '../../src/types';
import type { UniversalFilter } from '../../src/filters';

// Mock adapter for testing
class MockAdapter extends VectorDBAdapter {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async healthCheck(): Promise<boolean> { return true; }

  async createCollection(): Promise<void> {}
  async deleteCollection(): Promise<void> {}
  async listCollections(): Promise<string[]> { return []; }
  async collectionExists(): Promise<boolean> { return true; }
  async getCollectionStats(): Promise<any> { return {}; }

  async upsert(): Promise<number> { return 0; }
  async fetchByIds(): Promise<VectorRecord[]> { return []; }
  async deleteByIds(): Promise<number> { return 0; }
  async deleteByFilter(): Promise<number> { return 0; }

  async updateMetadata(): Promise<void> {}
  async batchUpdateMetadata(): Promise<number> { return 0; }

  async search(): Promise<SearchResult> {
    return { records: [] };
  }

  translateFilter(filter: UniversalFilter): any {
    return filter;
  }

  async *listAllIds(): AsyncIterableIterator<string> {}
  async *iterateAll(): AsyncIterableIterator<VectorRecord[]> {}
}

describe('VectorDBAdapter', () => {
  it('should be instantiable as abstract class', () => {
    const adapter = new MockAdapter();
    expect(adapter).toBeInstanceOf(VectorDBAdapter);
  });

  it('should have default capability flags', () => {
    const adapter = new MockAdapter();

    expect(adapter.supportsNamespaces()).toBe(false);
    expect(adapter.supportsHybridSearch()).toBe(false);
    expect(adapter.supportsMetadataIndexing()).toBe(true);
    expect(adapter.maxBatchSize()).toBe(100);
    expect(adapter.maxMetadataSize()).toBeNull();
  });

  it('should allow overriding capability flags', () => {
    class CustomAdapter extends MockAdapter {
      supportsNamespaces() { return true; }
      maxBatchSize() { return 500; }
    }

    const adapter = new CustomAdapter();
    expect(adapter.supportsNamespaces()).toBe(true);
    expect(adapter.maxBatchSize()).toBe(500);
  });
});
EOF
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npm test`
Expected: FAIL - Cannot find module '../../src/adapters/vector-db-adapter'

**Step 3: Create adapter types**

```bash
mkdir -p packages/core/src/adapters
cat > packages/core/src/adapters/types.ts << 'EOF'
/**
 * Collection statistics returned by getCollectionStats.
 */
export interface CollectionStats {
  /** Number of vectors in collection */
  vectorCount: number;

  /** Dimension of vectors */
  dimension: number;

  /** Distance metric used */
  metric: string;

  /** Additional DB-specific stats */
  [key: string]: any;
}

/**
 * Metadata update for batch operations.
 */
export interface MetadataUpdate {
  /** Vector ID to update */
  id: string;

  /** Metadata to set */
  metadata: Record<string, any>;
}

/**
 * Distance metric for vector similarity.
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'dot_product';
EOF
```

**Step 4: Create VectorDBAdapter abstract class**

```bash
cat > packages/core/src/adapters/vector-db-adapter.ts << 'EOF'
import type { VectorRecord, SearchResult } from '../types';
import type { UniversalFilter } from '../filters';
import type { CollectionStats, MetadataUpdate, DistanceMetric } from './types';

/**
 * Abstract base class for vector database adapters.
 *
 * All adapters must implement these methods to ensure compatibility
 * with the Glyph abstraction layer.
 *
 * This enables database-agnostic operations - write once, run on any vector DB.
 */
export abstract class VectorDBAdapter {
  // ══════════════════════════════════════════════════════════════
  // CONNECTION MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  /**
   * Establish connection to the vector database.
   *
   * @param credentials - DB-specific connection parameters
   */
  abstract connect(credentials: Record<string, any>): Promise<void>;

  /**
   * Close connection and release resources.
   */
  abstract disconnect(): Promise<void>;

  /**
   * Verify connection is healthy.
   *
   * @returns true if connection is working
   */
  abstract healthCheck(): Promise<boolean>;

  // ══════════════════════════════════════════════════════════════
  // COLLECTION MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  /**
   * Create a new collection/index.
   *
   * @param name - Collection name
   * @param dimension - Vector dimension
   * @param metric - Distance metric (default: cosine)
   */
  abstract createCollection(
    name: string,
    dimension: number,
    metric?: DistanceMetric
  ): Promise<void>;

  /**
   * Delete a collection.
   *
   * @param name - Collection name
   */
  abstract deleteCollection(name: string): Promise<void>;

  /**
   * List all collections.
   *
   * @returns Array of collection names
   */
  abstract listCollections(): Promise<string[]>;

  /**
   * Check if collection exists.
   *
   * @param name - Collection name
   * @returns true if collection exists
   */
  abstract collectionExists(name: string): Promise<boolean>;

  /**
   * Get collection statistics.
   *
   * @param name - Collection name
   * @returns Collection stats (count, dimension, etc.)
   */
  abstract getCollectionStats(name: string): Promise<CollectionStats>;

  // ══════════════════════════════════════════════════════════════
  // VECTOR OPERATIONS (CRUD)
  // ══════════════════════════════════════════════════════════════

  /**
   * Insert or update vectors.
   *
   * @param collection - Collection name
   * @param records - Vector records to upsert
   * @returns Number of records upserted
   */
  abstract upsert(
    collection: string,
    records: VectorRecord[]
  ): Promise<number>;

  /**
   * Retrieve vectors by ID.
   *
   * @param collection - Collection name
   * @param ids - Vector IDs to fetch
   * @param includeEmbeddings - Whether to include embeddings
   * @returns Matching vector records
   */
  abstract fetchByIds(
    collection: string,
    ids: string[],
    includeEmbeddings?: boolean
  ): Promise<VectorRecord[]>;

  /**
   * Delete vectors by ID.
   *
   * @param collection - Collection name
   * @param ids - Vector IDs to delete
   * @returns Number of records deleted
   */
  abstract deleteByIds(
    collection: string,
    ids: string[]
  ): Promise<number>;

  /**
   * Delete vectors matching filter.
   *
   * @param collection - Collection name
   * @param filter - Filter in universal format
   * @returns Number of records deleted
   */
  abstract deleteByFilter(
    collection: string,
    filter: UniversalFilter
  ): Promise<number>;

  // ══════════════════════════════════════════════════════════════
  // METADATA OPERATIONS (Critical for Enrichment)
  // ══════════════════════════════════════════════════════════════

  /**
   * Update metadata for a single vector.
   *
   * @param collection - Collection name
   * @param id - Vector ID
   * @param metadata - Metadata to set
   * @param merge - If true, merge with existing. If false, replace.
   */
  abstract updateMetadata(
    collection: string,
    id: string,
    metadata: Record<string, any>,
    merge?: boolean
  ): Promise<void>;

  /**
   * Batch update metadata for multiple vectors.
   *
   * Critical for enrichment pipeline performance.
   *
   * @param collection - Collection name
   * @param updates - Array of {id, metadata} updates
   * @returns Number of records updated
   */
  abstract batchUpdateMetadata(
    collection: string,
    updates: MetadataUpdate[]
  ): Promise<number>;

  // ══════════════════════════════════════════════════════════════
  // SEARCH OPERATIONS
  // ══════════════════════════════════════════════════════════════

  /**
   * Execute similarity search with optional filtering.
   *
   * @param collection - Collection name
   * @param queryVector - Query embedding
   * @param topK - Number of results to return
   * @param filter - Native filter format (use translateFilter first)
   * @param includeEmbeddings - Whether to include embeddings in results
   * @returns Search results with scores
   */
  abstract search(
    collection: string,
    queryVector: number[],
    topK: number,
    filter?: any,
    includeEmbeddings?: boolean
  ): Promise<SearchResult>;

  // ══════════════════════════════════════════════════════════════
  // FILTER TRANSLATION (Critical for DB Agnosticism)
  // ══════════════════════════════════════════════════════════════

  /**
   * Convert universal filter format to DB-native syntax.
   *
   * This is the KEY method for database agnosticism.
   * Each adapter implements its own translation logic.
   *
   * @param universalFilter - Filter in universal format
   * @returns DB-native filter object
   */
  abstract translateFilter(universalFilter: UniversalFilter): any;

  // ══════════════════════════════════════════════════════════════
  // ITERATION (For Enrichment Pipeline)
  // ══════════════════════════════════════════════════════════════

  /**
   * Iterate through all vector IDs in collection.
   *
   * Used by enrichment pipeline to process existing data.
   *
   * @param collection - Collection name
   * @param filter - Optional filter in universal format
   * @param batchSize - IDs per batch
   * @yields Batches of vector IDs
   */
  abstract listAllIds(
    collection: string,
    filter?: UniversalFilter,
    batchSize?: number
  ): AsyncIterableIterator<string>;

  /**
   * Iterate through all vectors in batches.
   *
   * Used for bulk operations and migrations.
   *
   * @param collection - Collection name
   * @param filter - Optional filter in universal format
   * @param batchSize - Records per batch
   * @param includeEmbeddings - Whether to include embeddings
   * @yields Batches of vector records
   */
  abstract iterateAll(
    collection: string,
    filter?: UniversalFilter,
    batchSize?: number,
    includeEmbeddings?: boolean
  ): AsyncIterableIterator<VectorRecord[]>;

  // ══════════════════════════════════════════════════════════════
  // CAPABILITY FLAGS
  // ══════════════════════════════════════════════════════════════

  /**
   * Whether DB supports namespaces/partitions natively.
   */
  supportsNamespaces(): boolean {
    return false;
  }

  /**
   * Whether DB supports hybrid vector + keyword search.
   */
  supportsHybridSearch(): boolean {
    return false;
  }

  /**
   * Whether DB supports indexing on metadata fields.
   */
  supportsMetadataIndexing(): boolean {
    return true;
  }

  /**
   * Maximum metadata size in bytes, null if unlimited.
   */
  maxMetadataSize(): number | null {
    return null;
  }

  /**
   * Maximum records per batch operation.
   */
  maxBatchSize(): number {
    return 100;
  }
}
EOF
```

**Step 5: Create adapters index**

```bash
cat > packages/core/src/adapters/index.ts << 'EOF'
export { VectorDBAdapter } from './vector-db-adapter';
export type { CollectionStats, MetadataUpdate, DistanceMetric } from './types';
EOF
```

**Step 6: Run tests to verify they pass**

Run: `cd packages/core && npm test`
Expected: PASS - All adapter tests passing (3 tests, 21 total)

**Step 7: Update main index**

```bash
cat >> packages/core/src/index.ts << 'EOF'

// Adapters
export { VectorDBAdapter } from './adapters';
export type { CollectionStats, MetadataUpdate, DistanceMetric } from './adapters';
EOF
```

**Step 8: Build and verify**

Run: `cd packages/core && npm run build && npm run lint`
Expected: Build successful, no errors

**Step 9: Commit**

```bash
git add packages/core/src/adapters/ packages/core/tests/adapters/
git commit -m "feat(core): add VectorDBAdapter abstract class

Implement abstract base class for vector database adapters:
- Connection management
- Collection CRUD operations
- Vector operations (upsert, fetch, delete)
- Metadata operations (critical for enrichment)
- Search with filtering
- Filter translation hook
- Iteration for batch operations
- Capability flags

Tests: 21 passing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

**Phase 1 Complete: Core Foundation**

✅ Monorepo structure with Turborepo
✅ Core type system (VectorRecord, SearchResult)
✅ Metadata schema with V/H/S axes
✅ Universal filter language with normalization
✅ MetadataBuilder for type-safe construction
✅ VectorDBAdapter abstract class

**Test Coverage:** 21 tests passing
**Build:** All packages building successfully
**Type Safety:** TypeScript strict mode, no errors

**Next Steps:**
- Task 6-10: Query composition layer
- Task 11-15: Enrichment pipeline
- Task 16-20: First adapter (Pinecone)
- Task 21+: Additional components

---

**Plan complete and saved to `docs/plans/2026-02-05-core-foundation.md`.**
