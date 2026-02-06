/**
 * Enrichment pipeline for adding metadata to vector records.
 *
 * This class provides the main enrichment functionality:
 * - Vertical enrichment: Classify documents into business verticals
 * - Theme enrichment: Add thematic tags to documents
 * - Section enrichment: Structure documents into logical sections
 * - Batch processing: Efficiently process large collections
 *
 * Design principles:
 * 1. Database-agnostic: Works with any VectorDBAdapter
 * 2. Strategy pattern: Multiple enrichment strategies per operation
 * 3. Batch processing: Efficient iteration and bulk updates
 * 4. Error resilience: Continue processing despite individual failures
 */

import type { VectorDBAdapter } from '../adapters';
import type { VectorRecord } from '../types';
import type { MetadataUpdate } from '../adapters/types';
import type { UniversalFilter } from '../filters/types';
import type {
  EnrichmentStats,
  VerticalEnrichmentConfig,
  ThemeEnrichmentConfig,
  SectionEnrichmentConfig,
  EnrichAllConfig,
  FieldMappingConfig,
  ExtractorConfig,
  AutomaticExtractionConfig,
} from './types';

/**
 * EnrichmentPipeline provides methods to enrich vector records with metadata.
 *
 * The pipeline supports three types of enrichment:
 * 1. Vertical enrichment: Classify into business verticals (technology, finance, etc.)
 * 2. Theme enrichment: Add thematic tags (innovation, research, etc.)
 * 3. Section enrichment: Structure into logical sections
 *
 * Each enrichment type supports multiple strategies for maximum flexibility.
 *
 * @example
 * ```typescript
 * const pipeline = new EnrichmentPipeline(adapter, embedder, llm);
 *
 * // Enrich using field mapping
 * await pipeline.enrichVertical('my-collection', {
 *   mapping: { 'tech': 'technology', 'hc': 'healthcare' }
 * });
 *
 * // Enrich using custom extractor
 * await pipeline.enrichVertical('my-collection', {
 *   extractor: async (doc) => extractVertical(doc)
 * });
 *
 * // Enrich using LLM
 * await pipeline.enrichVertical('my-collection', {
 *   automatic: {
 *     llm: myLLMClient,
 *     fields: ['technology', 'finance', 'healthcare']
 *   }
 * });
 * ```
 */
export class EnrichmentPipeline {
  /**
   * Create a new enrichment pipeline.
   *
   * @param adapter - Vector database adapter for reading/writing records
   * @param embedder - Optional embedder for embedding-based enrichment
   * @param llm - Optional LLM client for automatic enrichment
   */
  constructor(
    private adapter: VectorDBAdapter,
    private embedder?: any,
    private llm?: any
  ) {}

