/**
 * Setup — Create the RAGClient and insurance collection.
 *
 * In a real application, you would use your own Embedder and LLMClient
 * implementations (e.g., OpenAI, Anthropic, Cohere).
 *
 * This demo uses ChromaDB as the vector store.
 * Start Chroma first: docker run -p 8000:8000 chromadb/chroma
 */
import { RAGClient, Embedder, LLMClient } from '@glyph/core';
import { ChromaAdapter } from '@glyph/adapter-chroma';
import type { GenerateOptions } from '@glyph/core';

// ── Placeholder Embedder ──────────────────────────────────────────────────
// Replace with your real embedder (e.g., OpenAI text-embedding-3-small)
class DemoEmbedder extends Embedder {
  constructor() { super(); }
  get dimensions(): number { return 64; }
  get modelName(): string { return 'demo-embedder'; }

  async embed(text: string): Promise<number[]> {
    const vec = new Array(64).fill(0);
    const lower = text.toLowerCase();
    for (let i = 0; i < lower.length; i++) {
      vec[(lower.charCodeAt(i) * (i + 1)) % 64] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0)) || 1;
    return vec.map((v: number) => v / norm);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t: string) => this.embed(t)));
  }
}

// ── Placeholder LLM ───────────────────────────────────────────────────────
// Replace with your real LLM client (e.g., OpenAI GPT-4, Anthropic Claude)
class DemoLLM extends LLMClient {
  constructor() { super(); }
  get modelName(): string { return 'demo-llm'; }
  get provider(): string { return 'demo'; }

  async generate(prompt: string, _options?: GenerateOptions): Promise<string> {
    // In a real app, this calls your LLM API.
    // For the demo, return a placeholder acknowledging the context.
    const contextMatch = prompt.match(/Context:\n([\s\S]*?)\n\nQuestion:/);
    const context = contextMatch ? contextMatch[1].substring(0, 200) : '(no context)';
    return `[Demo LLM] Based on the provided context (${context.length} chars), ` +
      `here is a generated answer. Replace DemoLLM with a real LLM for actual responses.`;
  }

  async generateJSON<T>(prompt: string, options?: GenerateOptions): Promise<T> {
    const text = await this.generate(prompt, options);
    return JSON.parse(text) as T;
  }

  async generateBatch(prompts: string[], options?: GenerateOptions): Promise<string[]> {
    return Promise.all(prompts.map((p: string) => this.generate(p, options)));
  }
}

// ── Collection Config ─────────────────────────────────────────────────────
const COLLECTION_NAME = 'insurance-policies';

export function createClient(): RAGClient {
  const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
  const [host, portStr] = chromaUrl.replace(/^https?:\/\//, '').split(':');

  const adapter = new ChromaAdapter({
    host: host || 'localhost',
    port: parseInt(portStr || '8000', 10)
  });

  return new RAGClient({
    adapter,
    embedder: new DemoEmbedder(),
    llm: new DemoLLM(),
    defaultCollection: COLLECTION_NAME,
    defaultTopK: 10
  });
}

export { COLLECTION_NAME };

// If run directly, test the connection
if (require.main === module) {
  (async () => {
    console.log('Testing connection...');
    const client = createClient();
    try {
      const exists = await client.collectionExists(COLLECTION_NAME);
      console.log(`Collection "${COLLECTION_NAME}" exists: ${exists}`);
      console.log('Connection successful!');
    } catch (err) {
      console.error('Connection failed. Is Chroma running?');
      console.error('Start it with: docker run -p 8000:8000 chromadb/chroma');
      console.error(err);
    }
  })();
}
