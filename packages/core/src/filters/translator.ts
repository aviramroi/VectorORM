import type {
  UniversalFilter,
  FilterCondition,
  AndFilter,
  OrFilter,
  ShorthandFilter,
  FilterOperator
} from './types';

/**
 * Valid filter operators.
 */
const VALID_OPERATORS: FilterOperator[] = [
  'eq', 'neq', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists'
];

/**
 * Translates filters between formats and validates structure.
 */
export class FilterTranslator {
  /**
   * Normalize any filter input to standard UniversalFilter format.
   *
   * Handles:
   * - Standard format (pass through)
   * - Shorthand format (convert to standard)
   * - Operator suffixes (field__op syntax)
   */
  static normalize(input: ShorthandFilter | UniversalFilter): UniversalFilter {
    // Already standard format
    if (this.isStandardFormat(input)) {
      return input as UniversalFilter;
    }

    // Convert shorthand
    return this.fromShorthand(input as ShorthandFilter);
  }

  /**
   * Validate filter structure and operators.
   *
   * Throws error if filter is invalid.
   */
  static validate(filter: UniversalFilter): void {
    if (this.isCompound(filter)) {
      const compound = filter as AndFilter | OrFilter;
      const conditions = 'and' in compound ? compound.and : compound.or;

      if (!Array.isArray(conditions) || conditions.length === 0) {
        throw new Error('Compound filter must have at least one condition');
      }

      conditions.forEach(c => this.validate(c));
    } else {
      const condition = filter as FilterCondition;

      if (!condition.field || typeof condition.field !== 'string') {
        throw new Error('Filter field must be a non-empty string');
      }

      if (!VALID_OPERATORS.includes(condition.op)) {
        throw new Error(`Invalid filter operator: ${condition.op}`);
      }

      if (condition.value === undefined) {
        throw new Error('Filter value is required');
      }
    }
  }

  /**
   * Check if filter is compound (AND/OR).
   */
  static isCompound(filter: UniversalFilter): boolean {
    return 'and' in filter || 'or' in filter;
  }

  /**
   * Check if input is already in standard format.
   */
  private static isStandardFormat(input: any): boolean {
    if (!input || typeof input !== 'object') {
      return false;
    }

    // Check for compound filter
    if ('and' in input || 'or' in input) {
      return true;
    }

    // Check for filter condition
    if ('field' in input && 'op' in input && 'value' in input) {
      return true;
    }

    return false;
  }

  /**
   * Convert shorthand format to standard.
   */
  private static fromShorthand(shorthand: ShorthandFilter): UniversalFilter {
    const entries = Object.entries(shorthand);

    if (entries.length === 0) {
      throw new Error('Cannot convert empty shorthand filter object');
    }

    const conditions: FilterCondition[] = [];

    for (const [key, value] of entries) {
      // Parse field__op syntax
      let field: string;
      let op: FilterOperator;

      if (key.includes('__') && !key.startsWith('__')) {
        // Has operator suffix
        const lastIndex = key.lastIndexOf('__');
        field = key.substring(0, lastIndex);
        const extractedOp = key.substring(lastIndex + 2);

        if (!VALID_OPERATORS.includes(extractedOp as FilterOperator)) {
          throw new Error(`Invalid filter operator in shorthand: ${extractedOp}`);
        }

        op = extractedOp as FilterOperator;
      } else {
        // Implicit eq
        field = key;
        op = 'eq';
      }

      conditions.push({ field, op, value });
    }

    // Single condition - return as-is
    if (conditions.length === 1) {
      return conditions[0];
    }

    // Multiple conditions - wrap in AND
    return { and: conditions };
  }
}
