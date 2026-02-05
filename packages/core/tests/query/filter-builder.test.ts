import { describe, it, expect } from 'vitest';
import { FilterBuilder } from '../../src/query/filter-builder';
import type { UniversalFilter, FilterCondition, AndFilter } from '../../src/filters/types';

describe('FilterBuilder', () => {
  describe('empty builder', () => {
    it('should return undefined when no filters are added', () => {
      const builder = new FilterBuilder();
      const result = builder.build();

      expect(result).toBeUndefined();
    });
  });

  describe('single filter', () => {
    it('should return vertical filter as-is when only vertical filter is added', () => {
      const filter: FilterCondition = {
        field: 'doc_id',
        op: 'eq',
        value: 'doc123'
      };

      const builder = new FilterBuilder();
      const result = builder.withVerticalFilter(filter).build();

      expect(result).toEqual(filter);
    });

    it('should return horizontal filter as-is when only horizontal filter is added', () => {
      const filter: FilterCondition = {
        field: 'theme',
        op: 'eq',
        value: 'legal'
      };

      const builder = new FilterBuilder();
      const result = builder.withHorizontalFilter(filter).build();

      expect(result).toEqual(filter);
    });
  });

  describe('multiple filters', () => {
    it('should combine vertical and horizontal filters with AND', () => {
      const verticalFilter: FilterCondition = {
        field: 'doc_id',
        op: 'eq',
        value: 'doc123'
      };

      const horizontalFilter: FilterCondition = {
        field: 'theme',
        op: 'eq',
        value: 'legal'
      };

      const builder = new FilterBuilder();
      const result = builder
        .withVerticalFilter(verticalFilter)
        .withHorizontalFilter(horizontalFilter)
        .build() as AndFilter;

      expect(result).toHaveProperty('and');
      expect(result.and).toHaveLength(2);
      expect(result.and).toContainEqual(verticalFilter);
      expect(result.and).toContainEqual(horizontalFilter);
    });

    it('should combine all three filter types with AND', () => {
      const verticalFilter: FilterCondition = {
        field: 'doc_id',
        op: 'eq',
        value: 'doc123'
      };

      const horizontalFilter: FilterCondition = {
        field: 'theme',
        op: 'eq',
        value: 'legal'
      };

      const customFilter: FilterCondition = {
        field: 'author',
        op: 'eq',
        value: 'John Doe'
      };

      const builder = new FilterBuilder();
      const result = builder
        .withVerticalFilter(verticalFilter)
        .withHorizontalFilter(horizontalFilter)
        .withCustomFilter(customFilter)
        .build() as AndFilter;

      expect(result).toHaveProperty('and');
      expect(result.and).toHaveLength(3);
      expect(result.and).toContainEqual(verticalFilter);
      expect(result.and).toContainEqual(horizontalFilter);
      expect(result.and).toContainEqual(customFilter);
    });
  });

  describe('shorthand filters', () => {
    it('should normalize shorthand filters before combining', () => {
      const shorthandVertical = { doc_id: 'doc123' };
      const shorthandHorizontal = { year__gte: 2023 };

      const builder = new FilterBuilder();
      const result = builder
        .withVerticalFilter(shorthandVertical)
        .withHorizontalFilter(shorthandHorizontal)
        .build() as AndFilter;

      expect(result).toHaveProperty('and');
      expect(result.and).toHaveLength(2);

      // Verify normalized format
      expect(result.and[0]).toEqual({
        field: 'doc_id',
        op: 'eq',
        value: 'doc123'
      });
      expect(result.and[1]).toEqual({
        field: 'year',
        op: 'gte',
        value: 2023
      });
    });
  });
});
