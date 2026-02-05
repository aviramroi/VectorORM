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
  });
});
