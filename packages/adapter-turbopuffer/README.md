# @vectororm/adapter-turbopuffer

[![npm](https://img.shields.io/npm/v/@vectororm/adapter-turbopuffer)](https://www.npmjs.com/package/@vectororm/adapter-turbopuffer)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[Turbopuffer](https://turbopuffer.com/) adapter for [VectorORM](https://github.com/aviramroi/VectorORM).

## Installation

```bash
npm install @vectororm/adapter-turbopuffer @vectororm/core
```

## Usage

```typescript
import { TurbopufferAdapter } from '@vectororm/adapter-turbopuffer';

// Create adapter
const adapter = new TurbopufferAdapter({
  apiKey: process.env.TURBOPUFFER_API_KEY || 'your-api-key',
  // Optional: custom base URL
  baseUrl: 'https://api.turbopuffer.com',
});

// Connect
await adapter.connect();

// Create a collection (namespace)
await adapter.createCollection('my-vectors', 128, 'cosine');

// Upsert vectors
await adapter.upsert('my-vectors', [
  {
    id: 'vec1',
    embedding: [0.1, 0.2, ...],
    metadata: { title: 'Document 1', category: 'tech' }
  }
]);

// Search
const results = await adapter.search('my-vectors', queryVector, {
  topK: 10,
  filter: { field: 'category', op: 'eq', value: 'tech' }
});

// Disconnect
await adapter.disconnect();
```

## Configuration

### TurbopufferConfig

- `apiKey` (required): Your Turbopuffer API key
- `baseUrl` (optional): Custom API base URL (defaults to `https://api.turbopuffer.com`)

## Features

- Full CRUD operations on vectors
- Metadata filtering with compound AND/OR filters
- Vector similarity search
- Metadata updates
- Batch operations
- Async iteration over collections
- Multiple distance metrics (cosine, euclidean)

## Supported Operations

### Connection Management
- `connect()` - Establish connection to Turbopuffer
- `disconnect()` - Close connection
- `isConnected()` - Check connection status

### Collection Management
- `createCollection(name, dimension, metric)` - Create namespace
- `deleteCollection(name)` - Delete namespace
- `collectionExists(name)` - Check if namespace exists
- `getCollectionStats(name)` - Get vector count and stats

### Vector Operations
- `upsert(collection, records)` - Insert or update vectors
- `fetch(collection, ids)` - Fetch vectors by IDs
- `delete(collection, ids)` - Delete vectors by IDs
- `search(collection, queryVector, options)` - Vector similarity search
- `updateMetadata(collection, updates)` - Update vector metadata
- `iterate(collection, options)` - Async iteration over vectors

### Filter Translation
- Converts UniversalFilter to Turbopuffer filter format
- Supports: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`
- Supports compound `and`/`or` filters
- Supports nested filter combinations

## Implementation Notes

### REST API
This adapter uses Turbopuffer's REST API directly with `fetch` (no SDK dependency) to avoid Node.js version constraints. The implementation is compatible with Node.js 18+.

### Namespaces
Turbopuffer uses "namespaces" instead of "collections". This adapter transparently maps collection operations to namespace operations.

### Distance Metrics
- `cosine` → `cosine_distance`
- `euclidean` → `euclidean_squared`

### Pagination
Turbopuffer uses attribute-based pagination. The `iterate()` method paginates by ID using greater-than filters.

### Fetch Operation
Turbopuffer doesn't have a direct fetch-by-ID endpoint. The adapter uses filtered queries to implement this functionality.

## Limitations

See [TECH_DEBT.md](./TECH_DEBT.md) for known limitations and future enhancements.

## Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Documentation

- [API Guide](https://github.com/aviramroi/VectorORM/blob/main/docs/guide.md)
- [Full Project](https://github.com/aviramroi/VectorORM)

## License

Apache-2.0
