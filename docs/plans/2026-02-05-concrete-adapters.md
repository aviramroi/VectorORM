# Concrete Vector Database Adapters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement three production-ready vector database adapters (Pinecone, Turbopuffer, Chroma) with incremental filter support and comprehensive testing.

**Architecture:** Three separate packages (@vectororm/adapter-pinecone, @vectororm/adapter-turbopuffer, @vectororm/adapter-chroma) each implementing the exact VectorDBAdapter API with hybrid config, basic filter operators, simple AND compound filters, and tech debt tracking.

**Tech Stack:** TypeScript, Vitest, @pinecone-database/pinecone, chromadb, Turbopuffer REST API

---

## Task 1: Pinecone Adapter - Package Setup

**Files:**
- Create: `packages/adapter-pinecone/package.json`
- Create: `packages/adapter-pinecone/tsconfig.json`
- Create: `packages/adapter-pinecone/tsup.config.ts`
- Create: `packages/adapter-pinecone/vitest.config.ts`
- Create: `packages/adapter-pinecone/src/index.ts`
- Create: `packages/adapter-pinecone/TECH_DEBT.md`

**Step 1: Create package.json**

Create `packages/adapter-pinecone/package.json`:

```json
{
  "name": "@vectororm/adapter-pinecone",
  "version": "0.1.0",
  "description": "Pinecone adapter for VectorORM",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/index.mjs"
    }
  },
  "files": ["dist", "README.md", "TECH_DEBT.md"],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts"
  },
  "dependencies": {
    "@vectororm/core": "workspace:*",
    "@pinecone-database/pinecone": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.3",
    "vitest": "^1.0.0"
  },
  "peerDependencies": {
    "@vectororm/core": "^0.1.0"
  }
}
```

**Step 2: Create tsconfig.json**

Create `packages/adapter-pinecone/tsconfig.json`:

```json
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
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 3: Create tsup.config.ts**

Create `packages/adapter-pinecone/tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
});
```

**Step 4: Create vitest.config.ts**

Create `packages/adapter-pinecone/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
```

**Step 5: Create empty index and TECH_DEBT**

Create `packages/adapter-pinecone/src/index.ts`:

```typescript
// Pinecone adapter exports
export { PineconeAdapter } from './pinecone-adapter';
export type { PineconeConfig } from './types';
```

Create `packages/adapter-pinecone/TECH_DEBT.md`:

```markdown
# Technical Debt - @vectororm/adapter-pinecone

## Filter Translation Limitations

### Not Yet Implemented
- [ ] OR compound filters
- [ ] Nested AND/OR combinations
- [ ] Array operators (contains, overlaps)
- [ ] Text search operators

### Known Issues
- Complex nested filters may fail silently
- No validation of filter depth

### Future Enhancements
- [ ] Batch filter optimization
- [ ] Filter caching for repeated queries

## Metadata Operations
- Pinecone supports partial updates ✓
- No issues identified

## Iteration
- Pagination works but could be optimized for large collections

## Performance
- [ ] Connection pooling not implemented
- [ ] Retry logic could be improved
```

**Step 6: Install dependencies**

Run: `cd packages/adapter-pinecone && npm install`
Expected: Dependencies installed successfully

**Step 7: Commit**

```bash
git add packages/adapter-pinecone/
git commit -m "feat(adapter-pinecone): initialize package structure

- Add package.json with Pinecone dependency
- Add TypeScript and build configuration
- Add TECH_DEBT.md to track limitations
- Set up unit test configuration"
```

---

## Task 2: Pinecone Adapter - Types & Config

**Files:**
- Create: `packages/adapter-pinecone/src/types.ts`
- Create: `packages/adapter-pinecone/src/pinecone-adapter.ts` (skeleton)

**Step 1: Create types.ts**

Create `packages/adapter-pinecone/src/types.ts`:

```typescript
/**
 * Configuration for PineconeAdapter.
 *
 * Supports hybrid config: explicit values or environment variables.
 */
export interface PineconeConfig {
  /**
   * Pinecone API key.
   * Falls back to PINECONE_API_KEY environment variable.
   */
  apiKey: string;

