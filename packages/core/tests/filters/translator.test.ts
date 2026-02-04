import { describe, it, expect } from 'vitest';
import { FilterTranslator } from '../../src/filters/translator';
import type { UniversalFilter, FilterCondition } from '../../src/filters/types';

describe('FilterTranslator', () => {
  describe('normalize', () => {
    it('should pass through standard format', () => {
      const filter: FilterCondition = {
        field: 'region',
        op: 'eq',
        value: 'ny'
      };

      const normalized = FilterTranslator.normalize(filter);
      expect(normalized).toEqual(filter);
    });

    it('should convert shorthand with implicit eq', () => {
      const shorthand = { region: 'ny' };
      const normalized = FilterTranslator.normalize(shorthand);

      expect(normalized).toEqual({
        field: 'region',
        op: 'eq',
        value: 'ny'
      });
    });

    it('should convert shorthand with operator suffix', () => {
      const shorthand = { year__gte: 2023 };
      const normalized = FilterTranslator.normalize(shorthand);

      expect(normalized).toEqual({
        field: 'year',
        op: 'gte',
        value: 2023
      });
    });

    it('should convert multiple shorthand fields to AND', () => {
      const shorthand = {
        region: 'ny',
        year__gte: 2023
      };
      const normalized = FilterTranslator.normalize(shorthand);

      expect(normalized).toEqual({
        and: [
          { field: 'region', op: 'eq', value: 'ny' },
          { field: 'year', op: 'gte', value: 2023 }
        ]
      });
    });

    it('should preserve compound filters', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'region', op: 'eq', value: 'ny' },
          { field: 'year', op: 'gte', value: 2023 }
        ]
      };

      const normalized = FilterTranslator.normalize(filter);
      expect(normalized).toEqual(filter);
    });
  });

  describe('validate', () => {
    it('should accept valid filter condition', () => {
      const filter: FilterCondition = {
        field: 'test',
        op: 'eq',
        value: 'value'
      };

      expect(() => FilterTranslator.validate(filter)).not.toThrow();
    });

    it('should accept valid AND filter', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'a', op: 'eq', value: 1 },
          { field: 'b', op: 'gt', value: 2 }
        ]
      };

      expect(() => FilterTranslator.validate(filter)).not.toThrow();
    });

    it('should reject invalid operator', () => {
      const filter = {
        field: 'test',
        op: 'invalid',
        value: 'value'
      } as any;

      expect(() => FilterTranslator.validate(filter)).toThrow();
    });

    it('should reject empty field name', () => {
      const filter = {
        field: '',
        op: 'eq',
        value: 'value'
      } as FilterCondition;

      expect(() => FilterTranslator.validate(filter)).toThrow();
    });
  });

  describe('isCompound', () => {
    it('should return true for AND filter', () => {
      const filter: UniversalFilter = {
        and: [
          { field: 'test', op: 'eq', value: 1 }
        ]
      };

      expect(FilterTranslator.isCompound(filter)).toBe(true);
    });

    it('should return true for OR filter', () => {
      const filter: UniversalFilter = {
        or: [
          { field: 'test', op: 'eq', value: 1 }
        ]
      };

      expect(FilterTranslator.isCompound(filter)).toBe(true);
    });

    it('should return false for simple condition', () => {
      const filter: FilterCondition = {
        field: 'test',
        op: 'eq',
        value: 1
      };

      expect(FilterTranslator.isCompound(filter)).toBe(false);
    });
  });
});
