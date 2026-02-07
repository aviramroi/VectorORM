/**
 * Metadata field prefixes for the three axes of VectorORM's schema.
 *
 * These prefixes separate framework fields from user-defined metadata:
 * - __v_: Vertical axis (document identity)
 * - __h_: Horizontal axis (content/theme identity)
 * - __s_: Structural axis (position/hierarchy)
 */
export const METADATA_PREFIXES = {
  VERTICAL: '__v_',
  HORIZONTAL: '__h_',
  STRUCTURAL: '__s_',
} as const;

/**
 * Vertical axis fields - identify WHICH document a chunk belongs to.
 */
export const VerticalFields = {
  /** Unique document identifier */
  DOC_ID: '__v_doc_id',

  /** Original source path/URL */
  SOURCE: '__v_source',

  /** Logical partition key (for filtering by document subsets) */
  PARTITION: '__v_partition',

  /** Document type classification */
  DOC_TYPE: '__v_doc_type',

  /** Arbitrary vertical tags */
  TAGS: '__v_tags',
} as const;

/**
 * Horizontal axis fields - identify WHAT topic/theme a chunk covers.
 */
export const HorizontalFields = {
  /** Primary theme classification */
  THEME: '__h_theme',

  /** Multiple themes (if applicable) */
  THEMES: '__h_themes',

  /** Classification confidence score */
  THEME_CONFIDENCE: '__h_theme_confidence',

  /** Hierarchical section path (e.g., "Chapter 3/Pricing/Rates") */
  SECTION_PATH: '__h_section_path',

  /** Depth level in hierarchy (0 = root) */
  SECTION_LEVEL: '__h_section_level',

  /** Section header text */
  SECTION_TITLE: '__h_section_title',
} as const;

/**
 * Structural axis fields - track chunk position and relationships.
 */
export const StructuralFields = {
  /** Position in document (0-indexed) */
  CHUNK_INDEX: '__s_chunk_index',

  /** Parent chunk ID (for hierarchical chunking) */
  PARENT_ID: '__s_parent_id',

  /** Whether this chunk has children */
  HAS_CHILDREN: '__s_has_children',

  /** Total chunks in this document */
  TOTAL_CHUNKS: '__s_total_chunks',
} as const;
