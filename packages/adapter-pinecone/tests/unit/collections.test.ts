import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';
import { Pinecone } from '@pinecone-database/pinecone';

// Mock the Pinecone SDK
vi.mock('@pinecone-database/pinecone', () => {
  return {
    Pinecone: vi.fn(),
  };
});

describe('PineconeAdapter - Collections', () => {
  let adapter: PineconeAdapter;
  let mockClient: any;
  let mockIndex: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock client
    mockIndex = {
      describeIndexStats: vi.fn(),
    };

    mockClient = {
      listIndexes: vi.fn(),
      createIndex: vi.fn(),
      deleteIndex: vi.fn(),
      index: vi.fn(() => mockIndex),
    };

    // Mock Pinecone constructor
    (Pinecone as any).mockImplementation(() => mockClient);

    adapter = new PineconeAdapter({
      apiKey: 'test-key',
    });
  });

  describe('createCollection', () => {
    it('should throw if not connected', async () => {
      await expect(
        adapter.createCollection('test-index', 384)
      ).rejects.toThrow('Not connected');
    });

    it('should create collection with dimension and metric', async () => {
      await adapter.connect();
      mockClient.createIndex.mockResolvedValue({});

      await adapter.createCollection('test-index', 384, 'cosine');

      expect(mockClient.createIndex).toHaveBeenCalledWith({
        name: 'test-index',
        dimension: 384,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
    });

    it('should default to cosine metric', async () => {
      await adapter.connect();
      mockClient.createIndex.mockResolvedValue({});

      await adapter.createCollection('test-index', 384);

      expect(mockClient.createIndex).toHaveBeenCalledWith({
        name: 'test-index',
        dimension: 384,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
    });

    it('should map dotProduct to dotproduct', async () => {
      await adapter.connect();
      mockClient.createIndex.mockResolvedValue({});

      await adapter.createCollection('test-index', 384, 'dotProduct');

      expect(mockClient.createIndex).toHaveBeenCalledWith({
        name: 'test-index',
        dimension: 384,
        metric: 'dotproduct',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
    });

    it('should wrap errors with context', async () => {
      await adapter.connect();
      const mockError = new Error('API error');
      mockClient.createIndex.mockRejectedValue(mockError);

      await expect(
        adapter.createCollection('test-index', 384)
      ).rejects.toThrow('Failed to create Pinecone index test-index');
    });
  });

  describe('deleteCollection', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.deleteCollection('test-index')).rejects.toThrow(
        'Not connected'
      );
    });

    it('should delete collection', async () => {
      await adapter.connect();
      mockClient.deleteIndex.mockResolvedValue({});

      await adapter.deleteCollection('test-index');

      expect(mockClient.deleteIndex).toHaveBeenCalledWith('test-index');
    });

    it('should wrap errors with context', async () => {
      await adapter.connect();
      const mockError = new Error('API error');
      mockClient.deleteIndex.mockRejectedValue(mockError);

      await expect(adapter.deleteCollection('test-index')).rejects.toThrow(
        'Failed to delete Pinecone index test-index'
      );
    });
  });

  describe('collectionExists', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.collectionExists('test-index')).rejects.toThrow(
        'Not connected'
      );
    });

    it('should return true if index exists', async () => {
      await adapter.connect();
      mockClient.listIndexes.mockResolvedValue({
        indexes: [{ name: 'test-index' }, { name: 'other-index' }],
      });

      const exists = await adapter.collectionExists('test-index');

      expect(exists).toBe(true);
      expect(mockClient.listIndexes).toHaveBeenCalled();
    });

    it('should return false if index does not exist', async () => {
      await adapter.connect();
      mockClient.listIndexes.mockResolvedValue({
        indexes: [{ name: 'other-index' }],
      });

      const exists = await adapter.collectionExists('test-index');

      expect(exists).toBe(false);
    });

    it('should return false if indexes array is undefined', async () => {
      await adapter.connect();
      mockClient.listIndexes.mockResolvedValue({});

      const exists = await adapter.collectionExists('test-index');

      expect(exists).toBe(false);
    });

    it('should wrap errors with context', async () => {
      await adapter.connect();
      const mockError = new Error('API error');
      mockClient.listIndexes.mockRejectedValue(mockError);

      await expect(adapter.collectionExists('test-index')).rejects.toThrow(
        'Failed to check if Pinecone index test-index exists'
      );
    });
  });

  describe('getCollectionStats', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.getCollectionStats('test-index')).rejects.toThrow(
        'Not connected'
      );
    });

    it('should return collection stats', async () => {
      await adapter.connect();
      mockIndex.describeIndexStats.mockResolvedValue({
        totalRecordCount: 1000,
        dimension: 384,
        namespaces: {},
      });

      const stats = await adapter.getCollectionStats('test-index');

      expect(stats).toEqual({
        vectorCount: 1000,
        dimension: 384,
        metric: 'cosine',
        totalRecordCount: 1000,
        namespaces: {},
      });
      expect(mockClient.index).toHaveBeenCalledWith('test-index');
      expect(mockIndex.describeIndexStats).toHaveBeenCalled();
    });

    it('should default to 0 for missing values', async () => {
      await adapter.connect();
      mockIndex.describeIndexStats.mockResolvedValue({});

      const stats = await adapter.getCollectionStats('test-index');

      expect(stats.vectorCount).toBe(0);
      expect(stats.dimension).toBe(0);
      expect(stats.metric).toBe('cosine');
    });

    it('should wrap errors with context', async () => {
      await adapter.connect();
      const mockError = new Error('API error');
      mockIndex.describeIndexStats.mockRejectedValue(mockError);

      await expect(adapter.getCollectionStats('test-index')).rejects.toThrow(
        'Failed to get Pinecone index stats for test-index'
      );
    });
  });
});
