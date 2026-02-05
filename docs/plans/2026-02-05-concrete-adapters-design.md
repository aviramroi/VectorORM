# Concrete Vector Database Adapters Design (Phase 3)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement three production-ready vector database adapters: Pinecone, Turbopuffer, and Chroma.

**Architecture:** Separate packages implementing the exact VectorDBAdapter API with incremental filter support and comprehensive testing.

**Tech Stack:** TypeScript, official DB SDKs, Vitest

---

## 1. Package Architecture

### Structure
```
packages/
├── core/                          # @glyph/core (existing)
├── adapter-pinecone/              # @glyph/adapter-pinecone (new)
│   ├── src/
│   │   ├── pinecone-adapter.ts   # Main implementation
│   │   ├── types.ts               # Pinecone-specific types
│   │   └── index.ts
│   ├── tests/
│   │   ├── unit/                  # Mock-based tests
│   │   └── integration/           # Real DB tests (skipped if no API key)
│   ├── TECH_DEBT.md               # Tracks limitations
│   └── package.json
├── adapter-turbopuffer/           # @glyph/adapter-turbopuffer (new)
│   └── (same structure)
└── adapter-chroma/                # @glyph/adapter-chroma (new)
    └── (same structure)
```

### Key Principles
- Each adapter is independently installable
- Zero additions to VectorDBAdapter API - exact implementation only
- Adapters depend on @glyph/core but core doesn't know about adapters
- Users install only what they need: `npm install @glyph/core @glyph/adapter-pinecone`

### Package Dependencies
- **Pinecone**: `@pinecone-database/pinecone`
- **Turbopuffer**: `@turbopuffer/turbopuffer` or REST API
- **Chroma**: `chromadb` (official client)

---

## 2. Configuration & Connection

### Constructor Pattern
All three adapters follow the same hybrid pattern:

```typescript
// Pinecone
const pinecone = new PineconeAdapter({
  apiKey: process.env.PINECONE_API_KEY!,
  environment: process.env.PINECONE_ENVIRONMENT!,
  // Pinecone-specific optional config
});

// Turbopuffer
const turbo = new TurbopufferAdapter({
  apiKey: process.env.TURBOPUFFER_API_KEY!,
  // Turbopuffer-specific optional config
});

// Chroma
const chroma = new ChromaAdapter({
  host: process.env.CHROMA_HOST || 'localhost',
  port: parseInt(process.env.CHROMA_PORT || '8000'),
  // Chroma-specific optional config
});
```

