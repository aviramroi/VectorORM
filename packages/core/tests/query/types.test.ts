/**
 * Tests for Query Composition Layer types.
 *
 * Following TDD:
 * 1. Write tests first (they will fail)
 * 2. Implement minimal code to pass
 * 3. Verify all tests pass
 */

import { describe, it, expect } from 'vitest';
import type {
  RetrievalParams,
  RetrievalResult,
  SearchOptions,
  GroupedResults,
} from '../../src/query/types';
import type { VectorRecord } from '../../src/types/vector-record';
import type { UniversalFilter } from '../../src/filters/types';

describe('Query Types', () => {
  describe('RetrievalParams', () => {
    it('should accept basic retrieval parameters', () => {
      const params: RetrievalParams = {
        query: 'search text',
        collection: 'test_collection',
        topK: 10,
      };

      expect(params.query).toBe('search text');
      expect(params.collection).toBe('test_collection');
      expect(params.topK).toBe(10);
    });

    it('should accept vertical filters', () => {
      const verticalFilter: UniversalFilter = {
        field: '__v_doc_id',
        op: 'eq',
        value: 'doc123',
      };

      const params: RetrievalParams = {
        query: 'search text',
        collection: 'test_collection',
        topK: 10,
        verticalFilters: verticalFilter,
      };

      expect(params.verticalFilters).toEqual(verticalFilter);
    });

    it('should accept horizontal filters', () => {
      const horizontalFilter: UniversalFilter = {
        field: '__h_theme',
        op: 'eq',
        value: 'legal',
      };

      const params: RetrievalParams = {
        query: 'search text',
        collection: 'test_collection',
        topK: 10,
        horizontalFilters: horizontalFilter,
      };

      expect(params.horizontalFilters).toEqual(horizontalFilter);
    });

    it('should accept custom filters', () => {
      const customFilter: UniversalFilter = {
        field: 'custom_field',
        op: 'gte',
        value: 100,
      };

      const params: RetrievalParams = {
        query: 'search text',
        collection: 'test_collection',
        topK: 10,
        customFilters: customFilter,
      };

      expect(params.customFilters).toEqual(customFilter);
    });

    it('should accept includeEmbeddings flag', () => {
      const params: RetrievalParams = {
        query: 'search text',
        collection: 'test_collection',
        topK: 10,
        includeEmbeddings: true,
      };

      expect(params.includeEmbeddings).toBe(true);
    });

    it('should accept all filter types and includeEmbeddings together', () => {
      const verticalFilter: UniversalFilter = {
        field: '__v_doc_id',
        op: 'eq',
        value: 'doc123',
      };
      const horizontalFilter: UniversalFilter = {
        field: '__h_theme',
        op: 'eq',
        value: 'legal',
      };
      const customFilter: UniversalFilter = {
        field: 'year',
        op: 'gte',
        value: 2020,
      };

      const params: RetrievalParams = {
        query: 'search text',
        collection: 'test_collection',
        topK: 10,
        verticalFilters: verticalFilter,
        horizontalFilters: horizontalFilter,
        customFilters: customFilter,
        includeEmbeddings: true,
      };

      expect(params.verticalFilters).toEqual(verticalFilter);
      expect(params.horizontalFilters).toEqual(horizontalFilter);
      expect(params.customFilters).toEqual(customFilter);
      expect(params.includeEmbeddings).toBe(true);
    });
  });

  describe('RetrievalResult', () => {
    it('should have correct structure with records and filters', () => {
      const records: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { __v_doc_id: 'doc123' },
          text: 'sample text',
          score: 0.95,
        },
      ];

      const verticalFilter: UniversalFilter = {
        field: '__v_doc_id',
        op: 'eq',
        value: 'doc123',
      };

      const result: RetrievalResult = {
        records,
        query: 'search text',
        filtersApplied: {
          vertical: verticalFilter,
        },
      };

      expect(result.records).toEqual(records);
      expect(result.query).toBe('search text');
      expect(result.filtersApplied.vertical).toEqual(verticalFilter);
    });

    it('should support filtersApplied with vertical filter', () => {
      const verticalFilter: UniversalFilter = {
        field: '__v_doc_id',
        op: 'eq',
        value: 'doc123',
      };

      const result: RetrievalResult = {
        records: [],
        query: 'test query',
        filtersApplied: {
          vertical: verticalFilter,
        },
      };

      expect(result.filtersApplied.vertical).toEqual(verticalFilter);
      expect(result.filtersApplied.horizontal).toBeUndefined();
      expect(result.filtersApplied.custom).toBeUndefined();
    });

    it('should support filtersApplied with horizontal filter', () => {
      const horizontalFilter: UniversalFilter = {
        field: '__h_theme',
        op: 'eq',
        value: 'legal',
      };

      const result: RetrievalResult = {
        records: [],
        query: 'test query',
        filtersApplied: {
          horizontal: horizontalFilter,
        },
      };

      expect(result.filtersApplied.horizontal).toEqual(horizontalFilter);
      expect(result.filtersApplied.vertical).toBeUndefined();
      expect(result.filtersApplied.custom).toBeUndefined();
    });

    it('should support filtersApplied with custom filter', () => {
      const customFilter: UniversalFilter = {
        field: 'region',
        op: 'eq',
        value: 'US',
      };

      const result: RetrievalResult = {
        records: [],
        query: 'test query',
        filtersApplied: {
          custom: customFilter,
        },
      };

      expect(result.filtersApplied.custom).toEqual(customFilter);
      expect(result.filtersApplied.vertical).toBeUndefined();
      expect(result.filtersApplied.horizontal).toBeUndefined();
    });

    it('should support filtersApplied with all three filter types', () => {
      const verticalFilter: UniversalFilter = {
        field: '__v_doc_id',
        op: 'eq',
        value: 'doc123',
      };
      const horizontalFilter: UniversalFilter = {
        field: '__h_theme',
        op: 'eq',
        value: 'legal',
      };
      const customFilter: UniversalFilter = {
        field: 'year',
        op: 'gte',
        value: 2020,
      };

      const result: RetrievalResult = {
        records: [],
        query: 'test query',
        filtersApplied: {
          vertical: verticalFilter,
          horizontal: horizontalFilter,
          custom: customFilter,
        },
      };

      expect(result.filtersApplied.vertical).toEqual(verticalFilter);
      expect(result.filtersApplied.horizontal).toEqual(horizontalFilter);
      expect(result.filtersApplied.custom).toEqual(customFilter);
    });
  });

  describe('SearchOptions', () => {
    it('should accept topK', () => {
      const options: SearchOptions = {
        topK: 10,
      };

      expect(options.topK).toBe(10);
    });

    it('should accept UniversalFilter for filter field', () => {
      const filter: UniversalFilter = {
        field: '__v_doc_id',
        op: 'eq',
        value: 'doc123',
      };

      const options: SearchOptions = {
        topK: 10,
        filter,
      };

      expect(options.filter).toEqual(filter);
    });

    it('should accept includeEmbeddings flag', () => {
      const options: SearchOptions = {
        topK: 10,
        includeEmbeddings: true,
      };

      expect(options.includeEmbeddings).toBe(true);
    });

    it('should accept all options together', () => {
      const filter: UniversalFilter = {
        field: 'year',
        op: 'gte',
        value: 2020,
      };

      const options: SearchOptions = {
        topK: 10,
        filter,
        includeEmbeddings: false,
      };

      expect(options.topK).toBe(10);
      expect(options.filter).toEqual(filter);
      expect(options.includeEmbeddings).toBe(false);
    });
  });

  describe('GroupedResults', () => {
    it('should group records by vertical dimension (__v_doc_id)', () => {
      const records: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { __v_doc_id: 'doc1' },
          text: 'text 1',
        },
        {
          id: 'rec2',
          embedding: [0.2, 0.3, 0.4],
          metadata: { __v_doc_id: 'doc1' },
          text: 'text 2',
        },
        {
          id: 'rec3',
          embedding: [0.3, 0.4, 0.5],
          metadata: { __v_doc_id: 'doc2' },
          text: 'text 3',
        },
      ];

      const grouped: GroupedResults = {
        vertical: new Map([
          ['doc1', [records[0], records[1]]],
          ['doc2', [records[2]]],
        ]),
        horizontal: new Map(),
      };

      expect(grouped.vertical.get('doc1')).toEqual([records[0], records[1]]);
      expect(grouped.vertical.get('doc2')).toEqual([records[2]]);
      expect(grouped.vertical.size).toBe(2);
    });

    it('should group records by horizontal dimension (__h_theme)', () => {
      const records: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { __h_theme: 'legal' },
          text: 'text 1',
        },
        {
          id: 'rec2',
          embedding: [0.2, 0.3, 0.4],
          metadata: { __h_theme: 'finance' },
          text: 'text 2',
        },
        {
          id: 'rec3',
          embedding: [0.3, 0.4, 0.5],
          metadata: { __h_theme: 'legal' },
          text: 'text 3',
        },
      ];

      const grouped: GroupedResults = {
        vertical: new Map(),
        horizontal: new Map([
          ['legal', [records[0], records[2]]],
          ['finance', [records[1]]],
        ]),
      };

      expect(grouped.horizontal.get('legal')).toEqual([records[0], records[2]]);
      expect(grouped.horizontal.get('finance')).toEqual([records[1]]);
      expect(grouped.horizontal.size).toBe(2);
    });

    it('should handle records with both vertical and horizontal metadata', () => {
      const records: VectorRecord[] = [
        {
          id: 'rec1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { __v_doc_id: 'doc1', __h_theme: 'legal' },
          text: 'text 1',
        },
        {
          id: 'rec2',
          embedding: [0.2, 0.3, 0.4],
          metadata: { __v_doc_id: 'doc1', __h_theme: 'finance' },
          text: 'text 2',
        },
      ];

      const grouped: GroupedResults = {
        vertical: new Map([['doc1', [records[0], records[1]]]]),
        horizontal: new Map([
          ['legal', [records[0]]],
          ['finance', [records[1]]],
        ]),
      };

      expect(grouped.vertical.get('doc1')).toEqual([records[0], records[1]]);
      expect(grouped.horizontal.get('legal')).toEqual([records[0]]);
      expect(grouped.horizontal.get('finance')).toEqual([records[1]]);
    });

    it('should handle empty groups when records lack metadata', () => {
      const grouped: GroupedResults = {
        vertical: new Map(),
        horizontal: new Map(),
      };

      expect(grouped.vertical.size).toBe(0);
      expect(grouped.horizontal.size).toBe(0);
    });
  });
});
