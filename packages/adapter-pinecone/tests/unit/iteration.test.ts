import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';
import { Pinecone } from '@pinecone-database/pinecone';

// Mock the Pinecone SDK
vi.mock('@pinecone-database/pinecone', () => {
  return {
    Pinecone: vi.fn(),
  };
});

describe('PineconeAdapter - Iteration', () => {
  let adapter: PineconeAdapter;
  let mockClient: any;
  let mockIndex: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock index
    mockIndex = {
      listPaginated: vi.fn(),
      fetch: vi.fn(),
    };

    // Setup mock client
    mockClient = {
      listIndexes: vi.fn(),
      index: vi.fn(() => mockIndex),
    };

    // Mock Pinecone constructor
    (Pinecone as any).mockImplementation(() => mockClient);

    adapter = new PineconeAdapter({ apiKey: 'test-key' });
  });

  it('should throw if not connected', async () => {
    const iterator = adapter.iterate('test');
    await expect(iterator.next()).rejects.toThrow('Not connected');
  });

  it('should iterate over single batch', async () => {
    await adapter.connect();

    // Mock listPaginated to return one batch with no next token
    mockIndex.listPaginated.mockResolvedValue({
      vectors: [{ id: 'vec1' }, { id: 'vec2' }],
      pagination: {},
    });

    // Mock fetch to return full records
    mockIndex.fetch.mockResolvedValue({
      records: {
        vec1: {
          id: 'vec1',
          values: [0.1, 0.2, 0.3],
          metadata: { type: 'test' },
        },
        vec2: {
          id: 'vec2',
          values: [0.4, 0.5, 0.6],
          metadata: { type: 'test2' },
        },
      },
    });

    const batches = [];
    for await (const batch of adapter.iterate('test-index')) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
    expect(batches[0][0].id).toBe('vec1');
    expect(batches[0][1].id).toBe('vec2');
    expect(mockIndex.listPaginated).toHaveBeenCalledWith({
      limit: 100,
      paginationToken: undefined,
    });
  });

  it('should iterate over multiple batches', async () => {
    await adapter.connect();

    // Mock listPaginated to return multiple batches
    mockIndex.listPaginated
      .mockResolvedValueOnce({
        vectors: [{ id: 'vec1' }, { id: 'vec2' }],
        pagination: { next: 'token1' },
      })
      .mockResolvedValueOnce({
        vectors: [{ id: 'vec3' }, { id: 'vec4' }],
        pagination: { next: 'token2' },
      })
      .mockResolvedValueOnce({
        vectors: [{ id: 'vec5' }],
        pagination: {},
      });

    // Mock fetch to return full records
    mockIndex.fetch
      .mockResolvedValueOnce({
        records: {
          vec1: { id: 'vec1', values: [0.1], metadata: {} },
          vec2: { id: 'vec2', values: [0.2], metadata: {} },
        },
      })
      .mockResolvedValueOnce({
        records: {
          vec3: { id: 'vec3', values: [0.3], metadata: {} },
          vec4: { id: 'vec4', values: [0.4], metadata: {} },
        },
      })
      .mockResolvedValueOnce({
        records: {
          vec5: { id: 'vec5', values: [0.5], metadata: {} },
        },
      });

    const batches = [];
    for await (const batch of adapter.iterate('test-index')) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(2);
    expect(batches[1]).toHaveLength(2);
    expect(batches[2]).toHaveLength(1);

    // Verify pagination tokens were used
    expect(mockIndex.listPaginated).toHaveBeenNthCalledWith(1, {
      limit: 100,
      paginationToken: undefined,
    });
    expect(mockIndex.listPaginated).toHaveBeenNthCalledWith(2, {
      limit: 100,
      paginationToken: 'token1',
    });
    expect(mockIndex.listPaginated).toHaveBeenNthCalledWith(3, {
      limit: 100,
      paginationToken: 'token2',
    });
  });

  it('should use custom batch size', async () => {
    await adapter.connect();

    mockIndex.listPaginated.mockResolvedValue({
      vectors: [{ id: 'vec1' }],
      pagination: {},
    });

    mockIndex.fetch.mockResolvedValue({
      records: {
        vec1: { id: 'vec1', values: [0.1], metadata: {} },
      },
    });

    const batches = [];
    for await (const batch of adapter.iterate('test-index', {
      batchSize: 50,
    })) {
      batches.push(batch);
    }

    expect(mockIndex.listPaginated).toHaveBeenCalledWith({
      limit: 50,
      paginationToken: undefined,
    });
  });

  it('should apply filter', async () => {
    await adapter.connect();

    mockIndex.listPaginated.mockResolvedValue({
      vectors: [{ id: 'vec1' }],
      pagination: {},
    });

    mockIndex.fetch.mockResolvedValue({
      records: {
        vec1: { id: 'vec1', values: [0.1], metadata: { type: 'test' } },
      },
    });

    const batches = [];
    for await (const batch of adapter.iterate('test-index', {
      filter: { field: 'type', op: 'eq', value: 'test' },
    })) {
      batches.push(batch);
    }

    expect(mockIndex.listPaginated).toHaveBeenCalledWith({
      limit: 100,
      paginationToken: undefined,
      filter: { type: { $eq: 'test' } },
    });
  });

  it('should handle empty batches', async () => {
    await adapter.connect();

    mockIndex.listPaginated.mockResolvedValue({
      vectors: [],
      pagination: {},
    });

    const batches = [];
    for await (const batch of adapter.iterate('test-index')) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(0);
  });

  it('should handle missing vectors array', async () => {
    await adapter.connect();

    mockIndex.listPaginated.mockResolvedValue({
      pagination: {},
    });

    const batches = [];
    for await (const batch of adapter.iterate('test-index')) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(0);
  });

  it('should wrap errors with context', async () => {
    await adapter.connect();

    const mockError = new Error('API error');
    mockIndex.listPaginated.mockRejectedValue(mockError);

    const iterator = adapter.iterate('test-index');

    await expect(iterator.next()).rejects.toThrow(
      'Failed to iterate Pinecone index test-index'
    );
  });

  it('should stop iteration when pagination token is undefined', async () => {
    await adapter.connect();

    mockIndex.listPaginated.mockResolvedValueOnce({
      vectors: [{ id: 'vec1' }],
      pagination: { next: undefined },
    });

    mockIndex.fetch.mockResolvedValue({
      records: {
        vec1: { id: 'vec1', values: [0.1], metadata: {} },
      },
    });

    const batches = [];
    for await (const batch of adapter.iterate('test-index')) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    expect(mockIndex.listPaginated).toHaveBeenCalledTimes(1);
  });
});