### Connection Lifecycle
1. **Constructor** - Stores config (doesn't connect yet)
2. **connect()** - Initialize client, authenticate, verify connection
3. **isConnected()** - Check connection state
4. **disconnect()** - Clean up resources

### Error Handling
Uses standard Error cause chain to preserve DB-specific errors:

```typescript
try {
  await adapter.connect();
} catch (error) {
  // Error has cause chain: AdapterError -> OriginalDBError
  console.error(error.message); // "Pinecone connection failed: Invalid API key"
  console.error(error.cause);   // Original Pinecone error
}
```

### Config Validation
Each constructor validates required fields and throws descriptive errors immediately (fail fast).

---

## 3. Filter Translation Strategy

### Phase 3A Scope (Implement Now)

**Supported operators:**
- `eq`, `ne` - Equality/inequality
- `gt`, `gte`, `lt`, `lte` - Comparisons
- `in`, `nin` - Array membership

**Supported compound filters:**
- Simple `and` - flat array of conditions only
- No nested `or`, no nested `and/or` combinations

### Translation Examples

**Pinecone format:**
```typescript
{ field: { $eq: value } }
{ $and: [{ field1: { $eq: val1 }}, { field2: { $gt: val2 }}] }
```

**Turbopuffer format:**
```typescript
[{ field: 'field', op: 'Eq', value: value }]
{ And: [[{ field: 'field1', op: 'Eq', value: val1 }],
        [{ field: 'field2', op: 'Gt', value: val2 }]] }
```

**Chroma format:**
```typescript
{ field: { "$eq": value } }
{ "$and": [{ field1: { "$eq": val1 }}, { field2: { "$gt": val2 }}] }
```

### Phase 3B (Documented in TECH_DEBT.md)
- `or` compound filters
- Nested `and/or` combinations
- Array operators (contains, overlaps)
- Text operators (startsWith, contains)

### Error Handling for Unsupported Operations
Each adapter throws descriptive errors:

```typescript
throw new Error(
  'OR filters not yet supported in PineconeAdapter. See TECH_DEBT.md',
  { cause: { filter } }
);
```

---

## 4. Testing Approach

### Unit Tests (Always Run)

Mock-based tests for all filter translation logic:

```typescript
// tests/unit/pinecone-adapter.test.ts
describe('PineconeAdapter', () => {
  let adapter: PineconeAdapter;
  let mockClient: MockPineconeClient;

  beforeEach(() => {
    mockClient = createMockPineconeClient();
    adapter = new PineconeAdapter({ apiKey: 'test-key' });
    // Inject mock
  });

  it('translateFilter converts eq operator', () => {
    const result = adapter.translateFilter({
      field: 'status',
      op: 'eq',
      value: 'active'
    });
    expect(result).toEqual({ status: { $eq: 'active' } });
  });

  it('throws error for unsupported OR filters', () => {
    expect(() => adapter.translateFilter({
      or: [...]
    })).toThrow('OR filters not yet supported');
  });
});
```

### Integration Tests (Run Only If Env Vars Present)

Real database tests for verification:

```typescript
// tests/integration/pinecone-adapter.integration.test.ts
const hasApiKey = !!process.env.PINECONE_API_KEY;

describe.skipIf(!hasApiKey)('Pinecone Integration', () => {
  let adapter: PineconeAdapter;

  beforeAll(async () => {
    adapter = new PineconeAdapter({
      apiKey: process.env.PINECONE_API_KEY!
    });
    await adapter.connect();
    await adapter.createCollection('test-collection', 384);
  });

  it('performs real search with filters', async () => {
    // Test against real Pinecone
  });
});
```

### Test Coverage Goals
- **Unit tests**: 100% of filter translation logic
- **Integration tests**: Happy path + one error case per method
- Both use same test data fixtures

---

## 5. Implementation Phases & Tech Debt Tracking

### Implementation Order
1. **Pinecone** (most popular, best documented)
2. **Turbopuffer** (newer, simpler API)
3. **Chroma** (open source, self-hosted option)

### Sequence Per Adapter
1. Package setup (package.json, tsconfig, exports)
2. Core adapter class with config types
3. Connection management (connect, disconnect, isConnected)
4. Collection operations (create, delete, exists, stats)
5. Vector operations (upsert, fetch, delete)
6. Search with filter translation
7. Metadata updates (if supported)
8. Iteration with internal pagination
9. Unit tests (aim for 20-30 tests per adapter)
10. Integration tests (5-10 key scenarios)
11. TECH_DEBT.md documentation

### TECH_DEBT.md Template

```markdown
# Technical Debt - @glyph/adapter-[name]

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
- [Database] supports/doesn't support partial updates
- Document any issues

## Iteration
- Document pagination approach and any limitations

## Performance
- [ ] Connection pooling not implemented
- [ ] Retry logic could be improved
- Document other performance considerations
```

### Success Criteria Per Adapter
- ✅ All VectorDBAdapter methods implemented
- ✅ Basic filter operators working (eq, ne, gt, gte, lt, lte, in, nin)
- ✅ Simple AND compound filters working
- ✅ Unit tests passing (20+ tests)
- ✅ Integration tests passing (if credentials available)
- ✅ TECH_DEBT.md documents limitations clearly
- ✅ Builds successfully, exports correctly
- ✅ No additions to VectorDBAdapter API

---

## Design Decisions

### Why Separate Packages?
- Users only install what they need (no bundling unused DB code)
- Independent versioning per adapter
- Clear dependency boundaries
- Easier to maintain and test

### Why Incremental Filter Support?
- 90% of use cases covered by basic operators + AND
- YAGNI principle - add complexity only when needed
- Clear documentation of limitations via TECH_DEBT.md
- Easier to test and debug

### Why Hybrid Config?
- Flexibility: explicit config or env vars
- Best practice: explicit config with env var defaults
- Matches how most DB SDKs work

### Why Both Unit and Integration Tests?
- Unit tests: fast, run always, test logic
- Integration tests: prove it works, catch API changes
- Optional integration tests don't block development

### Why Internal Pagination State?
- Clean API - user doesn't see DB-specific pagination
- Fits AsyncIterableIterator pattern perfectly
- Encapsulates complexity where it belongs

---

## Implementation Notes

### Filter Translation Complexity
This is the most complex part. Each adapter must:
1. Parse UniversalFilter structure
2. Convert to DB-specific format
3. Handle edge cases (null, undefined, empty arrays)
4. Throw clear errors for unsupported operations
5. Document what's not supported in TECH_DEBT.md

### Metadata Update Support
- **Pinecone**: ✅ Supports partial updates
- **Turbopuffer**: ❓ Check API docs
- **Chroma**: ❓ Check API docs

If not supported, implement via fetch + upsert pattern.

### Iteration Implementation
Each DB has different pagination:
- **Pinecone**: Pagination tokens
- **Turbopuffer**: Cursor-based
- **Chroma**: Offset/limit

Adapter maintains state internally using generator pattern.

### Error Context
All errors should include:
- Clear message explaining what failed
- Original error via `cause` property
- Relevant context (collection name, filter used, etc.)

---

## Next Steps

After design approval:
1. Create worktree for Phase 3 implementation
2. Write detailed implementation plan for all three adapters
3. Implement adapters in order: Pinecone → Turbopuffer → Chroma
4. Each adapter goes through full cycle: implement → test → document
