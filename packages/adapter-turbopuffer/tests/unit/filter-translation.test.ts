import { describe, it, expect, beforeEach } from 'vitest';
import { TurbopufferAdapter } from '../../src/turbopuffer-adapter';
import type { UniversalFilter } from '@vectororm/core';

describe('TurbopufferAdapter - Filter Translation', () => {
  let adapter: TurbopufferAdapter;

  beforeEach(() => {
    adapter = new TurbopufferAdapter({
      apiKey: 'test-api-key',
    });
  });

  describe('Basic operators', () => {
    it('should translate eq operator', () => {
      const filter: UniversalFilter = {
        field: 'region',
        op: 'eq',
        value: 'ny',
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['region', 'Eq', 'ny']);
    });

    it('should translate ne operator', () => {
      const filter: UniversalFilter = {
        field: 'status',
        op: 'ne',
        value: 'inactive',
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['status', 'Neq', 'inactive']);
    });

    it('should translate gt operator', () => {
      const filter: UniversalFilter = {
        field: 'year',
        op: 'gt',
        value: 2020,
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['year', 'Gt', 2020]);
    });

    it('should translate gte operator', () => {
      const filter: UniversalFilter = {
        field: 'score',
        op: 'gte',
        value: 0.5,
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['score', 'Gte', 0.5]);
    });

    it('should translate lt operator', () => {
      const filter: UniversalFilter = {
        field: 'price',
        op: 'lt',
        value: 100,
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['price', 'Lt', 100]);
    });

    it('should translate lte operator', () => {
      const filter: UniversalFilter = {
        field: 'age',
        op: 'lte',
        value: 65,
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['age', 'Lte', 65]);
    });

    it('should translate in operator', () => {
      const filter: UniversalFilter = {
        field: 'category',
        op: 'in',
        value: ['tech', 'science', 'math'],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['category', 'In', ['tech', 'science', 'math']]);
    });

    it('should translate nin operator', () => {
      const filter: UniversalFilter = {
        field: 'status',
        op: 'nin',
        value: ['archived', 'deleted'],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['status', 'Nin', ['archived', 'deleted']]);
    });

    it('should throw on unsupported operator', () => {
      const filter: UniversalFilter = {
        field: 'name',
        op: 'contains' as any,
        value: 'test',
      };

      expect(() => adapter.translateFilter(filter)).toThrow(
        'Unsupported filter operator: contains'
      );
    });
  });

  describe('Compound AND filters', () => {
    it('should translate simple AND filter', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'region', op: 'eq', value: 'ny' },
          { field: 'year', op: 'gt', value: 2020 },
        ],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual([
        'And',
        [
          ['region', 'Eq', 'ny'],
          ['year', 'Gt', 2020],
        ],
      ]);
    });

    it('should translate AND filter with multiple conditions', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'status', op: 'eq', value: 'active' },
          { field: 'score', op: 'gte', value: 0.8 },
          { field: 'category', op: 'in', value: ['A', 'B'] },
        ],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual([
        'And',
        [
          ['status', 'Eq', 'active'],
          ['score', 'Gte', 0.8],
          ['category', 'In', ['A', 'B']],
        ],
      ]);
    });

    it('should handle nested AND filters', () => {
      const filter: UniversalFilter = {
        and: [
          {
            and: [
              { field: 'region', op: 'eq', value: 'ny' },
              { field: 'year', op: 'gt', value: 2020 },
            ],
          },
          { field: 'status', op: 'eq', value: 'active' },
        ],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual([
        'And',
        [
          [
            'And',
            [
              ['region', 'Eq', 'ny'],
              ['year', 'Gt', 2020],
            ],
          ],
          ['status', 'Eq', 'active'],
        ],
      ]);
    });
  });

  describe('Compound OR filters', () => {
    it('should translate simple OR filter', () => {
      const filter: UniversalFilter = {
        or: [
          { field: 'region', op: 'eq', value: 'ny' },
          { field: 'region', op: 'eq', value: 'ca' },
        ],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual([
        'Or',
        [
          ['region', 'Eq', 'ny'],
          ['region', 'Eq', 'ca'],
        ],
      ]);
    });

    it('should translate OR filter with multiple conditions', () => {
      const filter: UniversalFilter = {
        or: [
          { field: 'priority', op: 'eq', value: 'high' },
          { field: 'urgent', op: 'eq', value: true },
          { field: 'score', op: 'gt', value: 0.9 },
        ],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual([
        'Or',
        [
          ['priority', 'Eq', 'high'],
          ['urgent', 'Eq', true],
          ['score', 'Gt', 0.9],
        ],
      ]);
    });
  });

  describe('Mixed compound filters', () => {
    it('should translate AND with nested OR', () => {
      const filter: UniversalFilter = {
        and: [
          {
            or: [
              { field: 'region', op: 'eq', value: 'ny' },
              { field: 'region', op: 'eq', value: 'ca' },
            ],
          },
          { field: 'status', op: 'eq', value: 'active' },
        ],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual([
        'And',
        [
          [
            'Or',
            [
              ['region', 'Eq', 'ny'],
              ['region', 'Eq', 'ca'],
            ],
          ],
          ['status', 'Eq', 'active'],
        ],
      ]);
    });

    it('should translate OR with nested AND', () => {
      const filter: UniversalFilter = {
        or: [
          {
            and: [
              { field: 'region', op: 'eq', value: 'ny' },
              { field: 'year', op: 'gt', value: 2020 },
            ],
          },
          { field: 'priority', op: 'eq', value: 'high' },
        ],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual([
        'Or',
        [
          [
            'And',
            [
              ['region', 'Eq', 'ny'],
              ['year', 'Gt', 2020],
            ],
          ],
          ['priority', 'Eq', 'high'],
        ],
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty AND filter', () => {
      const filter: UniversalFilter = {
        and: [],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['And', []]);
    });

    it('should handle empty OR filter', () => {
      const filter: UniversalFilter = {
        or: [],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['Or', []]);
    });

    it('should handle filter with null value', () => {
      const filter: UniversalFilter = {
        field: 'deletedAt',
        op: 'eq',
        value: null,
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['deletedAt', 'Eq', null]);
    });

    it('should handle filter with boolean value', () => {
      const filter: UniversalFilter = {
        field: 'isActive',
        op: 'eq',
        value: true,
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['isActive', 'Eq', true]);
    });

    it('should handle filter with numeric zero', () => {
      const filter: UniversalFilter = {
        field: 'count',
        op: 'eq',
        value: 0,
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual(['count', 'Eq', 0]);
    });
  });
});
