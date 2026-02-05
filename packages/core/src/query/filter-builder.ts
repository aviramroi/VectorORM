import type { UniversalFilter, AndFilter } from '../filters/types';
import { FilterTranslator } from '../filters/translator';

/**
 * FilterBuilder - Utility for combining multiple filters with fluent API.
 *
 * Provides a convenient way to combine vertical, horizontal, and custom filters
 * into a single UniversalFilter with AND logic.
 *
 * @example
 * ```typescript
 * const filter = new FilterBuilder()
 *   .withVerticalFilter({ field: 'doc_id', op: 'eq', value: 'doc123' })
 *   .withHorizontalFilter({ field: 'theme', op: 'eq', value: 'legal' })
 *   .build();
 * ```
 */
export class FilterBuilder {
  private verticalFilter?: UniversalFilter;
  private horizontalFilter?: UniversalFilter;
  private customFilter?: UniversalFilter;

  /**
   * Add a vertical (document-level) filter.
   *
   * @param filter - The vertical filter to add (standard or shorthand format)
   * @returns This builder for method chaining
   */
  withVerticalFilter(filter: UniversalFilter | Record<string, any>): this {
    this.verticalFilter = FilterTranslator.normalize(filter);
    return this;
  }

  /**
   * Add a horizontal (theme-level) filter.
   *
   * @param filter - The horizontal filter to add (standard or shorthand format)
   * @returns This builder for method chaining
   */
  withHorizontalFilter(filter: UniversalFilter | Record<string, any>): this {
    this.horizontalFilter = FilterTranslator.normalize(filter);
    return this;
  }

  /**
   * Add a custom user-defined filter.
   *
   * @param filter - The custom filter to add (standard or shorthand format)
   * @returns This builder for method chaining
   */
  withCustomFilter(filter: UniversalFilter | Record<string, any>): this {
    this.customFilter = FilterTranslator.normalize(filter);
    return this;
  }

  /**
   * Build the combined filter.
   *
   * Combination logic:
   * - If no filters: returns undefined
   * - If single filter: returns it directly
   * - If multiple filters: combines with AND logic
   *
   * @returns The combined filter, or undefined if no filters were added
   */
  build(): UniversalFilter | undefined {
    const filters: UniversalFilter[] = [];

    if (this.verticalFilter) {
      filters.push(this.verticalFilter);
    }

    if (this.horizontalFilter) {
      filters.push(this.horizontalFilter);
    }

    if (this.customFilter) {
      filters.push(this.customFilter);
    }

    // No filters
    if (filters.length === 0) {
      return undefined;
    }

    // Single filter - return as-is
    if (filters.length === 1) {
      return filters[0];
    }

    // Multiple filters - combine with AND
    return { and: filters } as AndFilter;
  }
}
