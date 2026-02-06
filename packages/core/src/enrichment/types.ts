/**
 * Types and interfaces for document enrichment operations.
 *
 * This module defines the configuration interfaces for various enrichment strategies:
 * - Vertical enrichment: Classify documents into business verticals
 * - Theme enrichment: Add thematic tags to documents
 * - Section enrichment: Structure documents into logical sections
 */

import type { UniversalFilter } from '../filters/types';
import type { ThemeClassifier } from './classifiers/theme-classifier';
import type { LLMClient } from '../llm/llm-client';

/**
 * Progress callback function for tracking enrichment operations.
 *
 * @param stats - Current enrichment statistics
 *
 * @example
 * ```typescript
 * const onProgress: ProgressCallback = (stats) => {
 *   console.log(`Processed: ${stats.recordsProcessed}/${stats.recordsProcessed + stats.recordsSkipped}`);
 *   console.log(`Updated: ${stats.recordsUpdated}`);
 * };
 * ```
 */
export type ProgressCallback = (stats: EnrichmentStats) => void;

/**
 * Statistics for an enrichment operation.
 *
 * Tracks the progress and outcome of enrichment operations,
 * including records processed, updated, skipped, and any errors encountered.
 *
 * @property recordsProcessed - Total number of records processed
 * @property recordsUpdated - Number of records successfully updated
 * @property recordsSkipped - Number of records skipped (e.g., filtered out)
 * @property timeMs - Total time taken in milliseconds
 * @property errors - Optional array of error messages encountered during enrichment
 *
 * @example
 * ```typescript
 * const stats: EnrichmentStats = {
 *   recordsProcessed: 100,
 *   recordsUpdated: 95,
 *   recordsSkipped: 5,
 *   timeMs: 1250,
 *   errors: ['Failed to classify record 42']
 * };
 * ```
 */
export interface EnrichmentStats {
  /**
   * Total number of records processed.
   */
  recordsProcessed: number;

  /**
   * Number of records successfully updated with enrichment data.
   */
  recordsUpdated: number;

  /**
   * Number of records skipped (e.g., filtered out or already enriched).
   */
  recordsSkipped: number;

  /**
   * Total time taken in milliseconds.
   */
  timeMs: number;

  /**
   * Optional array of error messages encountered during enrichment.
   */
  errors?: string[];
}

/**
 * Configuration for field mapping-based vertical enrichment.
 *
 * Maps values from an existing field to vertical classifications.
 * This is the simplest enrichment strategy, useful when vertical
 * information is already present in a different field.
 *
 * @property mapping - Map of source field values to vertical labels
 * @property filter - Optional filter to select which records to enrich
 * @property batchSize - Optional batch size for processing (default: 100)
 *
 * @example
 * ```typescript
 * const config: FieldMappingConfig = {
 *   mapping: {
 *     'tech': 'technology',
 *     'healthcare': 'medical',
 *     'fin': 'finance'
 *   },
 *   filter: { field: 'category', op: 'exists', value: true },
 *   batchSize: 50
 * };
 * ```
 */
export interface FieldMappingConfig {
  /**
   * Map of source field values to vertical labels.
   *
   * @example
   * ```typescript
   * {
   *   'tech': 'technology',
   *   'healthcare': 'medical',
   *   'finance': 'finance'
   * }
   * ```
   */
  mapping: Record<string, string>;

  /**
   * Optional filter to select which records to enrich.
   */
  filter?: UniversalFilter;

  /**
   * Optional batch size for processing (default: 100).
   */
  batchSize?: number;
}

/**
 * Configuration for custom extractor function-based vertical enrichment.
 *
 * Uses a custom function to extract vertical classifications from documents.
 * This provides maximum flexibility for complex extraction logic.
 *
 * @property extractor - Function that extracts vertical label from a document
 * @property filter - Optional filter to select which records to enrich
 * @property batchSize - Optional batch size for processing (default: 100)
 *
 * @example
 * ```typescript
 * const config: ExtractorConfig = {
 *   extractor: async (doc) => {
 *     if (doc.content.includes('machine learning')) return 'technology';
 *     if (doc.content.includes('stock market')) return 'finance';
 *     return 'general';
 *   },
 *   filter: { field: 'content', op: 'exists', value: true },
 *   batchSize: 25
 * };
 * ```
 */
export interface ExtractorConfig {
  /**
   * Function that extracts vertical label from a document.
   *
   * @param document - The document to extract vertical from
   * @returns Promise resolving to the vertical label
   */
  extractor: (document: any) => Promise<string>;

