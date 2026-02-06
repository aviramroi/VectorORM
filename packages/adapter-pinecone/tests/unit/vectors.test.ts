import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';
import type { VectorRecord } from '@glyph/core';
import { Pinecone } from '@pinecone-database/pinecone';

// Mock the Pinecone SDK
vi.mock('@pinecone-database/pinecone', () => {
  return {
    Pinecone: vi.fn(),
  };
});

describe('PineconeAdapter - Vector Operations', () => {
  let adapter: PineconeAdapter;
  let mockClient: any;
  let mockIndex: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock index
    mockIndex = {
      upsert: vi.fn(),
      fetch: vi.fn(),
      deleteMany: vi.fn(),
      query: vi.fn(),
      update: vi.fn(),
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

  describe('upsert', () => {
    it('should throw if not connected', async () => {
      const records: VectorRecord[] = [
        { id: '1', embedding: [0.1, 0.2], metadata: {} },
      ];
      await expect(adapter.upsert('test', records)).rejects.toThrow(
        'Not connected'
      );
    });

    it('should convert and upsert records', async () => {
      await adapter.connect();
      mockIndex.upsert.mockResolvedValue({});

      const records: VectorRecord[] = [
        {
          id: 'vec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { type: 'test' },
        },
        {
          id: 'vec2',
          embedding: [0.4, 0.5, 0.6],
          metadata: { type: 'test2' },
        },
      ];

      await adapter.upsert('test-index', records);

      expect(mockClient.index).toHaveBeenCalledWith('test-index');
      expect(mockIndex.upsert).toHaveBeenCalledWith([
        {
          id: 'vec1',
          values: [0.1, 0.2, 0.3],
          metadata: { type: 'test' },
        },
        {
          id: 'vec2',
          values: [0.4, 0.5, 0.6],
          metadata: { type: 'test2' },
        },
      ]);
    });

    it('should wrap errors with context', async () => {
      await adapter.connect();
      const mockError = new Error('API error');
      mockIndex.upsert.mockRejectedValue(mockError);

      const records: VectorRecord[] = [
        { id: '1', embedding: [0.1, 0.2], metadata: {} },
      ];

      await expect(adapter.upsert('test-index', records)).rejects.toThrow(
        'Failed to upsert vectors to Pinecone index test-index'
      );
    });
  });

  describe('fetch', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.fetch('test', ['1'])).rejects.toThrow(
        'Not connected'
      );
    });

    it('should fetch and convert records', async () => {
      await adapter.connect();
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

      const records = await adapter.fetch('test-index', ['vec1', 'vec2']);

      expect(mockClient.index).toHaveBeenCalledWith('test-index');
      expect(mockIndex.fetch).toHaveBeenCalledWith(['vec1', 'vec2']);
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({
        id: 'vec1',
        embedding: [0.1, 0.2, 0.3],
        metadata: { type: 'test' },
      });
      expect(records[1]).toEqual({
        id: 'vec2',
        embedding: [0.4, 0.5, 0.6],
        metadata: { type: 'test2' },
      });
    });

    it('should handle empty response', async () => {
      await adapter.connect();
      mockIndex.fetch.mockResolvedValue({});

      const records = await adapter.fetch('test-index', ['vec1']);

      expect(records).toHaveLength(0);
    });

    it('should handle missing values/metadata', async () => {
      await adapter.connect();
      mockIndex.fetch.mockResolvedValue({
        records: {
          vec1: {
            id: 'vec1',
          },
        },
      });

      const records = await adapter.fetch('test-index', ['vec1']);

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({
        id: 'vec1',
        embedding: [],
        metadata: {},
      });
    });

    it('should wrap errors with context', async () => {
      await adapter.connect();
      const mockError = new Error('API error');
      mockIndex.fetch.mockRejectedValue(mockError);

      await expect(adapter.fetch('test-index', ['vec1'])).rejects.toThrow(
        'Failed to fetch vectors from Pinecone index test-index'
      );
    });
  });

  describe('delete', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.delete('test', ['1'])).rejects.toThrow(
        'Not connected'
      );
    });

    it('should delete records', async () => {
      await adapter.connect();
      mockIndex.deleteMany.mockResolvedValue({});

      await adapter.delete('test-index', ['vec1', 'vec2']);

      expect(mockClient.index).toHaveBeenCalledWith('test-index');
      expect(mockIndex.deleteMany).toHaveBeenCalledWith(['vec1', 'vec2']);
    });

    it('should wrap errors with context', async () => {
      await adapter.connect();
      const mockError = new Error('API error');
      mockIndex.deleteMany.mockRejectedValue(mockError);

      await expect(adapter.delete('test-index', ['vec1'])).rejects.toThrow(
        'Failed to delete vectors from Pinecone index test-index'
      );
    });
  });

  describe('search', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.search('test', [0.1, 0.2])).rejects.toThrow(
        'Not connected'
      );
    });

    it('should search with default options', async () => {
      await adapter.connect();
      mockIndex.query.mockResolvedValue({
        matches: [
          {
            id: 'vec1',
            score: 0.95,
            values: [0.1, 0.2, 0.3],
            metadata: { type: 'test' },
          },
        ],
      });

      const result = await adapter.search('test-index', [0.1, 0.2, 0.3]);

      expect(mockClient.index).toHaveBeenCalledWith('test-index');
      expect(mockIndex.query).toHaveBeenCalledWith({
        vector: [0.1, 0.2, 0.3],
        topK: 10,
        filter: undefined,
        includeMetadata: true,
        includeValues: false,
      });
      expect(result.records).toHaveLength(1);
      expect(result.records[0]).toEqual({
        id: 'vec1',
        embedding: [0.1, 0.2, 0.3],
        metadata: { type: 'test' },
        score: 0.95,
      });
    });

    it('should search with custom options', async () => {
      await adapter.connect();
      mockIndex.query.mockResolvedValue({
        matches: [],
      });

      await adapter.search('test-index', [0.1, 0.2, 0.3], {
        topK: 5,
        filter: { field: 'type', op: 'eq', value: 'test' },
        includeMetadata: false,
        includeValues: true,
      });

      expect(mockIndex.query).toHaveBeenCalledWith({
        vector: [0.1, 0.2, 0.3],
        topK: 5,
        filter: { type: { $eq: 'test' } },
        includeMetadata: false,
        includeValues: true,
      });
    });

    it('should handle empty results', async () => {
      await adapter.connect();
      mockIndex.query.mockResolvedValue({});

      const result = await adapter.search('test-index', [0.1, 0.2, 0.3]);

      expect(result.records).toHaveLength(0);
    });

    it('should handle missing values/metadata in results', async () => {
      await adapter.connect();
      mockIndex.query.mockResolvedValue({
        matches: [
          {
            id: 'vec1',
            score: 0.95,
          },
        ],
      });

      const result = await adapter.search('test-index', [0.1, 0.2, 0.3]);

      expect(result.records[0]).toEqual({
        id: 'vec1',
        embedding: [],
        metadata: {},
        score: 0.95,
      });
    });

    it('should wrap errors with context', async () => {
      await adapter.connect();
      const mockError = new Error('API error');
      mockIndex.query.mockRejectedValue(mockError);

      await expect(
        adapter.search('test-index', [0.1, 0.2, 0.3])
      ).rejects.toThrow('Failed to search Pinecone index test-index');
    });
  });

  describe('updateMetadata', () => {
    it('should throw if not connected', async () => {
      await expect(
        adapter.updateMetadata('test', [{ id: '1', metadata: {} }])
      ).rejects.toThrow('Not connected');
    });

    it('should update metadata for single record', async () => {
      await adapter.connect();
      mockIndex.update.mockResolvedValue({});

      await adapter.updateMetadata('test-index', [
        { id: 'vec1', metadata: { type: 'updated' } },
      ]);

      expect(mockClient.index).toHaveBeenCalledWith('test-index');
      expect(mockIndex.update).toHaveBeenCalledWith({
        id: 'vec1',
        metadata: { type: 'updated' },
      });
    });

    it('should update metadata for multiple records', async () => {
      await adapter.connect();
      mockIndex.update.mockResolvedValue({});

      await adapter.updateMetadata('test-index', [
        { id: 'vec1', metadata: { type: 'updated1' } },
        { id: 'vec2', metadata: { type: 'updated2' } },
      ]);

      expect(mockIndex.update).toHaveBeenCalledTimes(2);
      expect(mockIndex.update).toHaveBeenNthCalledWith(1, {
        id: 'vec1',
        metadata: { type: 'updated1' },
      });
      expect(mockIndex.update).toHaveBeenNthCalledWith(2, {
        id: 'vec2',
        metadata: { type: 'updated2' },
      });
    });

    it('should wrap errors with context', async () => {
      await adapter.connect();
      const mockError = new Error('API error');
      mockIndex.update.mockRejectedValue(mockError);

      await expect(
        adapter.updateMetadata('test-index', [
          { id: 'vec1', metadata: { type: 'updated' } },
        ])
      ).rejects.toThrow(
        'Failed to update metadata in Pinecone index test-index'
      );
    });
  });
});
