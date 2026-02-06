import { describe, it, expect, beforeEach } from 'vitest';
import { PineconeAdapter } from '../../src/pinecone-adapter';
import type { UniversalFilter } from '@glyph/core';

describe('PineconeAdapter - Filter Translation', () => {
  let adapter: PineconeAdapter;

  beforeEach(() => {
    adapter = new PineconeAdapter({
      apiKey: 'test-api-key',
      environment: 'test-env',
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

      expect(result).toEqual({
        region: { $eq: 'ny' },
      });
    });

    it('should translate ne operator', () => {
      const filter: UniversalFilter = {
        field: 'status',
        op: 'ne',
        value: 'inactive',
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual({
        status: { $ne: 'inactive' },
      });
    });

    it('should translate gt operator', () => {
      const filter: UniversalFilter = {
        field: 'year',
        op: 'gt',
        value: 2020,
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual({
        year: { $gt: 2020 },
      });
    });

    it('should translate gte operator', () => {
      const filter: UniversalFilter = {
        field: 'year',
        op: 'gte',
        value: 2020,
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual({
        year: { $gte: 2020 },
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
        field: 'region',
        op: 'in',
        value: ['ny', 'ca', 'tx'],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual({
        region: { $in: ['ny', 'ca', 'tx'] },
      });
    });

    it('should translate nin operator', () => {
      const filter: UniversalFilter = {
        field: 'region',
        op: 'nin',
        value: ['ak', 'hi'],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual({
        region: { $nin: ['ak', 'hi'] },
      });
    });
  });

  describe('Compound filters', () => {
    it('should translate AND compound filter', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'region', op: 'eq', value: 'ny' },
          { field: 'year', op: 'gte', value: 2020 },
        ],
      };

      const result = adapter.translateFilter(filter);

      expect(result).toEqual({
        $and: [
          { region: { $eq: 'ny' } },
          { year: { $gte: 2020 } },
        ],
      });
    });
  });

  describe('Unsupported operations', () => {
    it('should throw error for OR filter', () => {
      const filter: UniversalFilter = {
        or: [
          { field: 'region', op: 'eq', value: 'ny' },
          { field: 'region', op: 'eq', value: 'ca' },
        ],
      };

      expect(() => adapter.translateFilter(filter)).toThrow(
        'OR filters not yet supported in PineconeAdapter. See TECH_DEBT.md'
      );
    });

    it('should throw error for nested compound filters', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'region', op: 'eq', value: 'ny' },
          {
            and: [
              { field: 'year', op: 'gte', value: 2020 },
              { field: 'year', op: 'lte', value: 2023 },
            ],
          },
        ],
      };

      expect(() => adapter.translateFilter(filter)).toThrow(
        'Nested compound filters not yet supported in PineconeAdapter. See TECH_DEBT.md'
      );
    });
  });
});
