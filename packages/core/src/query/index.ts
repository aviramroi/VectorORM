/**
 * Query Composition Layer
 *
 * Exports all query-related types, interfaces, and utilities.
 */

export type {
  RetrievalParams,
  RetrievalResult,
  SearchOptions,
  GroupedResults,
} from './types';

export { FilterBuilder } from './filter-builder';
export { RAGQueryComposer } from './rag-query-composer';
