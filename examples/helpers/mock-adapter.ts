/**
 * In-memory VectorDBAdapter for examples.
 * Stores vectors in memory — no external services required.
 */
import { VectorDBAdapter } from '../../packages/core/src/adapters/vector-db-adapter';
import type { VectorRecord, SearchResult } from '../../packages/core/src/types';
import type { UniversalFilter } from '../../packages/core/src/filters/types';
import type { CollectionStats, MetadataUpdate, DistanceMetric } from '../../packages/core/src/adapters/types';

interface Collection {
  dimension: number;
  metric: DistanceMetric;
  records: Map<string, VectorRecord>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function matchesFilter(record: VectorRecord, filter: UniversalFilter): boolean {
  if ('and' in filter) {
    return (filter as any).and.every((f: UniversalFilter) => matchesFilter(record, f));
  }
  if ('or' in filter) {
    return (filter as any).or.some((f: UniversalFilter) => matchesFilter(record, f));
  }
  const cond = filter as { field: string; op: string; value: any };
  const val = record.metadata[cond.field];
  switch (cond.op) {
    case 'eq': return val === cond.value;
    case 'neq': return val !== cond.value;
    case 'gt': return val > cond.value;
    case 'gte': return val >= cond.value;
    case 'lt': return val < cond.value;
    case 'lte': return val <= cond.value;
    case 'in': return Array.isArray(cond.value) && cond.value.includes(val);
    case 'nin': return Array.isArray(cond.value) && !cond.value.includes(val);
    case 'contains': return typeof val === 'string' && val.includes(cond.value);
    case 'exists': return val !== undefined;
    default: return true;
  }
}

export class InMemoryAdapter extends VectorDBAdapter {
  private collections = new Map<string, Collection>();

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async isConnected(): Promise<boolean> { return true; }

  async createCollection(name: string, dimension: number, metric?: DistanceMetric): Promise<void> {
    this.collections.set(name, { dimension, metric: metric ?? 'cosine', records: new Map() });
  }

  async deleteCollection(name: string): Promise<void> {
    this.collections.delete(name);
  }

  async collectionExists(name: string): Promise<boolean> {
    return this.collections.has(name);
  }

  async getCollectionStats(name: string): Promise<CollectionStats> {
    const col = this.collections.get(name);
    return { vectorCount: col?.records.size ?? 0, dimension: col?.dimension ?? 0 };
  }

  async upsert(collection: string, records: VectorRecord[]): Promise<void> {
    const col = this.collections.get(collection);
    if (!col) throw new Error(`Collection '${collection}' not found`);
    for (const r of records) {
      col.records.set(r.id, { ...r });
    }
  }

  async fetch(collection: string, ids: string[]): Promise<VectorRecord[]> {
    const col = this.collections.get(collection);
    if (!col) return [];
    return ids.map((id) => col.records.get(id)).filter(Boolean) as VectorRecord[];
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    const col = this.collections.get(collection);
    if (!col) return;
    for (const id of ids) col.records.delete(id);
  }

  async updateMetadata(collection: string, updates: MetadataUpdate[]): Promise<void> {
    const col = this.collections.get(collection);
    if (!col) return;
    for (const update of updates) {
      const record = col.records.get(update.id);
      if (record) {
        record.metadata = { ...record.metadata, ...update.metadata };
      }
    }
  }

  async search(
    collection: string,
    queryVector: number[],
    options?: { topK?: number; filter?: UniversalFilter; includeMetadata?: boolean; includeValues?: boolean }
  ): Promise<SearchResult> {
    const col = this.collections.get(collection);
    if (!col) return { records: [] };

    let candidates = Array.from(col.records.values());

    if (options?.filter) {
      candidates = candidates.filter((r) => matchesFilter(r, options.filter!));
    }

    const scored = candidates.map((r) => ({
      ...r,
      score: cosineSimilarity(queryVector, r.embedding)
    }));

    scored.sort((a, b) => b.score - a.score);
    const topK = options?.topK ?? 10;

    return { records: scored.slice(0, topK) };
  }

  translateFilter(filter: UniversalFilter): any {
    return filter;
  }

  async *iterate(
    collection: string,
    options?: { batchSize?: number; filter?: UniversalFilter }
  ): AsyncIterableIterator<VectorRecord[]> {
    const col = this.collections.get(collection);
    if (!col) return;

    let records = Array.from(col.records.values());
    if (options?.filter) {
      records = records.filter((r) => matchesFilter(r, options.filter!));
    }

    const batchSize = options?.batchSize ?? 100;
    for (let i = 0; i < records.length; i += batchSize) {
      yield records.slice(i, i + batchSize);
    }
  }

  supportsMetadataUpdate(): boolean { return true; }
  supportsFiltering(): boolean { return true; }
  supportsBatchOperations(): boolean { return true; }
}