  /**
   * Optional filter to select which records to enrich.
   */
  filter?: UniversalFilter;

  /**
   * Optional batch size for processing (default: 100).
   */
  batchSize?: number;
}

/**
 * Configuration for automatic LLM-based vertical enrichment.
 *
 * Uses a language model to automatically classify documents into verticals.
 * Can use predefined field mappings or automatic extraction from text.
 *
 * @property llm - The LLM client to use for classification
 * @property fields - Array of vertical labels to classify into
 * @property promptTemplate - Optional custom prompt template for the LLM
 * @property textField - Optional field name containing text to classify (default: 'content')
 * @property filter - Optional filter to select which records to enrich
 * @property batchSize - Optional batch size for processing (default: 10)
 *
 * @example
 * ```typescript
 * const config: AutomaticExtractionConfig = {
 *   automatic: {
 *     llm: myLLMClient,
 *     fields: ['technology', 'finance', 'healthcare', 'retail'],
 *     promptTemplate: 'Classify this text into one of: {fields}\n\nText: {text}',
 *     textField: 'description'
 *   },
 *   filter: { field: 'vertical', op: 'eq', value: null },
 *   batchSize: 5
 * };
 * ```
 */
export interface AutomaticExtractionConfig {
  /**
   * Automatic extraction settings using an LLM.
   */
  automatic: {
    /**
     * The LLM client to use for classification.
     */
    llm: LLMClient;

    /**
     * Array of vertical labels to classify into.
     *
     * @example
     * ['technology', 'finance', 'healthcare', 'retail']
     */
    fields: string[];

    /**
     * Optional custom prompt template for the LLM.
     * Use {fields} for the list of verticals and {text} for the document text.
     *
     * @example
     * 'Classify this text into one of: {fields}\n\nText: {text}'
     */
    promptTemplate?: string;

    /**
     * Optional field name containing text to classify (default: 'content').
     */
    textField?: string;
  };

  /**
   * Optional filter to select which records to enrich.
   */
  filter?: UniversalFilter;

  /**
   * Optional batch size for processing (default: 10).
   */
  batchSize?: number;
}

/**
 * Configuration for vertical enrichment operations.
 *
 * Vertical enrichment classifies documents into business verticals
 * (e.g., technology, finance, healthcare). Three strategies are supported:
 *
 * 1. **Field Mapping**: Map existing field values to verticals
 * 2. **Custom Extractor**: Use a custom function to extract verticals
 * 3. **Automatic Extraction**: Use an LLM to automatically classify documents
 *
 * @example
 * ```typescript
 * // Field mapping
 * const config1: VerticalEnrichmentConfig = {
 *   mapping: { 'tech': 'technology', 'hc': 'healthcare' }
 * };
 *
 * // Custom extractor
 * const config2: VerticalEnrichmentConfig = {
 *   extractor: async (doc) => extractVertical(doc)
 * };
 *
 * // Automatic extraction
 * const config3: VerticalEnrichmentConfig = {
 *   automatic: {
 *     llm: myLLMClient,
 *     fields: ['technology', 'finance', 'healthcare']
 *   }
 * };
 * ```
 */
export type VerticalEnrichmentConfig =
  | FieldMappingConfig
  | ExtractorConfig
  | AutomaticExtractionConfig;

/**
 * Configuration for theme enrichment operations.
 *
 * Theme enrichment adds thematic tags to documents using a theme classifier.
 * Supports confidence thresholds, multi-theme tagging, and custom text fields.
 *
 * @property themes - Array of theme labels to classify into
 * @property classifier - The theme classifier to use for classification
 * @property textField - Optional field name containing text to classify (default: 'content')
 * @property confidenceThreshold - Optional minimum confidence threshold (default: 0.0)
 * @property multiTheme - Optional flag to allow multiple themes per document (default: false)
 * @property filter - Optional filter to select which records to enrich
 * @property batchSize - Optional batch size for processing (default: 100)
 * @property onProgress - Optional callback for tracking progress
 *
 * @example
 * ```typescript
 * const config: ThemeEnrichmentConfig = {
 *   themes: ['technology', 'business', 'science', 'healthcare'],
 *   classifier: new KeywordThemeClassifier(),
 *   textField: 'description',
 *   confidenceThreshold: 0.7,
 *   multiTheme: true,
 *   filter: { field: 'themes', op: 'eq', value: null },
 *   batchSize: 50,
 *   onProgress: (stats) => console.log(`Processed: ${stats.recordsProcessed}`)
 * };
 * ```
 */
