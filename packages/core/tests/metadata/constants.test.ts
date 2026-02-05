import { describe, it, expect } from 'vitest';
import {
  METADATA_PREFIXES,
  VerticalFields,
  HorizontalFields,
  StructuralFields
} from '../../src/metadata/constants';

describe('Metadata Constants', () => {
  it('should define metadata prefixes', () => {
    expect(METADATA_PREFIXES.VERTICAL).toBe('__v_');
    expect(METADATA_PREFIXES.HORIZONTAL).toBe('__h_');
    expect(METADATA_PREFIXES.STRUCTURAL).toBe('__s_');
  });

  it('should define vertical fields', () => {
    expect(VerticalFields.DOC_ID).toBe('__v_doc_id');
    expect(VerticalFields.SOURCE).toBe('__v_source');
    expect(VerticalFields.PARTITION).toBe('__v_partition');
  });

  it('should define horizontal fields', () => {
    expect(HorizontalFields.THEME).toBe('__h_theme');
    expect(HorizontalFields.SECTION_PATH).toBe('__h_section_path');
  });

  it('should define structural fields', () => {
    expect(StructuralFields.CHUNK_INDEX).toBe('__s_chunk_index');
    expect(StructuralFields.TOTAL_CHUNKS).toBe('__s_total_chunks');
  });
});
