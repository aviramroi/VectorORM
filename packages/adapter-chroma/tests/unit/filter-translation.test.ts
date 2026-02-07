import { describe, it, expect, beforeEach } from 'vitest';
import { ChromaAdapter } from '../../src/chroma-adapter';
import type { UniversalFilter } from '@vectororm/core';

describe('ChromaAdapter - Filter Translation', () => {
  let adapter: ChromaAdapter;

  beforeEach(() => {
    adapter = new ChromaAdapter({
      host: 'localhost',
      port: 8000,
    });
  });

  describe('basic operators', () => {
    it('should translate eq operator', () => {
      const filter: UniversalFilter = {
        field: 'category',
        op: 'eq',
        value: 'test',
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        category: { $eq: 'test' },
      });
    });

    it('should translate ne operator', () => {
      const filter: UniversalFilter = {
        field: 'status',
        op: 'ne',
        value: 'deleted',
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        status: { $ne: 'deleted' },
      });
    });

    it('should translate gt operator', () => {
      const filter: UniversalFilter = {
        field: 'score',
        op: 'gt',
        value: 0.5,
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        score: { $gt: 0.5 },
      });
    });

    it('should translate gte operator', () => {
      const filter: UniversalFilter = {
        field: 'score',
        op: 'gte',
        value: 0.5,
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        score: { $gte: 0.5 },
      });
    });

    it('should translate lt operator', () => {
      const filter: UniversalFilter = {
        field: 'price',
        op: 'lt',
        value: 100,
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        price: { $lt: 100 },
      });
    });

    it('should translate lte operator', () => {
      const filter: UniversalFilter = {
        field: 'price',
        op: 'lte',
        value: 100,
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        price: { $lte: 100 },
      });
    });

    it('should translate in operator', () => {
      const filter: UniversalFilter = {
        field: 'category',
        op: 'in',
        value: ['cat1', 'cat2', 'cat3'],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        category: { $in: ['cat1', 'cat2', 'cat3'] },
      });
    });

    it('should translate nin operator', () => {
      const filter: UniversalFilter = {
        field: 'status',
        op: 'nin',
        value: ['deleted', 'archived'],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        status: { $nin: ['deleted', 'archived'] },
      });
    });
  });

  describe('compound filters', () => {
    it('should translate AND filter with two conditions', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'category', op: 'eq', value: 'test' },
          { field: 'status', op: 'eq', value: 'active' },
        ],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        $and: [
          { category: { $eq: 'test' } },
          { status: { $eq: 'active' } },
        ],
      });
    });

    it('should translate AND filter with multiple conditions', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'category', op: 'eq', value: 'test' },
          { field: 'status', op: 'eq', value: 'active' },
          { field: 'score', op: 'gte', value: 0.8 },
        ],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        $and: [
          { category: { $eq: 'test' } },
          { status: { $eq: 'active' } },
          { score: { $gte: 0.8 } },
        ],
      });
    });

    it('should translate OR filter with two conditions', () => {
      const filter: UniversalFilter = {
        or: [
          { field: 'category', op: 'eq', value: 'cat1' },
          { field: 'category', op: 'eq', value: 'cat2' },
        ],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        $or: [
          { category: { $eq: 'cat1' } },
          { category: { $eq: 'cat2' } },
        ],
      });
    });

    it('should translate OR filter with multiple conditions', () => {
      const filter: UniversalFilter = {
        or: [
          { field: 'category', op: 'eq', value: 'cat1' },
          { field: 'category', op: 'eq', value: 'cat2' },
          { field: 'category', op: 'eq', value: 'cat3' },
        ],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        $or: [
          { category: { $eq: 'cat1' } },
          { category: { $eq: 'cat2' } },
          { category: { $eq: 'cat3' } },
        ],
      });
    });
  });

  describe('nested compound filters', () => {
    it('should translate nested AND inside OR', () => {
      const filter: UniversalFilter = {
        or: [
          {
            and: [
              { field: 'category', op: 'eq', value: 'cat1' },
              { field: 'status', op: 'eq', value: 'active' },
            ],
          },
          {
            and: [
              { field: 'category', op: 'eq', value: 'cat2' },
              { field: 'status', op: 'eq', value: 'active' },
            ],
          },
        ],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        $or: [
          {
            $and: [
              { category: { $eq: 'cat1' } },
              { status: { $eq: 'active' } },
            ],
          },
          {
            $and: [
              { category: { $eq: 'cat2' } },
              { status: { $eq: 'active' } },
            ],
          },
        ],
      });
    });

    it('should translate nested OR inside AND', () => {
      const filter: UniversalFilter = {
        and: [
          {
            or: [
              { field: 'category', op: 'eq', value: 'cat1' },
              { field: 'category', op: 'eq', value: 'cat2' },
            ],
          },
          { field: 'status', op: 'eq', value: 'active' },
        ],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        $and: [
          {
            $or: [
              { category: { $eq: 'cat1' } },
              { category: { $eq: 'cat2' } },
            ],
          },
          { status: { $eq: 'active' } },
        ],
      });
    });

    it('should translate deeply nested filters', () => {
      const filter: UniversalFilter = {
        and: [
          {
            or: [
              { field: 'category', op: 'eq', value: 'cat1' },
              {
                and: [
                  { field: 'category', op: 'eq', value: 'cat2' },
                  { field: 'subcategory', op: 'eq', value: 'sub1' },
                ],
              },
            ],
          },
          { field: 'status', op: 'eq', value: 'active' },
        ],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        $and: [
          {
            $or: [
              { category: { $eq: 'cat1' } },
              {
                $and: [
                  { category: { $eq: 'cat2' } },
                  { subcategory: { $eq: 'sub1' } },
                ],
              },
            ],
          },
          { status: { $eq: 'active' } },
        ],
      });
    });
  });

  describe('complex value types', () => {
    it('should handle string values', () => {
      const filter: UniversalFilter = {
        field: 'name',
        op: 'eq',
        value: 'test string',
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        name: { $eq: 'test string' },
      });
    });

    it('should handle number values', () => {
      const filter: UniversalFilter = {
        field: 'age',
        op: 'gte',
        value: 18,
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        age: { $gte: 18 },
      });
    });

    it('should handle boolean values', () => {
      const filter: UniversalFilter = {
        field: 'active',
        op: 'eq',
        value: true,
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        active: { $eq: true },
      });
    });

    it('should handle array values with in operator', () => {
      const filter: UniversalFilter = {
        field: 'tags',
        op: 'in',
        value: [1, 2, 3],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        tags: { $in: [1, 2, 3] },
      });
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported operator', () => {
      const filter: any = {
        field: 'name',
        op: 'unsupported',
        value: 'test',
      };

      expect(() => adapter.translateFilter(filter)).toThrow(
        'Unsupported filter operator: unsupported'
      );
    });

    it('should include filter in error cause', () => {
      const filter: any = {
        field: 'name',
        op: 'invalid',
        value: 'test',
      };

      try {
        adapter.translateFilter(filter);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Unsupported filter operator');
        expect(error.cause).toBeDefined();
        expect(error.cause.filter).toEqual(filter);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty AND array', () => {
      const filter: UniversalFilter = {
        and: [],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        $and: [],
      });
    });

    it('should handle empty OR array', () => {
      const filter: UniversalFilter = {
        or: [],
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        $or: [],
      });
    });

    it('should handle null values', () => {
      const filter: UniversalFilter = {
        field: 'deleted_at',
        op: 'eq',
        value: null,
      };

      const result = adapter.translateFilter(filter);
      expect(result).toEqual({
        deleted_at: { $eq: null },
      });
    });
  });
});