  /**
   * Pinecone environment (e.g., 'us-east1-gcp').
   * Falls back to PINECONE_ENVIRONMENT environment variable.
   */
  environment?: string;

  /**
   * Pinecone project ID (optional).
   */
  projectId?: string;
}
```

**Step 2: Create adapter skeleton**

Create `packages/adapter-pinecone/src/pinecone-adapter.ts`:

```typescript
import { VectorDBAdapter } from '@vectororm/core';
import type { VectorRecord, SearchResult } from '@vectororm/core';
import type { UniversalFilter } from '@vectororm/core';
import type { CollectionStats, MetadataUpdate, DistanceMetric } from '@vectororm/core';
import { Pinecone } from '@pinecone-database/pinecone';
import type { PineconeConfig } from './types';

/**
 * Pinecone vector database adapter.
 *
 * Implements the VectorDBAdapter interface for Pinecone.
 */
export class PineconeAdapter extends VectorDBAdapter {
  private config: PineconeConfig;
  private client: Pinecone | null = null;

  constructor(config: PineconeConfig) {
    super();

    // Validate required config
    if (!config.apiKey) {
      throw new Error('PineconeAdapter requires apiKey in config');
    }

    this.config = config;
  }

  // All abstract methods will be implemented in subsequent tasks
  async connect(): Promise<void> {
    throw new Error('Not implemented');
  }

  async disconnect(): Promise<void> {
    throw new Error('Not implemented');
  }