export interface ThemeEnrichmentConfig {
  /**
   * Array of theme labels to classify into.
   *
   * @example
   * ['technology', 'business', 'science', 'healthcare']
   */
  themes: string[];

  /**
   * The theme classifier to use for classification.
   */
  classifier: ThemeClassifier;

  /**
   * Optional field name containing text to classify (default: 'content').
   */
  textField?: string;

  /**
   * Optional minimum confidence threshold (default: 0.0).
   * Only themes with confidence >= this value will be assigned.
   */
  confidenceThreshold?: number;

  /**
   * Optional flag to allow multiple themes per document (default: false).
   * When true, all themes above the confidence threshold are assigned.
   */
  multiTheme?: boolean;

  /**
   * Optional filter to select which records to enrich.
   */
  filter?: UniversalFilter;

  /**
   * Optional batch size for processing (default: 100).
   */
  batchSize?: number;

  /**
   * Optional callback for tracking progress.
   */
  onProgress?: ProgressCallback;
}

/**
 * Configuration for section enrichment operations.
 *
 * Section enrichment structures documents into logical sections
 * (e.g., introduction, methodology, results, conclusion).
 * Can use existing section markers or automatically detect sections.
 *
 * @property existingField - Optional field name containing existing section markers
 * @property autoDetect - Optional flag to automatically detect sections (default: false)
 * @property filter - Optional filter to select which records to enrich
 * @property batchSize - Optional batch size for processing (default: 100)
 *
 * @example
 * ```typescript
 * // Use existing section markers
 * const config1: SectionEnrichmentConfig = {
 *   existingField: 'raw_sections',
 *   filter: { field: 'sections', op: 'eq', value: null }
 * };
 *
 * // Auto-detect sections
 * const config2: SectionEnrichmentConfig = {
 *   autoDetect: true,
 *   batchSize: 25
 * };
 * ```
 */
export interface SectionEnrichmentConfig {
  /**
   * Optional field name containing existing section markers.
   * If provided, sections will be extracted from this field.
   */
  existingField?: string;

  /**
   * Optional flag to automatically detect sections (default: false).
   * When true, sections will be detected using heuristics (headers, paragraphs, etc.).
   */
  autoDetect?: boolean;

  /**
   * Optional filter to select which records to enrich.
   */
  filter?: UniversalFilter;

  /**
   * Optional batch size for processing (default: 100).
   */
  batchSize?: number;
}

/**
 * Configuration for enriching all aspects of documents.
 *
 * Combines vertical, theme, and section enrichment into a single operation.
 * Allows running multiple enrichment strategies in sequence with shared settings.
 *
 * @property vertical - Optional vertical enrichment configuration
 * @property themes - Optional theme enrichment configuration
 * @property sections - Optional section enrichment configuration
 * @property filter - Optional global filter applied to all enrichment operations
 * @property batchSize - Optional global batch size for all operations (default: 100)
 * @property onProgress - Optional global progress callback for all operations
 *
 * @example
 * ```typescript
 * const config: EnrichAllConfig = {
 *   vertical: {
 *     automatic: {
 *       llm: myLLMClient,
 *       fields: ['technology', 'finance', 'healthcare']
 *     }
 *   },
 *   themes: {
 *     themes: ['innovation', 'research', 'product'],
 *     classifier: new KeywordThemeClassifier(),
 *     confidenceThreshold: 0.8
 *   },
 *   sections: {
 *     autoDetect: true
 *   },
 *   filter: { field: 'status', op: 'eq', value: 'pending' },
 *   batchSize: 50,
 *   onProgress: (stats) => console.log(`Progress: ${stats.recordsProcessed}`)
 * };
 * ```
 */
export interface EnrichAllConfig {
  /**
   * Optional vertical enrichment configuration.
   */
  vertical?: VerticalEnrichmentConfig;

  /**
   * Optional theme enrichment configuration.
   */
  themes?: ThemeEnrichmentConfig;

  /**
   * Optional section enrichment configuration.
   */
  sections?: SectionEnrichmentConfig;

  /**
   * Optional global filter applied to all enrichment operations.
   * This filter is combined with individual operation filters using AND logic.
   */
  filter?: UniversalFilter;

  /**
   * Optional global batch size for all operations (default: 100).
   * Individual operation batch sizes override this value.
   */
  batchSize?: number;

  /**
   * Optional global progress callback for all operations.
   * Called after each enrichment operation completes.
   */
  onProgress?: ProgressCallback;
}
