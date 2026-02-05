/**
 * Type-safe metadata field names.
 *
 * Use these instead of string literals to get autocomplete and catch typos.
 */

/** Type for vertical field keys */
export type VerticalFieldKey =
  | 'docId'
  | 'source'
  | 'partition'
  | 'docType'
  | 'tags';

/** Type for horizontal field keys */
export type HorizontalFieldKey =
  | 'theme'
  | 'themes'
  | 'themeConfidence'
  | 'sectionPath'
  | 'sectionLevel'
  | 'sectionTitle';

/** Type for structural field keys */
export type StructuralFieldKey =
  | 'chunkIndex'
  | 'parentId'
  | 'hasChildren'
  | 'totalChunks';