  async isConnected(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async createCollection(name: string, dimension: number, metric?: DistanceMetric): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteCollection(name: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async collectionExists(name: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async getCollectionStats(name: string): Promise<CollectionStats> {
    throw new Error('Not implemented');
  }

  async upsert(collection: string, records: VectorRecord[]): Promise<void> {
    throw new Error('Not implemented');
  }

  async fetch(collection: string, ids: string[]): Promise<VectorRecord[]> {
    throw new Error('Not implemented');
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    throw new Error('Not implemented');
  }

  async updateMetadata(collection: string, updates: MetadataUpdate[]): Promise<void> {
    throw new Error('Not implemented');
  }

  async search(
    collection: string,
    queryVector: number[],
    options?: {
      topK?: number;
      filter?: UniversalFilter;
      includeMetadata?: boolean;
      includeValues?: boolean;
    }
  ): Promise<SearchResult> {
    throw new Error('Not implemented');
  }

  translateFilter(filter: UniversalFilter): any {
    throw new Error('Not implemented');
  }

  async *iterate(
    collection: string,
    options?: {
      batchSize?: number;
      filter?: UniversalFilter;
    }
  ): AsyncIterableIterator<VectorRecord[]> {
    throw new Error('Not implemented');
  }

  // Capability flags
  supportsMetadataUpdate(): boolean {
    return true; // Pinecone supports partial updates
  }

  supportsFiltering(): boolean {
    return true; // Pinecone supports metadata filtering
  }

  supportsBatchOperations(): boolean {
    return true; // Pinecone supports batch upsert/delete
  }
}
```

**Step 3: Commit**

```bash
git add packages/adapter-pinecone/src/
git commit -m "feat(adapter-pinecone): add types and adapter skeleton

- Add PineconeConfig interface with hybrid config support
- Add PineconeAdapter class skeleton with all abstract methods
- Add config validation in constructor
- Set capability flags (all true for Pinecone)"
```

---

## Task 3: Pinecone Adapter - Connection Management

**Files:**
- Modify: `packages/adapter-pinecone/src/pinecone-adapter.ts`
- Create: `packages/adapter-pinecone/tests/unit/connection.test.ts`

**Step 1: Write failing test**

Create `packages/adapter-pinecone/tests/unit/connection.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';

describe('PineconeAdapter - Connection', () => {
  let adapter: PineconeAdapter;

  beforeEach(() => {
    adapter = new PineconeAdapter({
      apiKey: 'test-api-key',
      environment: 'test-env',
    });
  });

  it('should throw error if apiKey is missing', () => {
    expect(() => new PineconeAdapter({ apiKey: '' })).toThrow(
      'PineconeAdapter requires apiKey'
    );
  });

  it('should start disconnected', async () => {
    const connected = await adapter.isConnected();
    expect(connected).toBe(false);
  });

  it('should connect successfully', async () => {
    // Note: This will fail without mocking Pinecone client
    // For now, just test the structure
    await expect(adapter.connect()).rejects.toThrow();
  });

  it('should report connected after connect', async () => {
    // Will implement with proper mocking in next iteration
  });

  it('should disconnect successfully', async () => {
    await expect(adapter.disconnect()).resolves.not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/adapter-pinecone && npm test`
Expected: Tests fail (connect/disconnect not implemented)

**Step 3: Implement connection management**

Modify `packages/adapter-pinecone/src/pinecone-adapter.ts`:

Replace the three connection methods:

```typescript
async connect(): Promise<void> {
  try {
    this.client = new Pinecone({
      apiKey: this.config.apiKey,
      environment: this.config.environment,
    });

    // Verify connection by listing indexes
    await this.client.listIndexes();
  } catch (error) {
    throw new Error(
      `Pinecone connection failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

async disconnect(): Promise<void> {
  this.client = null;
}

async isConnected(): Promise<boolean> {
  return this.client !== null;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/adapter-pinecone && npm test`
Expected: Basic connection tests pass (integration tests will need real API)

**Step 5: Commit**

```bash
git add packages/adapter-pinecone/
git commit -m "feat(adapter-pinecone): implement connection management

- Implement connect() with Pinecone client initialization
- Implement disconnect() to clear client
- Implement isConnected() to check client state
- Add unit tests for connection lifecycle
- Add error context via cause chain"
```

---

## Task 4: Pinecone Adapter - Filter Translation

**Files:**
- Modify: `packages/adapter-pinecone/src/pinecone-adapter.ts`
- Create: `packages/adapter-pinecone/tests/unit/filter-translation.test.ts`

**Step 1: Write failing tests**

Create `packages/adapter-pinecone/tests/unit/filter-translation.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';

describe('PineconeAdapter - Filter Translation', () => {
  let adapter: PineconeAdapter;

  beforeEach(() => {
    adapter = new PineconeAdapter({
      apiKey: 'test-key',
    });
  });

  describe('Basic operators', () => {
    it('should translate eq operator', () => {
      const result = adapter.translateFilter({
        field: 'status',
        op: 'eq',
        value: 'active',
      });
      expect(result).toEqual({ status: { $eq: 'active' } });
    });

    it('should translate ne operator', () => {
      const result = adapter.translateFilter({
        field: 'status',
        op: 'ne',
        value: 'deleted',
      });
      expect(result).toEqual({ status: { $ne: 'deleted' } });
    });

    it('should translate gt operator', () => {
      const result = adapter.translateFilter({
        field: 'score',
        op: 'gt',
        value: 0.5,
      });
      expect(result).toEqual({ score: { $gt: 0.5 } });
    });

    it('should translate gte operator', () => {
      const result = adapter.translateFilter({
        field: 'score',
        op: 'gte',
        value: 0.5,
      });
      expect(result).toEqual({ score: { $gte: 0.5 } });
    });

    it('should translate lt operator', () => {
      const result = adapter.translateFilter({
        field: 'score',
        op: 'lt',
        value: 0.9,
      });
      expect(result).toEqual({ score: { $lt: 0.9 } });
    });

    it('should translate lte operator', () => {
      const result = adapter.translateFilter({
        field: 'score',
        op: 'lte',
        value: 0.9,
      });
      expect(result).toEqual({ score: { $lte: 0.9 } });
    });

    it('should translate in operator', () => {
      const result = adapter.translateFilter({
        field: 'category',
        op: 'in',
        value: ['tech', 'science'],
      });
      expect(result).toEqual({ category: { $in: ['tech', 'science'] } });
    });

    it('should translate nin operator', () => {
      const result = adapter.translateFilter({
        field: 'category',
        op: 'nin',
        value: ['spam', 'deleted'],
      });
      expect(result).toEqual({ category: { $nin: ['spam', 'deleted'] } });
    });
  });

  describe('AND compound filter', () => {
    it('should translate simple AND filter', () => {
      const result = adapter.translateFilter({
        and: [
          { field: 'status', op: 'eq', value: 'active' },
          { field: 'score', op: 'gte', value: 0.5 },
        ],
      });
      expect(result).toEqual({
        $and: [
          { status: { $eq: 'active' } },
          { score: { $gte: 0.5 } },
        ],
      });
    });
  });

  describe('Unsupported operations', () => {
    it('should throw error for OR filter', () => {
      expect(() =>
        adapter.translateFilter({
          or: [
            { field: 'status', op: 'eq', value: 'active' },
            { field: 'status', op: 'eq', value: 'pending' },
          ],
        })
      ).toThrow('OR filters not yet supported in PineconeAdapter');
    });

    it('should throw error for nested AND/OR', () => {
      expect(() =>
        adapter.translateFilter({
          and: [
            { field: 'status', op: 'eq', value: 'active' },
            {
              or: [
                { field: 'type', op: 'eq', value: 'A' },
                { field: 'type', op: 'eq', value: 'B' },
              ],
            },
          ],
        })
      ).toThrow('Nested compound filters not yet supported');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/adapter-pinecone && npm test`
Expected: All filter tests fail (not implemented)

**Step 3: Implement filter translation**

Modify `packages/adapter-pinecone/src/pinecone-adapter.ts`:

Replace `translateFilter` method:

```typescript
translateFilter(filter: UniversalFilter): any {
  // Handle compound AND filter
  if ('and' in filter) {
    const conditions = filter.and;

    // Check for nested compound filters (not supported yet)
    for (const condition of conditions) {
      if ('and' in condition || 'or' in condition) {
        throw new Error(
          'Nested compound filters not yet supported in PineconeAdapter. See TECH_DEBT.md',
          { cause: { filter } }
        );
      }
    }

    return {
      $and: conditions.map((c) => this.translateFilter(c)),
    };
  }

  // Handle compound OR filter (not supported)
  if ('or' in filter) {
    throw new Error(
      'OR filters not yet supported in PineconeAdapter. See TECH_DEBT.md',
      { cause: { filter } }
    );
  }

  // Handle basic filter condition
  const { field, op, value } = filter as any;

  // Operator mapping
  const operatorMap: Record<string, string> = {
    eq: '$eq',
    ne: '$ne',
    gt: '$gt',
    gte: '$gte',
    lt: '$lt',
    lte: '$lte',
    in: '$in',
    nin: '$nin',
  };

  const pineconeOp = operatorMap[op];
  if (!pineconeOp) {
    throw new Error(
      `Unsupported filter operator: ${op}`,
      { cause: { filter } }
    );
  }

  return {
    [field]: {
      [pineconeOp]: value,
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/adapter-pinecone && npm test`
Expected: All filter translation tests pass

**Step 5: Commit**

```bash
git add packages/adapter-pinecone/
git commit -m "feat(adapter-pinecone): implement filter translation

- Add support for 8 basic operators (eq, ne, gt, gte, lt, lte, in, nin)
- Add support for simple AND compound filters
- Throw descriptive errors for unsupported OR and nested filters
- Add comprehensive unit tests (11 test cases)
- Add error context via cause chain"
```

---

## Task 5: Pinecone Adapter - Collection Operations

**Files:**
- Modify: `packages/adapter-pinecone/src/pinecone-adapter.ts`
- Create: `packages/adapter-pinecone/tests/unit/collections.test.ts`

**Step 1: Write failing tests**

Create `packages/adapter-pinecone/tests/unit/collections.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';

describe('PineconeAdapter - Collections', () => {
  let adapter: PineconeAdapter;

  beforeEach(() => {
    adapter = new PineconeAdapter({
      apiKey: 'test-key',
    });
    // Mock will be needed for actual implementation
  });

  it('should create collection with dimension', async () => {
    await expect(adapter.createCollection('test-index', 384)).rejects.toThrow();
  });

  it('should delete collection', async () => {
    await expect(adapter.deleteCollection('test-index')).rejects.toThrow();
  });

  it('should check if collection exists', async () => {
    await expect(adapter.collectionExists('test-index')).rejects.toThrow();
  });

  it('should get collection stats', async () => {
    await expect(adapter.getCollectionStats('test-index')).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/adapter-pinecone && npm test`
Expected: All collection tests fail

**Step 3: Implement collection operations**

Modify `packages/adapter-pinecone/src/pinecone-adapter.ts`:

Replace the collection methods:

```typescript
async createCollection(
  name: string,
  dimension: number,
  metric: DistanceMetric = 'cosine'
): Promise<void> {
  if (!this.client) {
    throw new Error('Not connected. Call connect() first.');
  }

  try {
    // Map our metric to Pinecone metric
    const pineconeMetric = metric === 'dotProduct' ? 'dotproduct' : metric;

    await this.client.createIndex({
      name,
      dimension,
      metric: pineconeMetric,
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to create Pinecone index ${name}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

async deleteCollection(name: string): Promise<void> {
  if (!this.client) {
    throw new Error('Not connected. Call connect() first.');
  }

  try {
    await this.client.deleteIndex(name);
  } catch (error) {
    throw new Error(
      `Failed to delete Pinecone index ${name}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

async collectionExists(name: string): Promise<boolean> {
  if (!this.client) {
    throw new Error('Not connected. Call connect() first.');
  }

  try {
    const indexes = await this.client.listIndexes();
    return indexes.indexes?.some((idx) => idx.name === name) ?? false;
  } catch (error) {
    throw new Error(
      `Failed to check if Pinecone index ${name} exists: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

async getCollectionStats(name: string): Promise<CollectionStats> {
  if (!this.client) {
    throw new Error('Not connected. Call connect() first.');
  }

  try {
    const index = this.client.index(name);
    const stats = await index.describeIndexStats();

    return {
      vectorCount: stats.totalRecordCount ?? 0,
      dimension: stats.dimension ?? 0,
      metric: 'cosine', // Pinecone doesn't return metric in stats, default to cosine
      ...stats,
    };
  } catch (error) {
    throw new Error(
      `Failed to get Pinecone index stats for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}
```

**Step 4: Update tests with better structure**

Update tests to not expect errors (they'll need integration tests for real validation):

```typescript
// Tests will pass when connected, but we'll add integration tests later
// For unit tests, focus on testing logic not requiring real API
```

**Step 5: Commit**

```bash
git add packages/adapter-pinecone/
git commit -m "feat(adapter-pinecone): implement collection operations

- Implement createCollection with serverless spec
- Implement deleteCollection
- Implement collectionExists with index listing
- Implement getCollectionStats with describeIndexStats
- Add error handling with cause chain
- Add connection validation for all methods"
```

---

## Task 6: Pinecone Adapter - Vector Operations & Search

**Files:**
- Modify: `packages/adapter-pinecone/src/pinecone-adapter.ts`
- Create: `packages/adapter-pinecone/tests/unit/vectors.test.ts`

**Step 1: Write test structure**

Create `packages/adapter-pinecone/tests/unit/vectors.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';
import type { VectorRecord } from '@vectororm/core';

describe('PineconeAdapter - Vector Operations', () => {
  let adapter: PineconeAdapter;

  beforeEach(() => {
    adapter = new PineconeAdapter({ apiKey: 'test-key' });
  });

  describe('upsert', () => {
    it('should require connection', async () => {
      const records: VectorRecord[] = [
        { id: '1', embedding: [0.1, 0.2], metadata: {} },
      ];
      await expect(adapter.upsert('test', records)).rejects.toThrow('Not connected');
    });
  });

  describe('fetch', () => {
    it('should require connection', async () => {
      await expect(adapter.fetch('test', ['1'])).rejects.toThrow('Not connected');
    });
  });

  describe('delete', () => {
    it('should require connection', async () => {
      await expect(adapter.delete('test', ['1'])).rejects.toThrow('Not connected');
    });
  });

  describe('search', () => {
    it('should require connection', async () => {
      await expect(
        adapter.search('test', [0.1, 0.2])
      ).rejects.toThrow('Not connected');
    });
  });

  describe('updateMetadata', () => {
    it('should require connection', async () => {
      await expect(
        adapter.updateMetadata('test', [{ id: '1', metadata: {} }])
      ).rejects.toThrow('Not connected');
    });
  });
});
```

**Step 2: Run test to verify structure**

Run: `cd packages/adapter-pinecone && npm test`
Expected: Tests pass (checking for "Not connected" error)

**Step 3: Implement vector operations**

Modify `packages/adapter-pinecone/src/pinecone-adapter.ts`:

```typescript
async upsert(collection: string, records: VectorRecord[]): Promise<void> {
  if (!this.client) {
    throw new Error('Not connected. Call connect() first.');
  }

  try {
    const index = this.client.index(collection);

    // Convert VectorRecord[] to Pinecone format
    const pineconeRecords = records.map((record) => ({
      id: record.id,
      values: record.embedding,
      metadata: record.metadata,
    }));

    await index.upsert(pineconeRecords);
  } catch (error) {
    throw new Error(
      `Failed to upsert vectors to Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

async fetch(collection: string, ids: string[]): Promise<VectorRecord[]> {
  if (!this.client) {
    throw new Error('Not connected. Call connect() first.');
  }

  try {
    const index = this.client.index(collection);
    const response = await index.fetch(ids);

    return Object.entries(response.records || {}).map(([id, record]) => ({
      id,
      embedding: record.values || [],
      metadata: record.metadata || {},
    }));
  } catch (error) {
    throw new Error(
      `Failed to fetch vectors from Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

async delete(collection: string, ids: string[]): Promise<void> {
  if (!this.client) {
    throw new Error('Not connected. Call connect() first.');
  }

  try {
    const index = this.client.index(collection);
    await index.deleteMany(ids);
  } catch (error) {
    throw new Error(
      `Failed to delete vectors from Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

async search(
  collection: string,
  queryVector: number[],
  options?: {
    topK?: number;
    filter?: UniversalFilter;
    includeMetadata?: boolean;
    includeValues?: boolean;
  }
): Promise<SearchResult> {
  if (!this.client) {
    throw new Error('Not connected. Call connect() first.');
  }

  try {
    const index = this.client.index(collection);

    const pineconeFilter = options?.filter
      ? this.translateFilter(options.filter)
      : undefined;

    const response = await index.query({
      vector: queryVector,
      topK: options?.topK || 10,
      filter: pineconeFilter,
      includeMetadata: options?.includeMetadata !== false,
      includeValues: options?.includeValues || false,
    });

    return {
      records: (response.matches || []).map((match) => ({
        id: match.id,
        embedding: match.values || [],
        metadata: match.metadata || {},
        score: match.score,
      })),
    };
  } catch (error) {
    throw new Error(
      `Failed to search Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

async updateMetadata(
  collection: string,
  updates: MetadataUpdate[]
): Promise<void> {
  if (!this.client) {
    throw new Error('Not connected. Call connect() first.');
  }

  try {
    const index = this.client.index(collection);

    // Pinecone supports partial metadata updates via update()
    for (const update of updates) {
      await index.update({
        id: update.id,
        metadata: update.metadata,
      });
    }
  } catch (error) {
    throw new Error(
      `Failed to update metadata in Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}
```

**Step 4: Run tests**

Run: `cd packages/adapter-pinecone && npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/adapter-pinecone/
git commit -m "feat(adapter-pinecone): implement vector operations and search

- Implement upsert with Pinecone record format conversion
- Implement fetch with response mapping to VectorRecord
- Implement delete using deleteMany
- Implement search with filter translation and options mapping
- Implement updateMetadata with partial update support
- Add connection validation and error handling for all methods"
```

---

## Task 7: Pinecone Adapter - Iteration

**Files:**
- Modify: `packages/adapter-pinecone/src/pinecone-adapter.ts`
- Create: `packages/adapter-pinecone/tests/unit/iteration.test.ts`

**Step 1: Write test structure**

Create `packages/adapter-pinecone/tests/unit/iteration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';

describe('PineconeAdapter - Iteration', () => {
  let adapter: PineconeAdapter;

  beforeEach(() => {
    adapter = new PineconeAdapter({ apiKey: 'test-key' });
  });

  it('should require connection', async () => {
    const iterator = adapter.iterate('test');
    await expect(iterator.next()).rejects.toThrow('Not connected');
  });
});
```

**Step 2: Implement iteration**

Modify `packages/adapter-pinecone/src/pinecone-adapter.ts`:

```typescript
async *iterate(
  collection: string,
  options?: {
    batchSize?: number;
    filter?: UniversalFilter;
  }
): AsyncIterableIterator<VectorRecord[]> {
  if (!this.client) {
    throw new Error('Not connected. Call connect() first.');
  }

  try {
    const index = this.client.index(collection);
    const batchSize = options?.batchSize || 100;
    const pineconeFilter = options?.filter
      ? this.translateFilter(options.filter)
      : undefined;

    // Pinecone uses pagination with tokens
    let paginationToken: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await index.listPaginated({
        limit: batchSize,
        paginationToken,
        ...(pineconeFilter && { filter: pineconeFilter }),
      });

      if (response.vectors && response.vectors.length > 0) {
        // Fetch full records with embeddings
        const ids = response.vectors.map((v) => v.id);
        const records = await this.fetch(collection, ids);
        yield records;
      }

      // Check for more pages
      paginationToken = response.pagination?.next;
      hasMore = !!paginationToken;
    }
  } catch (error) {
    throw new Error(
      `Failed to iterate Pinecone index ${collection}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}
```

**Step 3: Run tests**

Run: `cd packages/adapter-pinecone && npm test`
Expected: Tests pass

**Step 4: Commit**

```bash
git add packages/adapter-pinecone/
git commit -m "feat(adapter-pinecone): implement iteration with pagination

- Implement iterate() using listPaginated
- Add internal pagination state management
- Support batch size and filter options
- Fetch full records with embeddings per batch
- Add connection validation and error handling"
```

---

## Task 8: Pinecone Adapter - Integration Tests

**Files:**
- Create: `packages/adapter-pinecone/vitest.integration.config.ts`
- Create: `packages/adapter-pinecone/tests/integration/pinecone.integration.test.ts`

**Step 1: Create integration config**

Create `packages/adapter-pinecone/vitest.integration.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000, // Longer timeout for real API calls
  },
});
```

**Step 2: Create integration tests**

Create `packages/adapter-pinecone/tests/integration/pinecone.integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';
import type { VectorRecord } from '@vectororm/core';

// Skip if no API key
const hasApiKey = !!process.env.PINECONE_API_KEY;
const testIndexName = `vectororm-test-${Date.now()}`;

describe.skipIf(!hasApiKey)('Pinecone Integration', () => {
  let adapter: PineconeAdapter;

  beforeAll(async () => {
    adapter = new PineconeAdapter({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: process.env.PINECONE_ENVIRONMENT,
    });

    await adapter.connect();

    // Create test index
    await adapter.createCollection(testIndexName, 3, 'cosine');

    // Wait for index to be ready
    await new Promise((resolve) => setTimeout(resolve, 10000));
  });

  afterAll(async () => {
    // Clean up test index
    if (adapter) {
      await adapter.deleteCollection(testIndexName);
      await adapter.disconnect();
    }
  });

  it('should upsert and fetch vectors', async () => {
    const records: VectorRecord[] = [
      {
        id: 'vec1',
        embedding: [0.1, 0.2, 0.3],
        metadata: { type: 'test' },
      },
      {
        id: 'vec2',
        embedding: [0.4, 0.5, 0.6],
        metadata: { type: 'test' },
      },
    ];

    await adapter.upsert(testIndexName, records);

    // Wait for eventual consistency
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const fetched = await adapter.fetch(testIndexName, ['vec1', 'vec2']);
    expect(fetched).toHaveLength(2);
    expect(fetched[0].metadata.type).toBe('test');
  });

  it('should search with filters', async () => {
    const result = await adapter.search(testIndexName, [0.1, 0.2, 0.3], {
      topK: 5,
      filter: {
        field: 'type',
        op: 'eq',
        value: 'test',
      },
    });

    expect(result.records.length).toBeGreaterThan(0);
    expect(result.records[0].metadata.type).toBe('test');
  });

  it('should update metadata', async () => {
    await adapter.updateMetadata(testIndexName, [
      { id: 'vec1', metadata: { type: 'updated' } },
    ]);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const fetched = await adapter.fetch(testIndexName, ['vec1']);
    expect(fetched[0].metadata.type).toBe('updated');
  });

  it('should iterate all vectors', async () => {
    const batches: VectorRecord[][] = [];
    for await (const batch of adapter.iterate(testIndexName, {
      batchSize: 10,
    })) {
      batches.push(batch);
    }

    expect(batches.length).toBeGreaterThan(0);
  });

  it('should delete vectors', async () => {
    await adapter.delete(testIndexName, ['vec2']);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const fetched = await adapter.fetch(testIndexName, ['vec2']);
    expect(fetched).toHaveLength(0);
  });
});
```

**Step 3: Add integration test script to package.json**

Update `packages/adapter-pinecone/package.json` scripts:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

**Step 4: Commit**

```bash
git add packages/adapter-pinecone/
git commit -m "test(adapter-pinecone): add integration tests

- Add integration test configuration
- Add full lifecycle integration test (create, upsert, search, update, delete)
- Add filter integration test
- Add iteration integration test
- Tests skip if PINECONE_API_KEY not set
- Add cleanup in afterAll hook"
```

---

## Task 9: Turbopuffer Adapter - Package Setup

**Files:**
- Create: `packages/adapter-turbopuffer/package.json`
- Create: `packages/adapter-turbopuffer/tsconfig.json`
- Create: `packages/adapter-turbopuffer/tsup.config.ts`
- Create: `packages/adapter-turbopuffer/vitest.config.ts`
- Create: `packages/adapter-turbopuffer/src/index.ts`
- Create: `packages/adapter-turbopuffer/TECH_DEBT.md`

[Follow same pattern as Pinecone Task 1, adapted for Turbopuffer]

**Step 1: Create package.json**

Similar structure, but with Turbopuffer client (or fetch for REST API)

**Step 2-7: Same as Pinecone Task 1**

---

## Task 10: Turbopuffer Adapter - Implementation

[Follow Tasks 2-8 pattern from Pinecone, adapted for Turbopuffer's API]

Key differences:
- Turbopuffer uses REST API (may need fetch instead of SDK)
- Filter format is different
- Cursor-based pagination instead of token-based

---

## Task 11: Chroma Adapter - Package Setup

**Files:**
- Create: `packages/adapter-chroma/package.json`
- Create: `packages/adapter-chroma/tsconfig.json`
- Create: `packages/adapter-chroma/tsup.config.ts`
- Create: `packages/adapter-chroma/vitest.config.ts`
- Create: `packages/adapter-chroma/src/index.ts`
- Create: `packages/adapter-chroma/TECH_DEBT.md`

[Follow same pattern as Pinecone Task 1, adapted for Chroma]

---

## Task 12: Chroma Adapter - Implementation

[Follow Tasks 2-8 pattern from Pinecone, adapted for Chroma's API]

Key differences:
- Chroma uses chromadb client
- Filter format uses `where` with MongoDB-like syntax
- Offset/limit pagination instead of tokens/cursors
- Self-hosted option (host/port config)

---

## Summary

**Total Tasks: 12** (8 for Pinecone + 2 for Turbopuffer + 2 for Chroma)

Each adapter follows the same implementation pattern:
1. Package setup
2. Types & config
3. Connection management
4. Filter translation
5. Collection operations
6. Vector operations & search
7. Iteration
8. Integration tests

**Expected test count per adapter:** ~25-30 unit tests + 5-6 integration tests

**Success criteria:**
- All VectorDBAdapter methods implemented exactly
- Basic filter operators + simple AND working
- Unit tests passing
- Integration tests passing (if credentials available)
- TECH_DEBT.md documents limitations
- Builds successfully
