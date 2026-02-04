/**
 * Universal filter language for database-agnostic queries.
 *
 * Filters are expressed in a standard format, then translated
 * to native database syntax by each adapter.
 */

/**
 * Supported filter operators.
 */
export type FilterOperator =
  | 'eq'       // Equals
  | 'neq'      // Not equals
  | 'in'       // In list
  | 'nin'      // Not in list
  | 'gt'       // Greater than
  | 'gte'      // Greater than or equal
  | 'lt'       // Less than
  | 'lte'      // Less than or equal
  | 'contains' // Contains substring
  | 'exists';  // Field exists

/**
 * Basic filter condition.
 */
export interface FilterCondition {
  field: string;
  op: FilterOperator;
  value: any;
}

/**
 * Compound AND filter (all conditions must match).
 */
export interface AndFilter {
  and: UniversalFilter[];
}

/**
 * Compound OR filter (any condition must match).
 */
export interface OrFilter {
  or: UniversalFilter[];
}

/**
 * Universal filter - can be a simple condition or compound.
 */
export type UniversalFilter = FilterCondition | AndFilter | OrFilter;

/**
 * Shorthand filter format (user-friendly).
 *
 * Examples:
 * - {region: "ny"} → {field: "region", op: "eq", value: "ny"}
 * - {year__gte: 2023} → {field: "year", op: "gte", value: 2023}
 * - {region: "ny", year__gte: 2023} → {and: [...]}
 */
export type ShorthandFilter = Record<string, any>;
