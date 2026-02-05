import { describe, it, expect } from 'vitest';
import {
  VectorDBAdapter,
  CollectionStats,
  MetadataUpdate,
  DistanceMetric
} from '../../src/adapters';
import type { VectorRecord, SearchResult } from '../../src/types';
import type { UniversalFilter } from '../../src/filters';

/**
 * MockAdapter for testing VectorDBAdapter interface.
 *
 * All methods throw by default to test abstract interface.
 */
class MockAdapter extends VectorDBAdapter {
  async connect(): Promise<void> {
    throw new Error('Not implemented');
  }

  async disconnect(): Promise<void> {
    throw new Error('Not implemented');
  }

  async isConnected(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async createCollection(
    name: string,
    dimension: number,
    metric?: DistanceMetric
  ): Promise<void> {
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

  async updateMetadata(
    collection: string,
    updates: MetadataUpdate[]
  ): Promise<void> {
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
}

describe('VectorDBAdapter', () => {
  it('should be extendable as abstract class', () => {
    const adapter = new MockAdapter();
    expect(adapter).toBeInstanceOf(VectorDBAdapter);
  });

  it('should define all required abstract methods', () => {
    const adapter = new MockAdapter();

    // Connection methods
    expect(adapter.connect).toBeDefined();
    expect(adapter.disconnect).toBeDefined();
    expect(adapter.isConnected).toBeDefined();

    // Collection methods
    expect(adapter.createCollection).toBeDefined();
    expect(adapter.deleteCollection).toBeDefined();
    expect(adapter.collectionExists).toBeDefined();
    expect(adapter.getCollectionStats).toBeDefined();

    // Vector operations
    expect(adapter.upsert).toBeDefined();
    expect(adapter.fetch).toBeDefined();
    expect(adapter.delete).toBeDefined();
    expect(adapter.updateMetadata).toBeDefined();
    expect(adapter.search).toBeDefined();

    // Translation
    expect(adapter.translateFilter).toBeDefined();

    // Iteration
    expect(adapter.iterate).toBeDefined();
  });

  it('should have default capability flags', () => {
    const adapter = new MockAdapter();

    // Default capabilities (all false unless DB supports them)
    expect(adapter.supportsMetadataUpdate()).toBe(false);
    expect(adapter.supportsFiltering()).toBe(false);
    expect(adapter.supportsBatchOperations()).toBe(false);
  });
});
