import { describe, it, expect } from 'vitest';
import { MetadataBuilder } from '../../src/metadata/builder';
import { VerticalFields, HorizontalFields, StructuralFields } from '../../src/metadata/constants';

describe('MetadataBuilder', () => {
  it('should build vertical metadata', () => {
    const metadata = new MetadataBuilder()
      .vertical({
        doc_id: 'doc123',
        source: 'file.pdf',
        partition: 'project-a'
      })
      .build();

    expect(metadata).toEqual({
      [VerticalFields.DOC_ID]: 'doc123',
      [VerticalFields.SOURCE]: 'file.pdf',
      [VerticalFields.PARTITION]: 'project-a'
    });
  });

  it('should build horizontal metadata', () => {
    const metadata = new MetadataBuilder()
      .horizontal({
        theme: 'pricing',
        section_path: 'Chapter 3/Pricing',
        section_level: 2
      })
      .build();

    expect(metadata).toEqual({
      [HorizontalFields.THEME]: 'pricing',
      [HorizontalFields.SECTION_PATH]: 'Chapter 3/Pricing',
      [HorizontalFields.SECTION_LEVEL]: 2
    });
  });

  it('should build structural metadata', () => {
    const metadata = new MetadataBuilder()
      .structural({
        chunk_index: 5,
        total_chunks: 10,
        parent_id: 'parent123'
      })
      .build();

    expect(metadata).toEqual({
      [StructuralFields.CHUNK_INDEX]: 5,
      [StructuralFields.TOTAL_CHUNKS]: 10,
      [StructuralFields.PARENT_ID]: 'parent123'
    });
  });

  it('should build custom metadata', () => {
    const metadata = new MetadataBuilder()
      .custom({
        author: 'John Doe',
        priority: 'high',
        tags: ['important', 'urgent']
      })
      .build();

    expect(metadata).toEqual({
      author: 'John Doe',
      priority: 'high',
      tags: ['important', 'urgent']
    });
  });

  it('should chain multiple metadata types', () => {
    const metadata = new MetadataBuilder()
      .vertical({ doc_id: 'doc123', source: 'file.pdf' })
      .horizontal({ theme: 'pricing' })
      .structural({ chunk_index: 0, total_chunks: 5 })
      .custom({ author: 'Jane Smith' })
      .build();

    expect(metadata).toEqual({
      [VerticalFields.DOC_ID]: 'doc123',
      [VerticalFields.SOURCE]: 'file.pdf',
      [HorizontalFields.THEME]: 'pricing',
      [StructuralFields.CHUNK_INDEX]: 0,
      [StructuralFields.TOTAL_CHUNKS]: 5,
      author: 'Jane Smith'
    });
  });

  it('should handle array fields correctly', () => {
    const metadata = new MetadataBuilder()
      .vertical({ tags: ['tag1', 'tag2'] })
      .horizontal({ themes: ['theme1', 'theme2'] })
      .custom({ categories: ['cat1', 'cat2'] })
      .build();

    expect(metadata).toEqual({
      [VerticalFields.TAGS]: ['tag1', 'tag2'],
      [HorizontalFields.THEMES]: ['theme1', 'theme2'],
      categories: ['cat1', 'cat2']
    });
  });

  it('should skip undefined values', () => {
    const metadata = new MetadataBuilder()
      .vertical({ doc_id: 'doc123', source: undefined })
      .horizontal({ theme: 'pricing', section_path: undefined })
      .structural({ chunk_index: 0, parent_id: undefined })
      .custom({ author: 'John', editor: undefined })
      .build();

    expect(metadata).toEqual({
      [VerticalFields.DOC_ID]: 'doc123',
      [HorizontalFields.THEME]: 'pricing',
      [StructuralFields.CHUNK_INDEX]: 0,
      author: 'John'
    });
  });
});