  /**
   * Enrich records with vertical classifications.
   *
   * Supports three strategies:
   * 1. Field mapping: Map existing field values to verticals
   * 2. Custom extractor: Use a custom function to extract verticals
   * 3. Automatic LLM: Use an LLM to classify documents
   *
   * @param collection - Name of the collection to enrich
   * @param config - Vertical enrichment configuration
   * @returns Statistics about the enrichment operation
   *
   * @example
   * ```typescript
   * // Field mapping
   * await pipeline.enrichVertical('docs', {
   *   mapping: { 'tech': 'technology' }
   * });
   *
   * // Custom extractor
   * await pipeline.enrichVertical('docs', {
   *   extractor: async (doc) => 'technology'
   * });
   *
   * // Automatic LLM
   * await pipeline.enrichVertical('docs', {
   *   automatic: {
   *     llm: myLLMClient,
   *     fields: ['technology', 'finance']
   *   }
   * });
   * ```
   */
  async enrichVertical(
    collection: string,
    config: VerticalEnrichmentConfig
  ): Promise<EnrichmentStats> {
    const startTime = Date.now();
    const stats: EnrichmentStats = {
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      timeMs: 0,
      errors: [],
    };

    try {
      // Determine which strategy to use
      if ('mapping' in config) {
        await this.enrichWithFieldMapping(collection, config, stats);
      } else if ('extractor' in config) {
        await this.enrichWithExtractor(collection, config, stats);
      } else if ('automatic' in config) {
        await this.enrichWithLLM(collection, config, stats);
      }
    } catch (error) {
      stats.errors?.push(
        `Pipeline error: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }

    stats.timeMs = Date.now() - startTime;
    return stats;
  }

  /**
   * Enrich records using field mapping strategy.
   *
   * Maps values from an existing field to vertical classifications.
   *
   * @param collection - Collection name
   * @param config - Field mapping configuration
   * @param stats - Statistics object to update
   */
  private async enrichWithFieldMapping(
    collection: string,
    config: FieldMappingConfig,
    stats: EnrichmentStats
  ): Promise<void> {
    const batchSize = config.batchSize || 100;

    for await (const batch of this.adapter.iterate(collection, {
      batchSize,
      filter: config.filter,
    })) {
      const updates: MetadataUpdate[] = [];

      for (const record of batch) {
        stats.recordsProcessed++;

        try {
          const vertical = this.applyFieldMapping(record, config.mapping);

          if (vertical) {
            updates.push({
              id: record.id,
              metadata: { vertical },
            });
          } else {
            stats.recordsSkipped++;
          }
        } catch (error) {
          stats.recordsSkipped++;
          stats.errors?.push(
            `Error mapping record ${record.id}: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }

      // Apply updates if any
      if (updates.length > 0) {
        try {
          await this.adapter.updateMetadata(collection, updates);
          stats.recordsUpdated += updates.length;
        } catch (error) {
          stats.errors?.push(
            `Error updating batch: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }
    }
  }

  /**
   * Apply field mapping to extract vertical from a record.
   *
   * @param record - Vector record
   * @param mapping - Field mapping configuration
   * @returns Vertical label or null if no match
   */
  private applyFieldMapping(
    record: VectorRecord,
    mapping: Record<string, string>
  ): string | null {
    const category = record.metadata?.category;

    if (category && typeof category === 'string' && category in mapping) {
      return mapping[category];
    }

    return null;
  }

  /**
   * Enrich records using custom extractor strategy.
   *
   * Calls the provided extractor function for each record.
   *
   * @param collection - Collection name
   * @param config - Extractor configuration
   * @param stats - Statistics object to update
   */
  private async enrichWithExtractor(
    collection: string,
    config: ExtractorConfig,
    stats: EnrichmentStats
  ): Promise<void> {
    const batchSize = config.batchSize || 100;

    for await (const batch of this.adapter.iterate(collection, {
      batchSize,
      filter: config.filter,
    })) {
      const updates: MetadataUpdate[] = [];

      for (const record of batch) {
        stats.recordsProcessed++;

        try {
          const vertical = await config.extractor(record);

          if (vertical) {
            updates.push({
              id: record.id,
              metadata: { vertical },
            });
          } else {
            stats.recordsSkipped++;
          }
        } catch (error) {
          stats.recordsSkipped++;
          stats.errors?.push(
            `Extractor error for record ${record.id}: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }

      // Apply updates if any
      if (updates.length > 0) {
        try {
          await this.adapter.updateMetadata(collection, updates);
          stats.recordsUpdated += updates.length;
        } catch (error) {
          stats.errors?.push(
            `Error updating batch: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }
    }
  }

  /**
   * Enrich records using automatic LLM strategy.
   *
   * Uses a language model to classify documents into verticals.
   *
   * @param collection - Collection name
   * @param config - Automatic extraction configuration
   * @param stats - Statistics object to update
   */
  private async enrichWithLLM(
    collection: string,
    config: AutomaticExtractionConfig,
    stats: EnrichmentStats
  ): Promise<void> {
    const batchSize = config.batchSize || 10;
    const { llm, fields, promptTemplate, textField } = config.automatic;
    const fieldName = textField || 'content';

    for await (const batch of this.adapter.iterate(collection, {
      batchSize,
      filter: config.filter,
    })) {
      const updates: MetadataUpdate[] = [];

      for (const record of batch) {
        stats.recordsProcessed++;

        try {
          const vertical = await this.extractWithLLM(
            record,
            llm,
            fields,
            fieldName,
            promptTemplate
          );

          if (vertical) {
            updates.push({
              id: record.id,
              metadata: { vertical },
            });
          } else {
            stats.recordsSkipped++;
          }
        } catch (error) {
          stats.recordsSkipped++;
          stats.errors?.push(
            `LLM extraction error for record ${record.id}: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }

      // Apply updates if any
      if (updates.length > 0) {
        try {
          await this.adapter.updateMetadata(collection, updates);
          stats.recordsUpdated += updates.length;
        } catch (error) {
          stats.errors?.push(
            `Error updating batch: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }
    }
  }

  /**
   * Extract vertical classification using LLM.
   *
   * @param record - Vector record
   * @param llm - LLM client
   * @param fields - Available vertical fields
   * @param textField - Field name containing text to classify
   * @param promptTemplate - Optional custom prompt template
   * @returns Vertical label
   */
  private async extractWithLLM(
    record: VectorRecord,
    llm: any,
    fields: string[],
    textField: string,
    promptTemplate?: string
  ): Promise<string> {
    const text = record.metadata?.[textField];

    if (!text || typeof text !== 'string') {
      throw new Error(`No text found in field '${textField}'`);
    }

    // Build prompt
    const prompt = promptTemplate
      ? promptTemplate
          .replace('{fields}', fields.join(', '))
          .replace('{text}', text)
      : `Classify the following text into one of these categories: ${fields.join(', ')}\n\nText: ${text}\n\nCategory:`;

    // Call LLM
    const result = await llm.generate(prompt);

    return result.trim();
  }

  /**
   * Enrich records with theme classifications.
   *
   * Uses a theme classifier to identify themes in text content and updates
   * record metadata with theme information. Supports single and multi-theme
   * classification with configurable confidence thresholds.
   *
   * @param collection - Name of the collection to enrich
   * @param config - Theme enrichment configuration
   * @returns Statistics about the enrichment operation
   *
   * @example
   * ```typescript
   * // Single theme classification
   * await pipeline.enrichThemes('docs', {
   *   themes: ['technology', 'business', 'science'],
   *   classifier: new KeywordThemeClassifier(),
   *   confidenceThreshold: 0.7
   * });
   *
   * // Multi-theme classification
   * await pipeline.enrichThemes('docs', {
   *   themes: ['technology', 'business', 'science'],
   *   classifier: new LLMThemeClassifier(),
   *   multiTheme: true,
   *   confidenceThreshold: 0.5
   * });
   * ```
   */
  async enrichThemes(
    collection: string,
    config: ThemeEnrichmentConfig
  ): Promise<EnrichmentStats> {
    const startTime = Date.now();
    const stats: EnrichmentStats = {
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      timeMs: 0,
      errors: [],
    };

    try {
      await this.enrichWithThemeClassifier(collection, config, stats);
    } catch (error) {
      stats.errors?.push(
        `Pipeline error: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }

    stats.timeMs = Date.now() - startTime;
    return stats;
  }

  /**
   * Enrich records using theme classifier.
   *
   * @param collection - Collection name
   * @param config - Theme enrichment configuration
   * @param stats - Statistics object to update
   */
  private async enrichWithThemeClassifier(
    collection: string,
    config: ThemeEnrichmentConfig,
    stats: EnrichmentStats
  ): Promise<void> {
    const batchSize = config.batchSize || 100;
    const textField = config.textField || 'content';
    const confidenceThreshold = config.confidenceThreshold ?? 0.5;
    const multiTheme = config.multiTheme || false;

    for await (const batch of this.adapter.iterate(collection, {
      batchSize,
      filter: config.filter,
    })) {
      // Extract texts from batch
      const textsToClassify: string[] = [];
      const recordsToProcess: VectorRecord[] = [];

      for (const record of batch) {
        stats.recordsProcessed++;

        // Extract text from record
        const text = record.text || record.metadata?.[textField];

        if (!text || typeof text !== 'string' || text.trim() === '') {
          stats.recordsSkipped++;
          continue;
        }

        textsToClassify.push(text);
        recordsToProcess.push(record);
      }

      // Skip if no valid texts to classify
      if (textsToClassify.length === 0) {
        continue;
      }

      // Classify batch
      let classifications: any[];
      try {
        classifications = await config.classifier.classifyBatch(textsToClassify);
      } catch (error) {
        // If batch classification fails, try individual classification for each item
        stats.errors?.push(
          `Batch classification error, falling back to individual classification: ${error instanceof Error ? error.message : 'unknown error'}`
        );

        classifications = [];
        for (let i = 0; i < textsToClassify.length; i++) {
          try {
            const result = await config.classifier.classify(textsToClassify[i]);
            classifications.push(result);
          } catch (individualError) {
            // Push null to maintain index alignment
            classifications.push(null);
            stats.errors?.push(
              `Classification error for record ${recordsToProcess[i].id}: ${individualError instanceof Error ? individualError.message : 'unknown error'}`
            );
          }
        }
      }

      // Build updates
      const updates: MetadataUpdate[] = [];

      for (let i = 0; i < recordsToProcess.length; i++) {
        const record = recordsToProcess[i];
        const classification = classifications[i];

        try {
          // Check if classification is valid (might be error object or undefined)
          if (!classification || typeof classification !== 'object') {
            stats.recordsSkipped++;
            stats.errors?.push(
              `Invalid classification for record ${record.id}`
            );
            continue;
          }

          // Skip if below confidence threshold
          if (classification.confidence < confidenceThreshold) {
            stats.recordsSkipped++;
            continue;
          }

          // Build metadata update
          const metadata: Record<string, any> = {
            __h_theme: classification.theme,
            __h_theme_confidence: classification.confidence,
          };

          // Handle multi-theme mode
          if (multiTheme && classification.allScores) {
            const themes = Object.entries(classification.allScores)
              .filter(([_, score]) => (score as number) >= confidenceThreshold)
              .sort(([_, a], [__, b]) => (b as number) - (a as number))
              .map(([theme, _]) => theme);

            if (themes.length > 0) {
              metadata.__h_themes = themes;
            }
          }

          updates.push({
            id: record.id,
            metadata,
          });
        } catch (error) {
          stats.recordsSkipped++;
          stats.errors?.push(
            `Error processing record ${record.id}: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }

      // Apply updates if any
      if (updates.length > 0) {
        try {
          await this.adapter.updateMetadata(collection, updates);
          stats.recordsUpdated += updates.length;
        } catch (error) {
          stats.errors?.push(
            `Error updating batch: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }

      // Call progress callback if provided
      if (config.onProgress) {
        config.onProgress(stats);
      }
    }
  }

  /**
   * Enrich records with section structure.
   *
   * Extracts section metadata from documents using either existing field mappings
   * or automatic detection strategies (markdown, HTML, or pattern-based).
   *
   * @param collection - Name of the collection to enrich
   * @param config - Section enrichment configuration
   * @returns Statistics about the enrichment operation
   *
   * @example
   * ```typescript
   * // Use existing section field
   * await pipeline.enrichSections('docs', {
   *   existingField: 'section_path'
   * });
   *
   * // Auto-detect sections
   * await pipeline.enrichSections('docs', {
   *   autoDetect: true
   * });
   * ```
   */
  async enrichSections(
    collection: string,
    config: SectionEnrichmentConfig
  ): Promise<EnrichmentStats> {
    const startTime = Date.now();
    const stats: EnrichmentStats = {
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      timeMs: 0,
      errors: [],
    };

    try {
      await this.enrichWithSectionDetection(collection, config, stats);
    } catch (error) {
      stats.errors?.push(
        `Pipeline error: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }

    stats.timeMs = Date.now() - startTime;
    return stats;
  }

  /**
   * Enrich records with all enrichment types.
   *
   * Runs vertical, theme, and section enrichment sequentially with shared
   * configuration. Global filters and batch sizes apply to all operations.
   *
   * @param collection - Name of the collection to enrich
   * @param config - Combined enrichment configuration
   * @returns Statistics about the enrichment operation
   *
   * @example
   * ```typescript
   * await pipeline.enrichAll('docs', {
   *   vertical: { mapping: { tech: 'technology' } },
   *   themes: { themes: ['innovation'], classifier },
   *   sections: { autoDetect: true },
   *   filter: { field: 'status', op: 'eq', value: 'pending' },
   *   batchSize: 50
   * });
   * ```
   */
  async enrichAll(
    collection: string,
    config: EnrichAllConfig
  ): Promise<EnrichmentStats> {
    const startTime = Date.now();
    const aggregateStats: EnrichmentStats = {
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      timeMs: 0,
      errors: [],
    };

    try {
      // Run vertical enrichment if configured
      if (config.vertical) {
        const verticalConfig = this.applyGlobalConfig(config.vertical, config);
        const stats = await this.enrichVertical(collection, verticalConfig);
        this.mergeStats(aggregateStats, stats);

        // Call progress callback if provided
        if (config.onProgress) {
          config.onProgress(aggregateStats);
        }
      }

      // Run theme enrichment if configured
      if (config.themes) {
        const themesConfig = this.applyGlobalConfig(config.themes, config);
        const stats = await this.enrichThemes(collection, themesConfig);
        this.mergeStats(aggregateStats, stats);

        // Call progress callback if provided
        if (config.onProgress) {
          config.onProgress(aggregateStats);
        }
      }

      // Run section enrichment if configured
      if (config.sections) {
        const sectionsConfig = this.applyGlobalConfig(config.sections, config);
        const stats = await this.enrichSections(collection, sectionsConfig);
        this.mergeStats(aggregateStats, stats);

        // Call progress callback if provided
        if (config.onProgress) {
          config.onProgress(aggregateStats);
        }
      }
    } catch (error) {
      aggregateStats.errors?.push(
        `Pipeline error: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }

    aggregateStats.timeMs = Date.now() - startTime;
    return aggregateStats;
  }

  /**
   * Apply global configuration to individual enrichment configs.
   *
   * @param individualConfig - Configuration for a specific enrichment type
   * @param globalConfig - Global configuration
   * @returns Merged configuration
   */
  private applyGlobalConfig<T extends { filter?: UniversalFilter; batchSize?: number }>(
    individualConfig: T,
    globalConfig: EnrichAllConfig
  ): T {
    const merged = { ...individualConfig };

    // Apply global filter if not overridden
    if (globalConfig.filter && !merged.filter) {
      merged.filter = globalConfig.filter;
    }

    // Apply global batch size if not overridden
    if (globalConfig.batchSize && !merged.batchSize) {
      merged.batchSize = globalConfig.batchSize;
    }

    return merged;
  }

  /**
   * Merge stats from an enrichment operation into aggregate stats.
   *
   * @param aggregate - Aggregate stats to update
   * @param stats - Stats from a single operation
   */
  private mergeStats(aggregate: EnrichmentStats, stats: EnrichmentStats): void {
    aggregate.recordsProcessed += stats.recordsProcessed;
    aggregate.recordsUpdated += stats.recordsUpdated;
    aggregate.recordsSkipped += stats.recordsSkipped;

    // Merge errors
    if (stats.errors && stats.errors.length > 0) {
      if (!aggregate.errors) {
        aggregate.errors = [];
      }
      aggregate.errors.push(...stats.errors);
    }
  }

  /**
   * Enrich records using section detection.
   *
   * @param collection - Collection name
   * @param config - Section enrichment configuration
   * @param stats - Statistics object to update
   */
  private async enrichWithSectionDetection(
    collection: string,
    config: SectionEnrichmentConfig,
    stats: EnrichmentStats
  ): Promise<void> {
    const batchSize = config.batchSize || 100;

    for await (const batch of this.adapter.iterate(collection, {
      batchSize,
      filter: config.filter,
    })) {
      const updates: MetadataUpdate[] = [];

      for (const record of batch) {
        stats.recordsProcessed++;

        try {
          let sectionMetadata: {
            path?: string;
            level: number;
            title: string;
          } | null = null;

          // Use existing field if provided
          if (config.existingField) {
            sectionMetadata = this.extractSectionMetadata(
              record.metadata?.[config.existingField]
            );
          }
          // Otherwise, auto-detect sections
          else if (config.autoDetect) {
            const text = record.text || record.metadata?.content || '';
            if (typeof text === 'string') {
              sectionMetadata = this.detectSections(text);
            }
          }

          if (sectionMetadata) {
            const metadata: Record<string, any> = {
              __h_section_level: sectionMetadata.level,
              __h_section_title: sectionMetadata.title,
            };

            if (sectionMetadata.path) {
              metadata.__h_section_path = sectionMetadata.path;
            }

            updates.push({
              id: record.id,
              metadata,
            });
          } else {
            stats.recordsSkipped++;
          }
        } catch (error) {
          stats.recordsSkipped++;
          stats.errors?.push(
            `Error processing record ${record.id}: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }

      // Apply updates if any
      if (updates.length > 0) {
        try {
          await this.adapter.updateMetadata(collection, updates);
          stats.recordsUpdated += updates.length;
        } catch (error) {
          stats.errors?.push(
            `Error updating batch: ${error instanceof Error ? error.message : 'unknown error'}`
          );
        }
      }
    }
  }

  /**
   * Extract section metadata from an existing field value.
   *
   * @param sectionPath - Section path string (e.g., "introduction/overview")
   * @returns Section metadata or null
   */
  private extractSectionMetadata(
    sectionPath: any
  ): { path: string; level: number; title: string } | null {
    if (!sectionPath || typeof sectionPath !== 'string') {
      return null;
    }

    const parts = sectionPath.split('/').filter(p => p.trim() !== '');
    if (parts.length === 0) {
      return null;
    }

    return {
      path: sectionPath,
      level: parts.length,
      title: parts[parts.length - 1],
    };
  }

  /**
   * Detect sections in text using heuristics.
   *
   * @param text - Text content to analyze
   * @returns Section metadata or null
   */
  private detectSections(
    text: string
  ): { level: number; title: string } | null {
    // Try markdown detection first
    const markdown = this.detectMarkdownSections(text);
    if (markdown) return markdown;

    // Try HTML detection
    const html = this.detectHtmlSections(text);
    if (html) return html;

    // Try pattern detection
    const pattern = this.detectPatternSections(text);
    if (pattern) return pattern;

    // Fallback: mark as unsectioned
    return { level: 0, title: 'unsectioned' };
  }

  /**
   * Detect markdown headers (# Header).
   *
   * @param text - Text content
   * @returns Section metadata or null
   */
  private detectMarkdownSections(
    text: string
  ): { level: number; title: string } | null {
    const match = text.match(/^(#{1,6})\s+(.+)$/m);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      return { level, title };
    }
    return null;
  }

  /**
   * Detect HTML headers (<h1>Header</h1>).
   *
   * @param text - Text content
   * @returns Section metadata or null
   */
  private detectHtmlSections(
    text: string
  ): { level: number; title: string } | null {
    const match = text.match(/<h([1-6])>(.+?)<\/h[1-6]>/i);
    if (match) {
      const level = parseInt(match[1], 10);
      const title = match[2].trim();
      return { level, title };
    }
    return null;
  }

  /**
   * Detect sections using common patterns (SECTION: Title).
   *
   * @param text - Text content
   * @returns Section metadata or null
   */
  private detectPatternSections(
    text: string
  ): { level: number; title: string } | null {
    const match = text.match(/^SECTION:\s+(.+)$/m);
    if (match) {
      const title = match[1].trim();
      return { level: 1, title };
    }
    return null;
  }
}
