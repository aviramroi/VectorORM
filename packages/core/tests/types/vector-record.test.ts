import { describe, it, expect } from 'vitest';
import type { VectorRecord } from '../../src/types/vector-record';

describe('VectorRecord', () => {
  it('should accept valid vector record', () => {
    const record: VectorRecord = {
      id: 'test-id',
      embedding: [0.1, 0.2, 0.3],
      metadata: {
        text: 'test text',
        custom: 'value'
      }
    };

    expect(record.id).toBe('test-id');
    expect(record.embedding).toHaveLength(3);
  });

  it('should accept optional fields', () => {
    const record: VectorRecord = {
      id: 'test-id',
      embedding: [0.1],
      metadata: {},
      text: 'optional text',
      score: 0.95
    };

    expect(record.text).toBe('optional text');
    expect(record.score).toBe(0.95);
  });
});
