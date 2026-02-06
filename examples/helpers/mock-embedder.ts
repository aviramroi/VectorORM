/**
 * Simple deterministic embedder for examples.
 * Produces embeddings based on keyword hashing — not real semantic embeddings,
 * but good enough to demonstrate the API.
 */
import { Embedder } from '../../packages/core/src/embedders/embedder';

const DIMENSION = 64;

function hashEmbed(text: string): number[] {
  const vec = new Array(DIMENSION).fill(0);
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const idx = (lower.charCodeAt(i) * (i + 1)) % DIMENSION;
    vec[idx] += 1;
  }
  // Normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export class SimpleEmbedder extends Embedder {
  constructor() {
    super();
  }

  get dimensions(): number {
    return DIMENSION;
  }

  get modelName(): string {
    return 'simple-hash-embedder';
  }

  async embed(text: string): Promise<number[]> {
    return hashEmbed(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(hashEmbed);
  }
}
