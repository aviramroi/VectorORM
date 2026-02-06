# Phase 4: Enrichment Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build enrichment pipeline to retrofit existing vector databases with Vertical and Horizontal RAG metadata.

**Architecture:** LLMClient abstraction → 4 theme classifiers → EnrichmentPipeline orchestrator with vertical (mapping/extractors/LLM) and horizontal (themes/sections) enrichment methods.

**Tech Stack:** TypeScript, Vitest, @xenova/transformers for zero-shot, existing VectorDBAdapter and Embedder abstractions

---

## Task 1: LLM Abstraction

**Files:**
- Create: `packages/core/src/llm/llm-client.ts`
- Create: `packages/core/src/llm/types.ts`
- Create: `packages/core/src/llm/mock-llm.ts`
- Create: `packages/core/src/llm/index.ts`
- Create: `packages/core/tests/llm/llm-client.test.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Write failing test for LLMClient abstraction**

Create `packages/core/tests/llm/llm-client.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { LLMClient } from '../../src/llm/llm-client';

class TestLLM extends LLMClient {
  get modelName(): string { return 'test-model'; }
  get provider(): string { return 'test'; }

  async generate(prompt: string): Promise<string> {
    return `Response to: ${prompt}`;
  }

  async generateJSON<T>(prompt: string): Promise<T> {
    return { result: 'test' } as T;
  }

  async generateBatch(prompts: string[]): Promise<string[]> {
    return prompts.map(p => `Response to: ${p}`);
  }
}

describe('LLMClient', () => {
  it('should prevent direct instantiation', () => {
    expect(() => new (LLMClient as any)()).toThrow('Cannot instantiate abstract class');
  });

  it('should allow subclass instantiation', () => {
    const llm = new TestLLM();
    expect(llm.modelName).toBe('test-model');
    expect(llm.provider).toBe('test');
  });

  it('should generate text', async () => {
    const llm = new TestLLM();
    const result = await llm.generate('test prompt');
    expect(result).toBe('Response to: test prompt');
  });

  it('should generate JSON', async () => {
    const llm = new TestLLM();
    const result = await llm.generateJSON<{ result: string }>('test prompt');
    expect(result).toEqual({ result: 'test' });
  });

  it('should generate batch', async () => {
    const llm = new TestLLM();
    const results = await llm.generateBatch(['prompt1', 'prompt2']);
    expect(results).toHaveLength(2);
    expect(results[0]).toBe('Response to: prompt1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/llm/llm-client.test.ts`
Expected: FAIL - "Cannot find module '../../src/llm/llm-client'"

**Step 3: Create types file**

Create `packages/core/src/llm/types.ts`:

```typescript
/**
 * Options for LLM generation.
 */
export interface GenerateOptions {
  /**
   * Temperature for randomness (0.0 to 2.0).
   * Lower = more deterministic, higher = more random.
   */
  temperature?: number;

  /**
   * Maximum tokens to generate.
   */
  maxTokens?: number;

  /**
   * System prompt to set context/behavior.
   */
  systemPrompt?: string;

  /**
   * Sequences where generation should stop.
   */
  stopSequences?: string[];
}
```

**Step 4: Create LLMClient abstract class**

Create `packages/core/src/llm/llm-client.ts`:

```typescript
import { GenerateOptions } from './types';

/**
 * Abstract base class for Large Language Model clients.
 *
 * This abstraction allows the enrichment pipeline to work with any LLM provider
 * (OpenAI, Anthropic, etc.) by implementing a consistent interface.
 *
 * @example
 * ```typescript
 * class OpenAILLM extends LLMClient {
 *   get modelName(): string { return 'gpt-4'; }
 *   get provider(): string { return 'openai'; }
 *
 *   async generate(prompt: string, options?: GenerateOptions): Promise<string> {
 *     // Call OpenAI API
 *   }
 * }
 * ```
 */
export abstract class LLMClient {
  /**
   * The name/identifier of the LLM model.
   */
  abstract get modelName(): string;

  /**
   * The provider of the LLM (e.g., 'openai', 'anthropic').
   */
  abstract get provider(): string;

  /**
   * Generate text from a prompt.
   *
   * @param prompt - The input prompt
   * @param options - Generation options
   * @returns Generated text
   */
  abstract generate(
    prompt: string,
    options?: GenerateOptions
  ): Promise<string>;

  /**
   * Generate structured JSON output from a prompt.
   * Uses JSON mode where available, otherwise parses from text.
   *
   * @param prompt - The input prompt
   * @param schema - Optional JSON schema for validation
   * @param options - Generation options
   * @returns Parsed JSON object
   */
  abstract generateJSON<T = any>(
    prompt: string,
    schema?: object,
    options?: GenerateOptions
  ): Promise<T>;

  /**
   * Generate text for multiple prompts efficiently.
   *
   * @param prompts - Array of input prompts
   * @param options - Generation options
   * @returns Array of generated texts
   */
  abstract generateBatch(
    prompts: string[],
    options?: GenerateOptions
  ): Promise<string[]>;

  /**
   * Constructor is protected to prevent direct instantiation.
   */
  protected constructor() {
    if (new.target === LLMClient) {
      throw new Error('Cannot instantiate abstract class LLMClient directly');
    }
  }
}
```

**Step 5: Create mock LLM for testing**

Create `packages/core/src/llm/mock-llm.ts`:

```typescript
import { LLMClient } from './llm-client';
import { GenerateOptions } from './types';

/**
 * Mock LLM client for testing.
 * Returns deterministic responses based on input.
 */
export class MockLLM extends LLMClient {
  private responses: Map<string, string> = new Map();

  constructor(
    private model: string = 'mock-model',
    private providerName: string = 'mock'
  ) {
    super();
  }

  get modelName(): string {
    return this.model;
  }

  get provider(): string {
    return this.providerName;
  }

  /**
   * Set a canned response for a specific prompt.
   */
  setResponse(prompt: string, response: string): void {
    this.responses.set(prompt, response);
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    if (this.responses.has(prompt)) {
      return this.responses.get(prompt)!;
    }
    return `Mock response to: ${prompt}`;
  }

  async generateJSON<T>(
    prompt: string,
    schema?: object,
    options?: GenerateOptions
  ): Promise<T> {
    const text = await this.generate(prompt, options);
    try {
      return JSON.parse(text);
    } catch {
      // If not valid JSON, return wrapped object
      return { response: text } as T;
    }
  }

  async generateBatch(
    prompts: string[],
    options?: GenerateOptions
  ): Promise<string[]> {
    return Promise.all(prompts.map(p => this.generate(p, options)));
  }
}
```

**Step 6: Create index file**

Create `packages/core/src/llm/index.ts`:

```typescript
export * from './llm-client';
export * from './types';
export * from './mock-llm';
```

**Step 7: Update core index**

Modify `packages/core/src/index.ts`, add:

```typescript
export * from './llm';
```

**Step 8: Run tests to verify they pass**

Run: `npm test -- tests/llm/llm-client.test.ts`
Expected: PASS - 5 tests passing

**Step 9: Commit**

```bash
git add packages/core/src/llm/ packages/core/tests/llm/ packages/core/src/index.ts
git commit -m "feat(llm): add LLMClient abstraction with mock implementation

- Abstract LLMClient class for LLM providers
- GenerateOptions interface
- MockLLM for testing
- Tests for abstract class and mock

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Theme Classifier Interface

**Files:**
- Create: `packages/core/src/enrichment/classifiers/theme-classifier.ts`
- Create: `packages/core/src/enrichment/classifiers/index.ts`
- Create: `packages/core/src/enrichment/index.ts`
- Create: `packages/core/tests/enrichment/classifiers/theme-classifier.test.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Write failing test for theme classifier interface**

Create `packages/core/tests/enrichment/classifiers/theme-classifier.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ThemeClassifier, ThemeClassification } from '../../../src/enrichment/classifiers/theme-classifier';

class TestClassifier implements ThemeClassifier {
  async classify(text: string): Promise<ThemeClassification> {
    return { theme: 'test', confidence: 1.0 };
  }

  async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
    return texts.map(() => ({ theme: 'test', confidence: 1.0 }));
  }
}

describe('ThemeClassifier', () => {
  it('should classify single text', async () => {
    const classifier = new TestClassifier();
    const result = await classifier.classify('test text');
    expect(result.theme).toBe('test');
    expect(result.confidence).toBe(1.0);
  });

  it('should classify batch of texts', async () => {
    const classifier = new TestClassifier();
    const results = await classifier.classifyBatch(['text1', 'text2']);
    expect(results).toHaveLength(2);
    expect(results[0].theme).toBe('test');
  });

  it('should include optional allScores', async () => {
    class DetailedClassifier implements ThemeClassifier {
      async classify(text: string): Promise<ThemeClassification> {
        return {
          theme: 'tech',
          confidence: 0.8,
          allScores: { tech: 0.8, legal: 0.2 }
        };
      }
      async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
        return texts.map(() => this.classify(''));
      }
    }

    const classifier = new DetailedClassifier();
    const result = await classifier.classify('test');
    expect(result.allScores).toBeDefined();
    expect(result.allScores?.tech).toBe(0.8);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/enrichment/classifiers/theme-classifier.test.ts`
Expected: FAIL - "Cannot find module"

**Step 3: Create theme classifier interface**

Create `packages/core/src/enrichment/classifiers/theme-classifier.ts`:

```typescript
/**
 * Result of theme classification.
 */
export interface ThemeClassification {
  /**
   * The primary theme assigned to the text.
   */
  theme: string;

  /**
   * Confidence score for the primary theme (0.0 to 1.0).
   */
  confidence: number;

  /**
   * Optional scores for all themes.
   * Useful for multi-theme classification or debugging.
   */
  allScores?: Record<string, number>;
}

/**
 * Interface for theme classification strategies.
 *
 * Theme classifiers analyze text and assign it to one of a predefined
 * set of themes (e.g., 'legal', 'financial', 'technical').
 *
 * Different implementations provide different trade-offs:
 * - KeywordThemeClassifier: Fast, deterministic
 * - ZeroShotThemeClassifier: Good accuracy, runs locally
 * - EmbeddingThemeClassifier: Semantic understanding
 * - LLMThemeClassifier: Highest quality, requires API calls
 */
export interface ThemeClassifier {
  /**
   * Classify a single text into a theme.
   *
   * @param text - The text to classify
   * @returns Theme classification with confidence score
   */
  classify(text: string): Promise<ThemeClassification>;

  /**
   * Classify multiple texts efficiently.
   *
   * @param texts - Array of texts to classify
   * @returns Array of theme classifications
   */
  classifyBatch(texts: string[]): Promise<ThemeClassification[]>;
}
```

**Step 4: Create classifier index**

Create `packages/core/src/enrichment/classifiers/index.ts`:

```typescript
export * from './theme-classifier';
```

**Step 5: Create enrichment index**

Create `packages/core/src/enrichment/index.ts`:

```typescript
export * from './classifiers';
```

**Step 6: Update core index**

Modify `packages/core/src/index.ts`, add:

```typescript
export * from './enrichment';
```

**Step 7: Run tests to verify they pass**

Run: `npm test -- tests/enrichment/classifiers/theme-classifier.test.ts`
Expected: PASS - 3 tests passing

**Step 8: Commit**

```bash
git add packages/core/src/enrichment/ packages/core/tests/enrichment/ packages/core/src/index.ts
git commit -m "feat(enrichment): add ThemeClassifier interface

- ThemeClassification result type
- ThemeClassifier interface for theme classification strategies
- Tests for interface compliance

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Keyword Theme Classifier

**Files:**
- Create: `packages/core/src/enrichment/classifiers/keyword-classifier.ts`
- Create: `packages/core/tests/enrichment/classifiers/keyword-classifier.test.ts`
- Modify: `packages/core/src/enrichment/classifiers/index.ts`

**Step 1: Write failing tests for keyword classifier**

Create `packages/core/tests/enrichment/classifiers/keyword-classifier.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { KeywordThemeClassifier } from '../../../src/enrichment/classifiers/keyword-classifier';

describe('KeywordThemeClassifier', () => {
  const themes = ['legal', 'financial', 'technical'];
  const keywords = {
    legal: ['contract', 'law', 'clause', 'agreement'],
    financial: ['revenue', 'profit', 'budget', 'cost'],
    technical: ['code', 'software', 'algorithm', 'system']
  };

  let classifier: KeywordThemeClassifier;

  beforeEach(() => {
    classifier = new KeywordThemeClassifier(themes, keywords);
  });

  it('should classify text with clear theme', async () => {
    const result = await classifier.classify('The contract includes several legal clauses.');
    expect(result.theme).toBe('legal');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should classify text with financial keywords', async () => {
    const result = await classifier.classify('Our revenue and profit margins improved.');
    expect(result.theme).toBe('financial');
  });

  it('should handle text with no matches', async () => {
    const result = await classifier.classify('Hello world');
    expect(result.theme).toBeDefined();
    expect(result.confidence).toBe(0);
  });

  it('should be case insensitive by default', async () => {
    const result = await classifier.classify('CONTRACT and LAW');
    expect(result.theme).toBe('legal');
  });

  it('should respect case sensitivity when configured', async () => {
    const caseSensitive = new KeywordThemeClassifier(themes, keywords, true);
    const result = await caseSensitive.classify('CONTRACT');
    expect(result.confidence).toBe(0); // No lowercase match
  });

  it('should return highest scoring theme', async () => {
    const result = await classifier.classify('legal contract with revenue and budget');
    // 'legal' has 2 matches, 'financial' has 2 matches, should pick one consistently
    expect(['legal', 'financial']).toContain(result.theme);
  });

  it('should include all scores in result', async () => {
    const result = await classifier.classify('software system with code');
    expect(result.allScores).toBeDefined();
    expect(result.allScores?.technical).toBeGreaterThan(0);
  });

  it('should normalize confidence scores', async () => {
    const result = await classifier.classify('contract law agreement clause');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should classify batch of texts', async () => {
    const texts = [
      'legal contract',
      'revenue profit',
      'software code'
    ];
    const results = await classifier.classifyBatch(texts);
    expect(results).toHaveLength(3);
    expect(results[0].theme).toBe('legal');
    expect(results[1].theme).toBe('financial');
    expect(results[2].theme).toBe('technical');
  });

  it('should handle empty text', async () => {
    const result = await classifier.classify('');
    expect(result.theme).toBeDefined();
    expect(result.confidence).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/enrichment/classifiers/keyword-classifier.test.ts`
Expected: FAIL - "Cannot find module"

**Step 3: Implement keyword classifier**

Create `packages/core/src/enrichment/classifiers/keyword-classifier.ts`:

```typescript
import { ThemeClassifier, ThemeClassification } from './theme-classifier';

/**
 * Theme classifier based on keyword matching.
 *
 * Fast, deterministic classifier that counts keyword matches
 * and assigns the theme with the most matches.
 *
 * @example
 * ```typescript
 * const classifier = new KeywordThemeClassifier(
 *   ['legal', 'financial'],
 *   {
 *     legal: ['contract', 'law', 'clause'],
 *     financial: ['revenue', 'profit', 'cost']
 *   }
 * );
 *
 * const result = await classifier.classify('The contract includes payment terms.');
 * // { theme: 'legal', confidence: 0.67, allScores: { legal: 2, financial: 0 } }
 * ```
 */
export class KeywordThemeClassifier implements ThemeClassifier {
  private keywordPatterns: Map<string, RegExp[]> = new Map();

  constructor(
    private themes: string[],
    private keywords: Record<string, string[]>,
    private caseSensitive: boolean = false
  ) {
    // Precompile regex patterns for each theme
    for (const theme of themes) {
      const themeKeywords = keywords[theme] || [];
      const patterns = themeKeywords.map(keyword => {
        const flags = caseSensitive ? 'g' : 'gi';
        // Match whole words only
        return new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, flags);
      });
      this.keywordPatterns.set(theme, patterns);
    }
  }

  async classify(text: string): Promise<ThemeClassification> {
    const scores: Record<string, number> = {};
    let maxScore = 0;
    let maxTheme = this.themes[0] || 'unknown';

    // Count matches for each theme
    for (const theme of this.themes) {
      const patterns = this.keywordPatterns.get(theme) || [];
      let score = 0;

      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          score += matches.length;
        }
      }

      scores[theme] = score;

      if (score > maxScore) {
        maxScore = score;
        maxTheme = theme;
      }
    }

    // Normalize confidence (max possible score is total keyword count)
    const totalKeywords = this.keywords[maxTheme]?.length || 1;
    const confidence = maxScore > 0 ? Math.min(maxScore / totalKeywords, 1.0) : 0;

    return {
      theme: maxTheme,
      confidence,
      allScores: scores
    };
  }

  async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
    return Promise.all(texts.map(text => this.classify(text)));
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
```

**Step 4: Update classifier index**

Modify `packages/core/src/enrichment/classifiers/index.ts`, add:

```typescript
export * from './keyword-classifier';
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/enrichment/classifiers/keyword-classifier.test.ts`
Expected: PASS - 11 tests passing

**Step 6: Commit**

```bash
git add packages/core/src/enrichment/classifiers/keyword-classifier.ts packages/core/tests/enrichment/classifiers/keyword-classifier.test.ts packages/core/src/enrichment/classifiers/index.ts
git commit -m "feat(enrichment): add KeywordThemeClassifier

- Fast keyword-based theme classification
- Case-sensitive and case-insensitive modes
- Returns confidence scores and all theme scores
- Batch classification support
- 11 tests covering various scenarios

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Zero-Shot Theme Classifier

**Files:**
- Create: `packages/core/src/enrichment/classifiers/zero-shot-classifier.ts`
- Create: `packages/core/tests/enrichment/classifiers/zero-shot-classifier.test.ts`
- Modify: `packages/core/src/enrichment/classifiers/index.ts`

**Step 1: Write failing tests for zero-shot classifier**

Create `packages/core/tests/enrichment/classifiers/zero-shot-classifier.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ZeroShotThemeClassifier } from '../../../src/enrichment/classifiers/zero-shot-classifier';

describe('ZeroShotThemeClassifier', () => {
  const themes = ['legal', 'financial', 'technical'];
  let classifier: ZeroShotThemeClassifier;

  beforeEach(() => {
    classifier = new ZeroShotThemeClassifier(themes);
  });

  it('should classify text with clear theme', async () => {
    const result = await classifier.classify('This is a software development project using Python.');
    expect(result.theme).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  }, 30000); // Longer timeout for model loading

  it('should include all theme scores', async () => {
    const result = await classifier.classify('Contract terms and conditions');
    expect(result.allScores).toBeDefined();
    expect(Object.keys(result.allScores!)).toEqual(themes);
  }, 30000);

  it('should classify batch of texts', async () => {
    const texts = [
      'Legal agreement',
      'Financial statement'
    ];
    const results = await classifier.classifyBatch(texts);
    expect(results).toHaveLength(2);
    expect(results[0].theme).toBeDefined();
    expect(results[1].theme).toBeDefined();
  }, 30000);

  it('should handle empty text', async () => {
    const result = await classifier.classify('');
    expect(result.theme).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('should use custom model if provided', () => {
    const customClassifier = new ZeroShotThemeClassifier(
      themes,
      'Xenova/distilbert-base-uncased-mnli'
    );
    expect(customClassifier).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/enrichment/classifiers/zero-shot-classifier.test.ts`
Expected: FAIL - "Cannot find module"

**Step 3: Implement zero-shot classifier**

Create `packages/core/src/enrichment/classifiers/zero-shot-classifier.ts`:

```typescript
import { ThemeClassifier, ThemeClassification } from './theme-classifier';
import { pipeline, ZeroShotClassificationPipeline } from '@xenova/transformers';

/**
 * Theme classifier using zero-shot classification.
 *
 * Uses Transformers.js to run zero-shot classification locally
 * without requiring training data or API calls.
 *
 * @example
 * ```typescript
 * const classifier = new ZeroShotThemeClassifier(['legal', 'financial']);
 * const result = await classifier.classify('Annual revenue report');
 * // { theme: 'financial', confidence: 0.89, allScores: {...} }
 * ```
 */
export class ZeroShotThemeClassifier implements ThemeClassifier {
  private model: ZeroShotClassificationPipeline | null = null;
  private modelPromise: Promise<ZeroShotClassificationPipeline> | null = null;

  constructor(
    private themes: string[],
    private modelName: string = 'Xenova/distilbert-base-uncased-mnli'
  ) {}

  private async ensureModel(): Promise<ZeroShotClassificationPipeline> {
    if (this.model) {
      return this.model;
    }

    if (!this.modelPromise) {
      this.modelPromise = pipeline('zero-shot-classification', this.modelName);
    }

    this.model = await this.modelPromise;
    return this.model;
  }

  async classify(text: string): Promise<ThemeClassification> {
    const model = await this.ensureModel();

    // Handle empty text
    if (!text.trim()) {
      const defaultScores: Record<string, number> = {};
      const defaultConfidence = 1.0 / this.themes.length;
      this.themes.forEach(theme => {
        defaultScores[theme] = defaultConfidence;
      });
      return {
        theme: this.themes[0] || 'unknown',
        confidence: defaultConfidence,
        allScores: defaultScores
      };
    }

    const result = await model(text, this.themes, {
      multi_label: false
    });

    // Extract scores
    const allScores: Record<string, number> = {};
    for (let i = 0; i < result.labels.length; i++) {
      allScores[result.labels[i]] = result.scores[i];
    }

    return {
      theme: result.labels[0],
      confidence: result.scores[0],
      allScores
    };
  }

  async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
    // Process sequentially to avoid memory issues
    const results: ThemeClassification[] = [];
    for (const text of texts) {
      results.push(await this.classify(text));
    }
    return results;
  }
}
```

**Step 4: Update classifier index**

Modify `packages/core/src/enrichment/classifiers/index.ts`, add:

```typescript
export * from './zero-shot-classifier';
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/enrichment/classifiers/zero-shot-classifier.test.ts`
Expected: PASS - 5 tests passing (may take 20-30s for model download first time)

**Step 6: Commit**

```bash
git add packages/core/src/enrichment/classifiers/zero-shot-classifier.ts packages/core/tests/enrichment/classifiers/zero-shot-classifier.test.ts packages/core/src/enrichment/classifiers/index.ts
git commit -m "feat(enrichment): add ZeroShotThemeClassifier

- Zero-shot classification using Transformers.js
- Runs locally without API calls
- Good semantic understanding
- Lazy model loading for performance
- 5 tests covering classification scenarios

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Embedding Theme Classifier

**Files:**
- Create: `packages/core/src/enrichment/classifiers/embedding-classifier.ts`
- Create: `packages/core/tests/enrichment/classifiers/embedding-classifier.test.ts`
- Modify: `packages/core/src/enrichment/classifiers/index.ts`

**Step 1: Write failing tests for embedding classifier**

Create `packages/core/tests/enrichment/classifiers/embedding-classifier.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingThemeClassifier } from '../../../src/enrichment/classifiers/embedding-classifier';
import { MockEmbedder } from '../../../src/embedders/mock-embedder';

describe('EmbeddingThemeClassifier', () => {
  const themes = ['legal', 'financial', 'technical'];
  let embedder: MockEmbedder;
  let classifier: EmbeddingThemeClassifier;

  beforeEach(() => {
    embedder = new MockEmbedder(384);

    // Set up mock embeddings with distinguishable patterns
    embedder.setEmbedding('legal', new Array(384).fill(0).map((_, i) => i % 3 === 0 ? 1 : 0));
    embedder.setEmbedding('financial', new Array(384).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0));
    embedder.setEmbedding('technical', new Array(384).fill(0).map((_, i) => i % 3 === 2 ? 1 : 0));

    classifier = new EmbeddingThemeClassifier(themes, embedder);
  });

  it('should precompute theme embeddings in constructor', async () => {
    // Constructor should have computed theme embeddings
    expect(classifier).toBeDefined();
  });

  it('should classify text based on cosine similarity', async () => {
    embedder.setEmbedding('This is a legal document', new Array(384).fill(0).map((_, i) => i % 3 === 0 ? 0.9 : 0.1));

    const result = await classifier.classify('This is a legal document');
    expect(result.theme).toBe('legal');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should include all theme scores', async () => {
    const result = await classifier.classify('test text');
    expect(result.allScores).toBeDefined();
    expect(Object.keys(result.allScores!)).toEqual(themes);
  });

  it('should normalize cosine similarity to confidence', async () => {
    const result = await classifier.classify('test text');
    // Cosine similarity ranges from -1 to 1, should be normalized to 0-1
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should classify batch of texts', async () => {
    const texts = ['text1', 'text2', 'text3'];
    const results = await classifier.classifyBatch(texts);
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(themes).toContain(result.theme);
    });
  });

  it('should handle empty text', async () => {
    const result = await classifier.classify('');
    expect(result.theme).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should use pre-provided theme embeddings if given', async () => {
    const themeEmbeddings = [
      new Array(384).fill(1),
      new Array(384).fill(0.5),
      new Array(384).fill(0.1)
    ];

    const classifierWithEmbeddings = new EmbeddingThemeClassifier(
      themes,
      embedder,
      themeEmbeddings
    );

    const result = await classifierWithEmbeddings.classify('test');
    expect(result.theme).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/enrichment/classifiers/embedding-classifier.test.ts`
Expected: FAIL - "Cannot find module"

**Step 3: Implement embedding classifier**

Create `packages/core/src/enrichment/classifiers/embedding-classifier.ts`:

```typescript
import { ThemeClassifier, ThemeClassification } from './theme-classifier';
import { Embedder } from '../../embedders/embedder';

/**
 * Theme classifier using embedding cosine similarity.
 *
 * Computes embeddings for each theme and compares them to text embeddings
 * using cosine similarity. Good semantic understanding with fast inference.
 *
 * @example
 * ```typescript
 * const classifier = new EmbeddingThemeClassifier(
 *   ['legal', 'financial'],
 *   myEmbedder
 * );
 * const result = await classifier.classify('Contract agreement');
 * // { theme: 'legal', confidence: 0.92, allScores: {...} }
 * ```
 */
export class EmbeddingThemeClassifier implements ThemeClassifier {
  private themeEmbeddings: number[][] = [];
  private initialized: boolean = false;

  constructor(
    private themes: string[],
    private embedder: Embedder,
    precomputedEmbeddings?: number[][]
  ) {
    if (precomputedEmbeddings) {
      this.themeEmbeddings = precomputedEmbeddings;
      this.initialized = true;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Compute embeddings for each theme
    this.themeEmbeddings = await this.embedder.embedBatch(this.themes);
    this.initialized = true;
  }

  async classify(text: string): Promise<ThemeClassification> {
    await this.ensureInitialized();

    // Handle empty text
    if (!text.trim()) {
      const defaultScores: Record<string, number> = {};
      const defaultConfidence = 1.0 / this.themes.length;
      this.themes.forEach(theme => {
        defaultScores[theme] = defaultConfidence;
      });
      return {
        theme: this.themes[0] || 'unknown',
        confidence: defaultConfidence,
        allScores: defaultScores
      };
    }

    // Get embedding for text
    const textEmbedding = await this.embedder.embed(text);

    // Compute cosine similarity with each theme
    const similarities: number[] = [];
    for (const themeEmbedding of this.themeEmbeddings) {
      const similarity = this.cosineSimilarity(textEmbedding, themeEmbedding);
      similarities.push(similarity);
    }

    // Find best match
    let maxIndex = 0;
    let maxSimilarity = similarities[0];
    for (let i = 1; i < similarities.length; i++) {
      if (similarities[i] > maxSimilarity) {
        maxSimilarity = similarities[i];
        maxIndex = i;
      }
    }

    // Build scores object
    const allScores: Record<string, number> = {};
    for (let i = 0; i < this.themes.length; i++) {
      // Normalize cosine similarity from [-1, 1] to [0, 1]
      allScores[this.themes[i]] = (similarities[i] + 1) / 2;
    }

    return {
      theme: this.themes[maxIndex],
      confidence: (maxSimilarity + 1) / 2, // Normalize to 0-1
      allScores
    };
  }

  async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
    await this.ensureInitialized();
    return Promise.all(texts.map(text => this.classify(text)));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}
```

**Step 4: Update classifier index**

Modify `packages/core/src/enrichment/classifiers/index.ts`, add:

```typescript
export * from './embedding-classifier';
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/enrichment/classifiers/embedding-classifier.test.ts`
Expected: PASS - 7 tests passing

**Step 6: Commit**

```bash
git add packages/core/src/enrichment/classifiers/embedding-classifier.ts packages/core/tests/enrichment/classifiers/embedding-classifier.test.ts packages/core/src/enrichment/classifiers/index.ts
git commit -m "feat(enrichment): add EmbeddingThemeClassifier

- Theme classification via cosine similarity
- Precomputes theme embeddings for efficiency
- Good semantic understanding
- Cosine similarity implementation
- 7 tests covering classification scenarios

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: LLM Theme Classifier

**Files:**
- Create: `packages/core/src/enrichment/classifiers/llm-classifier.ts`
- Create: `packages/core/tests/enrichment/classifiers/llm-classifier.test.ts`
- Modify: `packages/core/src/enrichment/classifiers/index.ts`

**Step 1: Write failing tests for LLM classifier**

Create `packages/core/tests/enrichment/classifiers/llm-classifier.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { LLMThemeClassifier } from '../../../src/enrichment/classifiers/llm-classifier';
import { MockLLM } from '../../../src/llm/mock-llm';

describe('LLMThemeClassifier', () => {
  const themes = ['legal', 'financial', 'technical'];
  let llm: MockLLM;
  let classifier: LLMThemeClassifier;

  beforeEach(() => {
    llm = new MockLLM();
    classifier = new LLMThemeClassifier(themes, llm);
  });

  it('should classify text using LLM', async () => {
    llm.setResponse(
      expect.stringContaining('legal, financial, technical'),
      JSON.stringify({ theme: 'legal', confidence: 0.9 })
    );

    const result = await classifier.classify('This is a contract document');
    expect(result.theme).toBe('legal');
    expect(result.confidence).toBe(0.9);
  });

  it('should handle JSON response from LLM', async () => {
    llm.setResponse(
      expect.any(String),
      JSON.stringify({
        theme: 'financial',
        confidence: 0.85,
        allScores: { legal: 0.1, financial: 0.85, technical: 0.05 }
      })
    );

    const result = await classifier.classify('Revenue analysis');
    expect(result.theme).toBe('financial');
    expect(result.allScores).toBeDefined();
  });

  it('should use custom prompt template if provided', async () => {
    const customTemplate = 'Custom: {text} | Themes: {themes}';
    const customClassifier = new LLMThemeClassifier(themes, llm, customTemplate);

    llm.setResponse(
      expect.stringContaining('Custom:'),
      JSON.stringify({ theme: 'technical', confidence: 0.8 })
    );

    const result = await customClassifier.classify('Software code');
    expect(result.theme).toBe('technical');
  });

  it('should classify batch of texts', async () => {
    const texts = ['legal text', 'financial text'];

    llm.setResponse(
      expect.stringContaining('legal text'),
      JSON.stringify({ theme: 'legal', confidence: 0.9 })
    );
    llm.setResponse(
      expect.stringContaining('financial text'),
      JSON.stringify({ theme: 'financial', confidence: 0.85 })
    );

    const results = await classifier.classifyBatch(texts);
    expect(results).toHaveLength(2);
    expect(results[0].theme).toBe('legal');
    expect(results[1].theme).toBe('financial');
  });

  it('should handle empty text', async () => {
    llm.setResponse(
      expect.any(String),
      JSON.stringify({ theme: 'legal', confidence: 0 })
    );

    const result = await classifier.classify('');
    expect(result.theme).toBeDefined();
  });

  it('should handle malformed JSON from LLM', async () => {
    llm.setResponse(
      expect.any(String),
      'Not valid JSON'
    );

    await expect(classifier.classify('test')).rejects.toThrow();
  });

  it('should include default prompt elements', async () => {
    let capturedPrompt = '';
    const capturingLLM = new MockLLM();
    capturingLLM.generateJSON = async (prompt: string) => {
      capturedPrompt = prompt;
      return { theme: 'legal', confidence: 0.9 };
    };

    const capturingClassifier = new LLMThemeClassifier(themes, capturingLLM);
    await capturingClassifier.classify('test text');

    expect(capturedPrompt).toContain('legal');
    expect(capturedPrompt).toContain('financial');
    expect(capturedPrompt).toContain('technical');
    expect(capturedPrompt).toContain('test text');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/enrichment/classifiers/llm-classifier.test.ts`
Expected: FAIL - "Cannot find module"

**Step 3: Implement LLM classifier**

Create `packages/core/src/enrichment/classifiers/llm-classifier.ts`:

```typescript
import { ThemeClassifier, ThemeClassification } from './theme-classifier';
import { LLMClient } from '../../llm/llm-client';

const DEFAULT_PROMPT_TEMPLATE = `Classify the following text into one of these themes: {themes}

Text: {text}

Respond with a JSON object containing:
- "theme": the most appropriate theme from the list
- "confidence": a number between 0 and 1 indicating confidence
- "allScores": (optional) an object with scores for each theme

Example response:
{"theme": "legal", "confidence": 0.92, "allScores": {"legal": 0.92, "financial": 0.05, "technical": 0.03}}`;

/**
 * Theme classifier using LLM for classification.
 *
 * Highest quality classification with best contextual understanding.
 * Requires API calls (cost consideration) but most flexible.
 *
 * @example
 * ```typescript
 * const classifier = new LLMThemeClassifier(
 *   ['legal', 'financial'],
 *   myLLMClient
 * );
 * const result = await classifier.classify('Complex contract terms');
 * // { theme: 'legal', confidence: 0.95, allScores: {...} }
 * ```
 */
export class LLMThemeClassifier implements ThemeClassifier {
  private promptTemplate: string;

  constructor(
    private themes: string[],
    private llm: LLMClient,
    customPromptTemplate?: string
  ) {
    this.promptTemplate = customPromptTemplate || DEFAULT_PROMPT_TEMPLATE;
  }

  async classify(text: string): Promise<ThemeClassification> {
    const prompt = this.buildPrompt(text);

    try {
      const response = await this.llm.generateJSON<{
        theme: string;
        confidence: number;
        allScores?: Record<string, number>;
      }>(prompt);

      return {
        theme: response.theme,
        confidence: response.confidence,
        allScores: response.allScores
      };
    } catch (error) {
      throw new Error(
        `LLM theme classification failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
    // Process sequentially to avoid rate limits
    const results: ThemeClassification[] = [];
    for (const text of texts) {
      results.push(await this.classify(text));
    }
    return results;
  }

  private buildPrompt(text: string): string {
    return this.promptTemplate
      .replace('{themes}', this.themes.join(', '))
      .replace('{text}', text);
  }
}
```

**Step 4: Update classifier index**

Modify `packages/core/src/enrichment/classifiers/index.ts`, add:

```typescript
export * from './llm-classifier';
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/enrichment/classifiers/llm-classifier.test.ts`
Expected: PASS - 7 tests passing

**Step 6: Commit**

```bash
git add packages/core/src/enrichment/classifiers/llm-classifier.ts packages/core/tests/enrichment/classifiers/llm-classifier.test.ts packages/core/src/enrichment/classifiers/index.ts
git commit -m "feat(enrichment): add LLMThemeClassifier

- Theme classification using LLM API
- Highest quality with best contextual understanding
- Custom prompt template support
- Structured JSON output
- 7 tests covering classification and error handling

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Enrichment Types

**Files:**
- Create: `packages/core/src/enrichment/types.ts`
- Modify: `packages/core/src/enrichment/index.ts`

**Step 1: Create enrichment types file**

Create `packages/core/src/enrichment/types.ts`:

```typescript
import { UniversalFilter } from '../filters/types';
import { VectorRecord } from '../types/vector-record';
import { ThemeClassifier } from './classifiers/theme-classifier';
import { LLMClient } from '../llm/llm-client';

/**
 * Progress callback for long-running enrichment operations.
 */
export type ProgressCallback = (
  current: number,
  total: number,
  stats: Partial<EnrichmentStats>
) => void;

/**
 * Statistics returned from enrichment operations.
 */
export interface EnrichmentStats {
  /**
   * Total number of records processed.
   */
  recordsProcessed: number;

  /**
   * Number of records successfully updated.
   */
  recordsUpdated: number;

  /**
   * Number of records skipped (e.g., no metadata changes).
   */
  recordsSkipped: number;

  /**
   * Time taken in milliseconds.
   */
  timeMs: number;

  /**
   * Errors encountered (only present if errors occurred).
   */
  errors?: Error[];
}

/**
 * Configuration for field mapping vertical enrichment.
 */
export interface FieldMappingConfig {
  /**
   * Map of source field to target __v_* field.
   * Example: { 'source': '__v_source', 'doc_id': '__v_doc_id' }
   */
  mapping: Record<string, string>;

  /**
   * Optional filter to enrich only matching records.
   */
  filter?: UniversalFilter;

  /**
   * Batch size for processing.
   */
  batchSize?: number;
}

/**
 * Configuration for extractor function vertical enrichment.
 */
export interface ExtractorConfig {
  /**
   * Function to extract vertical metadata from a record.
   * Should return object with __v_* fields.
   */
  extractor: (record: VectorRecord) => Record<string, any>;

  /**
   * Optional filter to enrich only matching records.
   */
  filter?: UniversalFilter;

  /**
   * Batch size for processing.
   */
  batchSize?: number;
}

/**
 * Configuration for automatic LLM-based vertical enrichment.
 */
export interface AutomaticExtractionConfig {
  /**
   * LLM configuration for extraction.
   */
  automatic: {
    /**
     * LLM client to use for extraction.
     */
    llm: LLMClient;

    /**
     * Fields to extract (e.g., ['docType', 'source', 'tags']).
     */
    fields: string[];

    /**
     * Optional custom prompt template.
     * Variables: {text}, {fields}
     */
    promptTemplate?: string;

    /**
     * Field containing text to analyze (default: 'text').
     */
    textField?: string;
  };

  /**
   * Optional filter to enrich only matching records.
   */
  filter?: UniversalFilter;

  /**
   * Batch size for processing (smaller for LLM operations).
   */
  batchSize?: number;
}

/**
 * Combined configuration for vertical enrichment.
 * Can specify one or more enrichment strategies.
 */
export type VerticalEnrichmentConfig =
  | FieldMappingConfig
  | ExtractorConfig
  | AutomaticExtractionConfig;

/**
 * Configuration for theme classification enrichment.
 */
export interface ThemeEnrichmentConfig {
  /**
   * List of themes to classify into.
   */
  themes: string[];

  /**
   * Theme classifier to use.
   */
  classifier: ThemeClassifier;

  /**
   * Field containing text to classify (default: 'text').
   */
  textField?: string;

  /**
   * Minimum confidence threshold (default: 0.5).
   * Records below threshold are skipped or assigned 'unknown'.
   */
  confidenceThreshold?: number;

  /**
   * Allow multiple themes per record (default: false).
   */
  multiTheme?: boolean;

  /**
   * Optional filter to enrich only matching records.
   */
  filter?: UniversalFilter;

  /**
   * Batch size for processing.
   */
  batchSize?: number;

  /**
   * Optional progress callback.
   */
  onProgress?: ProgressCallback;
}

/**
 * Configuration for section detection enrichment.
 */
export interface SectionEnrichmentConfig {
  /**
   * Map from existing field containing section info.
   */
  existingField?: string;

  /**
   * Auto-detect sections from text.
   */
  autoDetect?: {
    /**
     * Field containing text to analyze.
     */
    textField: string;

    /**
     * Detection strategy.
     */
    strategy: 'markdown' | 'html' | 'pattern';

    /**
     * Custom pattern for 'pattern' strategy.
     */
    customPattern?: RegExp;
  };

  /**
   * Optional filter to enrich only matching records.
   */
  filter?: UniversalFilter;

  /**
   * Batch size for processing.
   */
  batchSize?: number;
}

/**
 * Combined configuration for enrichAll() method.
 */
export interface EnrichAllConfig {
  /**
   * Vertical enrichment configuration.
   */
  vertical?: VerticalEnrichmentConfig;

  /**
   * Theme enrichment configuration.
   */
  themes?: ThemeEnrichmentConfig;

  /**
   * Section enrichment configuration.
   */
  sections?: SectionEnrichmentConfig;

  /**
   * Global filter applied to all enrichment steps.
   */
  filter?: UniversalFilter;

  /**
   * Global batch size (can be overridden per step).
   */
  batchSize?: number;

  /**
   * Global progress callback.
   */
  onProgress?: ProgressCallback;
}
```

**Step 2: Update enrichment index**

Modify `packages/core/src/enrichment/index.ts`, add:

```typescript
export * from './types';
```

**Step 3: Run build to verify types compile**

Run: `npm run build`
Expected: SUCCESS - No TypeScript errors

**Step 4: Commit**

```bash
git add packages/core/src/enrichment/types.ts packages/core/src/enrichment/index.ts
git commit -m "feat(enrichment): add enrichment configuration types

- EnrichmentStats for operation results
- ProgressCallback for progress reporting
- Vertical enrichment configs (mapping, extractor, automatic)
- Theme and section enrichment configs
- EnrichAllConfig for unified enrichment

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: EnrichmentPipeline - Vertical Enrichment

**Files:**
- Create: `packages/core/src/enrichment/enrichment-pipeline.ts`
- Create: `packages/core/tests/enrichment/vertical-enrichment.test.ts`
- Modify: `packages/core/src/enrichment/index.ts`

**Step 1: Write failing tests for vertical enrichment**

Create `packages/core/tests/enrichment/vertical-enrichment.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EnrichmentPipeline } from '../../src/enrichment/enrichment-pipeline';
import { MockAdapter } from '../../src/adapters/mock-adapter';
import { MockLLM } from '../../src/llm/mock-llm';
import { VectorRecord } from '../../src/types/vector-record';

describe('EnrichmentPipeline - Vertical Enrichment', () => {
  let adapter: MockAdapter;
  let pipeline: EnrichmentPipeline;

  beforeEach(() => {
    adapter = new MockAdapter();
    pipeline = new EnrichmentPipeline(adapter);
  });

  describe('Field Mapping', () => {
    it('should map existing fields to vertical fields', async () => {
      // Set up test data
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: { source: '/docs/file1.pdf', type: 'pdf' }
        },
        {
          id: '2',
          embedding: [4, 5, 6],
          metadata: { source: '/docs/file2.txt', type: 'text' }
        }
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        mapping: {
          source: '__v_source',
          type: '__v_doc_type'
        }
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(2);

      const records = adapter.records.get('test-collection')!;
      expect(records[0].metadata.__v_source).toBe('/docs/file1.pdf');
      expect(records[0].metadata.__v_doc_type).toBe('pdf');
      expect(records[1].metadata.__v_source).toBe('/docs/file2.txt');
    });

    it('should skip records without source fields', async () => {
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: { source: '/docs/file1.pdf' }
        },
        {
          id: '2',
          embedding: [4, 5, 6],
          metadata: {} // No source field
        }
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        mapping: { source: '__v_source' }
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(1);
      expect(stats.recordsSkipped).toBe(1);
    });

    it('should respect filter parameter', async () => {
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: { source: '/docs/file1.pdf', year: 2024 }
        },
        {
          id: '2',
          embedding: [4, 5, 6],
          metadata: { source: '/docs/file2.pdf', year: 2023 }
        }
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        mapping: { source: '__v_source' },
        filter: { field: 'year', op: 'eq', value: 2024 }
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(1);
    });
  });

  describe('Extractor Functions', () => {
    it('should extract metadata using custom function', async () => {
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: { source: '/docs/2024/legal/contract.pdf' }
        }
      ]);

      const stats = await pipeline.enrichVertical('test-collection', {
        extractor: (record: VectorRecord) => {
          const source = record.metadata.source || '';
          const parts = source.split('/');
          return {
            __v_partition: parts[2], // '2024'
            __v_doc_type: parts[3],  // 'legal'
            __v_doc_id: parts[4]?.split('.')[0] // 'contract'
          };
        }
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(1);

      const records = adapter.records.get('test-collection')!;
      expect(records[0].metadata.__v_partition).toBe('2024');
      expect(records[0].metadata.__v_doc_type).toBe('legal');
      expect(records[0].metadata.__v_doc_id).toBe('contract');
    });

    it('should handle extractor errors gracefully', async () => {
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: { text: 'test' }
        }
      ]);

      await expect(
        pipeline.enrichVertical('test-collection', {
          extractor: () => {
            throw new Error('Extraction failed');
          }
        })
      ).rejects.toThrow('Extraction failed');
    });
  });

  describe('Automatic LLM Extraction', () => {
    it('should extract metadata using LLM', async () => {
      const llm = new MockLLM();
      llm.setResponse(
        expect.any(String),
        JSON.stringify({
          docType: 'contract',
          source: 'legal_dept',
          tags: ['compliance', 'vendor']
        })
      );

      const pipelineWithLLM = new EnrichmentPipeline(adapter, undefined, llm);

      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: {},
          text: 'This is a vendor compliance contract...'
        }
      ]);

      const stats = await pipelineWithLLM.enrichVertical('test-collection', {
        automatic: {
          llm,
          fields: ['docType', 'source', 'tags']
        }
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(1);

      const records = adapter.records.get('test-collection')!;
      expect(records[0].metadata.__v_doc_type).toBe('contract');
      expect(records[0].metadata.__v_source).toBe('legal_dept');
      expect(records[0].metadata.__v_tags).toEqual(['compliance', 'vendor']);
    });

    it('should use custom text field', async () => {
      const llm = new MockLLM();
      const pipelineWithLLM = new EnrichmentPipeline(adapter, undefined, llm);

      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: { content: 'Custom content field' }
        }
      ]);

      llm.setResponse(
        expect.stringContaining('Custom content field'),
        JSON.stringify({ docType: 'custom' })
      );

      await pipelineWithLLM.enrichVertical('test-collection', {
        automatic: {
          llm,
          fields: ['docType'],
          textField: 'content'
        }
      });

      const records = adapter.records.get('test-collection')!;
      expect(records[0].metadata.__v_doc_type).toBe('custom');
    });

    it('should fail fast on LLM errors', async () => {
      const llm = new MockLLM();
      llm.setResponse(expect.any(String), 'Invalid JSON');

      const pipelineWithLLM = new EnrichmentPipeline(adapter, undefined, llm);

      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: {},
          text: 'test'
        }
      ]);

      await expect(
        pipelineWithLLM.enrichVertical('test-collection', {
          automatic: {
            llm,
            fields: ['docType']
          }
        })
      ).rejects.toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/enrichment/vertical-enrichment.test.ts`
Expected: FAIL - "Cannot find module"

**Step 3: Implement EnrichmentPipeline skeleton**

Create `packages/core/src/enrichment/enrichment-pipeline.ts`:

```typescript
import { VectorDBAdapter } from '../adapters/vector-db-adapter';
import { Embedder } from '../embedders/embedder';
import { LLMClient } from '../llm/llm-client';
import {
  EnrichmentStats,
  VerticalEnrichmentConfig,
  ThemeEnrichmentConfig,
  SectionEnrichmentConfig,
  EnrichAllConfig
} from './types';
import { VectorRecord } from '../types/vector-record';
import { UniversalFilter } from '../filters/types';

/**
 * Pipeline for enriching existing vector database records with metadata.
 *
 * Supports:
 * - Vertical enrichment: Document-level metadata (__v_* fields)
 * - Horizontal enrichment: Theme and section metadata (__h_* fields)
 *
 * @example
 * ```typescript
 * const pipeline = new EnrichmentPipeline(adapter, embedder, llm);
 *
 * // Enrich with document metadata
 * await pipeline.enrichVertical(collection, {
 *   mapping: { source: '__v_source' }
 * });
 *
 * // Enrich with themes
 * await pipeline.enrichThemes(collection, {
 *   themes: ['legal', 'financial'],
 *   classifier: myClassifier
 * });
 * ```
 */
export class EnrichmentPipeline {
  constructor(
    private adapter: VectorDBAdapter,
    private embedder?: Embedder,
    private llm?: LLMClient
  ) {}

  /**
   * Enrich records with vertical (document-level) metadata.
   *
   * Supports three strategies:
   * - Field mapping: Copy existing fields to __v_* fields
   * - Extractor functions: Custom logic to extract metadata
   * - Automatic LLM: LLM analyzes content and extracts metadata
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
      timeMs: 0
    };

    const batchSize = config.batchSize || 100;
    const filter = config.filter;

    // Iterate through records
    const iterator = this.adapter.iterateAll(collection, filter, batchSize, false);

    try {
      for await (const batch of iterator) {
        for (const record of batch) {
          stats.recordsProcessed++;

          let metadata: Record<string, any> = {};
          let shouldUpdate = false;

          // Determine enrichment strategy
          if ('mapping' in config) {
            // Field mapping strategy
            metadata = this.applyFieldMapping(record, config.mapping);
            shouldUpdate = Object.keys(metadata).length > 0;
          } else if ('extractor' in config) {
            // Extractor function strategy
            try {
              metadata = config.extractor(record);
              shouldUpdate = Object.keys(metadata).length > 0;
            } catch (error) {
              throw new Error(
                `Extractor failed for record ${record.id}: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error }
              );
            }
          } else if ('automatic' in config) {
            // Automatic LLM extraction
            metadata = await this.extractWithLLM(record, config.automatic);
            shouldUpdate = Object.keys(metadata).length > 0;
          }

          if (shouldUpdate) {
            await this.adapter.updateMetadata(collection, record.id, metadata, true);
            stats.recordsUpdated++;
          } else {
            stats.recordsSkipped++;
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Vertical enrichment failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }

    stats.timeMs = Date.now() - startTime;
    return stats;
  }

  /**
   * Enrich records with theme classifications.
   */
  async enrichThemes(
    collection: string,
    config: ThemeEnrichmentConfig
  ): Promise<EnrichmentStats> {
    // To be implemented in next task
    throw new Error('Not implemented yet');
  }

  /**
   * Enrich records with section hierarchy metadata.
   */
  async enrichSections(
    collection: string,
    config: SectionEnrichmentConfig
  ): Promise<EnrichmentStats> {
    // To be implemented in next task
    throw new Error('Not implemented yet');
  }

  /**
   * Run multiple enrichment steps in sequence.
   */
  async enrichAll(
    collection: string,
    config: EnrichAllConfig
  ): Promise<EnrichmentStats> {
    // To be implemented in next task
    throw new Error('Not implemented yet');
  }

  private applyFieldMapping(
    record: VectorRecord,
    mapping: Record<string, string>
  ): Record<string, any> {
    const metadata: Record<string, any> = {};

    for (const [sourceField, targetField] of Object.entries(mapping)) {
      if (sourceField in record.metadata) {
        metadata[targetField] = record.metadata[sourceField];
      }
    }

    return metadata;
  }

  private async extractWithLLM(
    record: VectorRecord,
    config: {
      llm: LLMClient;
      fields: string[];
      promptTemplate?: string;
      textField?: string;
    }
  ): Promise<Record<string, any>> {
    if (!this.llm && !config.llm) {
      throw new Error('LLM client required for automatic extraction');
    }

    const llm = config.llm || this.llm!;
    const textField = config.textField || 'text';
    const text = record.text || record.metadata[textField] || '';

    const prompt = config.promptTemplate
      ? config.promptTemplate.replace('{text}', text).replace('{fields}', config.fields.join(', '))
      : this.buildExtractionPrompt(text, config.fields);

    try {
      const extracted = await llm.generateJSON<Record<string, any>>(prompt);

      // Map extracted fields to __v_* format
      const metadata: Record<string, any> = {};
      for (const field of config.fields) {
        if (field in extracted) {
          const verticalField = `__v_${field.toLowerCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '')}`;
          metadata[verticalField] = extracted[field];
        }
      }

      return metadata;
    } catch (error) {
      throw new Error(
        `LLM extraction failed for record ${record.id}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  private buildExtractionPrompt(text: string, fields: string[]): string {
    return `Extract the following metadata fields from this text: ${fields.join(', ')}

Text: ${text}

Respond with a JSON object containing the requested fields.

Example response:
{"docType": "contract", "source": "legal_dept", "tags": ["compliance", "vendor"]}`;
  }
}
```

**Step 4: Update enrichment index**

Modify `packages/core/src/enrichment/index.ts`, add:

```typescript
export * from './enrichment-pipeline';
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/enrichment/vertical-enrichment.test.ts`
Expected: PASS - 10 tests passing

**Step 6: Commit**

```bash
git add packages/core/src/enrichment/enrichment-pipeline.ts packages/core/tests/enrichment/vertical-enrichment.test.ts packages/core/src/enrichment/index.ts
git commit -m "feat(enrichment): add EnrichmentPipeline with vertical enrichment

- Field mapping strategy
- Extractor function strategy
- Automatic LLM extraction strategy
- Filter support for selective enrichment
- Fail-fast error handling
- 10 tests covering all vertical enrichment strategies

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: EnrichmentPipeline - Theme Enrichment

**Files:**
- Create: `packages/core/tests/enrichment/theme-enrichment.test.ts`
- Modify: `packages/core/src/enrichment/enrichment-pipeline.ts`

**Step 1: Write failing tests for theme enrichment**

Create `packages/core/tests/enrichment/theme-enrichment.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnrichmentPipeline } from '../../src/enrichment/enrichment-pipeline';
import { MockAdapter } from '../../src/adapters/mock-adapter';
import { KeywordThemeClassifier } from '../../src/enrichment/classifiers/keyword-classifier';

describe('EnrichmentPipeline - Theme Enrichment', () => {
  let adapter: MockAdapter;
  let pipeline: EnrichmentPipeline;
  let classifier: KeywordThemeClassifier;

  beforeEach(() => {
    adapter = new MockAdapter();
    pipeline = new EnrichmentPipeline(adapter);
    classifier = new KeywordThemeClassifier(
      ['legal', 'financial', 'technical'],
      {
        legal: ['contract', 'law', 'clause'],
        financial: ['revenue', 'profit', 'budget'],
        technical: ['code', 'software', 'system']
      }
    );
  });

  it('should classify and enrich records with themes', async () => {
    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: {},
        text: 'This contract includes legal clauses'
      },
      {
        id: '2',
        embedding: [4, 5, 6],
        metadata: {},
        text: 'Our revenue and profit improved'
      }
    ]);

    const stats = await pipeline.enrichThemes('test-collection', {
      themes: ['legal', 'financial', 'technical'],
      classifier
    });

    expect(stats.recordsProcessed).toBe(2);
    expect(stats.recordsUpdated).toBe(2);

    const records = adapter.records.get('test-collection')!;
    expect(records[0].metadata.__h_theme).toBe('legal');
    expect(records[0].metadata.__h_theme_confidence).toBeGreaterThan(0);
    expect(records[1].metadata.__h_theme).toBe('financial');
  });

  it('should use custom text field', async () => {
    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: { content: 'Software development with code' }
      }
    ]);

    const stats = await pipeline.enrichThemes('test-collection', {
      themes: ['legal', 'financial', 'technical'],
      classifier,
      textField: 'content'
    });

    const records = adapter.records.get('test-collection')!;
    expect(records[0].metadata.__h_theme).toBe('technical');
  });

  it('should skip records below confidence threshold', async () => {
    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: {},
        text: 'Random text with no clear theme'
      }
    ]);

    const stats = await pipeline.enrichThemes('test-collection', {
      themes: ['legal', 'financial', 'technical'],
      classifier,
      confidenceThreshold: 0.5
    });

    expect(stats.recordsProcessed).toBe(1);
    expect(stats.recordsSkipped).toBe(1);
  });

  it('should support multi-theme classification', async () => {
    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: {},
        text: 'Legal contract about financial revenue'
      }
    ]);

    const stats = await pipeline.enrichThemes('test-collection', {
      themes: ['legal', 'financial', 'technical'],
      classifier,
      multiTheme: true,
      confidenceThreshold: 0.3
    });

    const records = adapter.records.get('test-collection')!;
    expect(records[0].metadata.__h_themes).toBeDefined();
    expect(Array.isArray(records[0].metadata.__h_themes)).toBe(true);
  });

  it('should respect filter parameter', async () => {
    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: { year: 2024 },
        text: 'Legal contract'
      },
      {
        id: '2',
        embedding: [4, 5, 6],
        metadata: { year: 2023 },
        text: 'Financial report'
      }
    ]);

    const stats = await pipeline.enrichThemes('test-collection', {
      themes: ['legal', 'financial', 'technical'],
      classifier,
      filter: { field: 'year', op: 'eq', value: 2024 }
    });

    expect(stats.recordsProcessed).toBe(1);
  });

  it('should call progress callback', async () => {
    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: {},
        text: 'Legal contract'
      },
      {
        id: '2',
        embedding: [4, 5, 6],
        metadata: {},
        text: 'Financial report'
      }
    ]);

    const progressCallback = vi.fn();

    await pipeline.enrichThemes('test-collection', {
      themes: ['legal', 'financial', 'technical'],
      classifier,
      onProgress: progressCallback
    });

    expect(progressCallback).toHaveBeenCalled();
    const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1];
    expect(lastCall[0]).toBe(2); // current
    expect(lastCall[1]).toBe(2); // total
  });

  it('should fail fast on classification errors', async () => {
    const errorClassifier = {
      classify: async () => {
        throw new Error('Classification failed');
      },
      classifyBatch: async () => {
        throw new Error('Classification failed');
      }
    };

    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: {},
        text: 'test'
      }
    ]);

    await expect(
      pipeline.enrichThemes('test-collection', {
        themes: ['legal'],
        classifier: errorClassifier
      })
    ).rejects.toThrow('Classification failed');
  });

  it('should process records in batches', async () => {
    // Create 150 records
    const records = Array.from({ length: 150 }, (_, i) => ({
      id: `${i}`,
      embedding: [i, i, i],
      metadata: {},
      text: 'Legal contract'
    }));
    adapter.records.set('test-collection', records);

    const stats = await pipeline.enrichThemes('test-collection', {
      themes: ['legal', 'financial', 'technical'],
      classifier,
      batchSize: 50
    });

    expect(stats.recordsProcessed).toBe(150);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/enrichment/theme-enrichment.test.ts`
Expected: FAIL - enrichThemes throws "Not implemented yet"

**Step 3: Implement enrichThemes method**

Modify `packages/core/src/enrichment/enrichment-pipeline.ts`, replace the `enrichThemes` method:

```typescript
/**
 * Enrich records with theme classifications.
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
    timeMs: 0
  };

  const batchSize = config.batchSize || 100;
  const textField = config.textField || 'text';
  const confidenceThreshold = config.confidenceThreshold ?? 0.5;
  const multiTheme = config.multiTheme || false;
  const filter = config.filter;

  // Count total records for progress reporting
  let totalRecords = 0;
  if (config.onProgress) {
    const countIterator = this.adapter.listAllIds(collection, filter, batchSize);
    for await (const idBatch of countIterator) {
      totalRecords += idBatch.length;
    }
  }

  // Iterate through records
  const iterator = this.adapter.iterateAll(collection, filter, batchSize, false);

  try {
    for await (const batch of iterator) {
      // Extract texts for batch classification
      const texts = batch.map(record => {
        return record.text || record.metadata[textField] || '';
      });

      // Classify batch
      const classifications = await config.classifier.classifyBatch(texts);

      // Update each record
      for (let i = 0; i < batch.length; i++) {
        stats.recordsProcessed++;
        const record = batch[i];
        const classification = classifications[i];

        // Check confidence threshold
        if (classification.confidence < confidenceThreshold) {
          stats.recordsSkipped++;
          continue;
        }

        const metadata: Record<string, any> = {
          __h_theme: classification.theme,
          __h_theme_confidence: classification.confidence
        };

        // Add multi-theme support
        if (multiTheme && classification.allScores) {
          const qualifyingThemes = Object.entries(classification.allScores)
            .filter(([_, score]) => score >= confidenceThreshold)
            .map(([theme, _]) => theme);

          if (qualifyingThemes.length > 0) {
            metadata.__h_themes = qualifyingThemes;
          }
        }

        await this.adapter.updateMetadata(collection, record.id, metadata, true);
        stats.recordsUpdated++;

        // Call progress callback
        if (config.onProgress) {
          config.onProgress(stats.recordsProcessed, totalRecords, {
            recordsProcessed: stats.recordsProcessed,
            recordsUpdated: stats.recordsUpdated,
            recordsSkipped: stats.recordsSkipped,
            timeMs: Date.now() - startTime
          });
        }
      }
    }
  } catch (error) {
    throw new Error(
      `Theme enrichment failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }

  stats.timeMs = Date.now() - startTime;
  return stats;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/enrichment/theme-enrichment.test.ts`
Expected: PASS - 9 tests passing

**Step 5: Commit**

```bash
git add packages/core/src/enrichment/enrichment-pipeline.ts packages/core/tests/enrichment/theme-enrichment.test.ts
git commit -m "feat(enrichment): add theme enrichment to EnrichmentPipeline

- Theme classification with configurable classifier
- Custom text field support
- Confidence threshold filtering
- Multi-theme classification support
- Progress callback support
- Batch processing for efficiency
- 9 tests covering theme enrichment scenarios

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: EnrichmentPipeline - Section Enrichment & EnrichAll

**Files:**
- Create: `packages/core/tests/enrichment/section-enrichment.test.ts`
- Create: `packages/core/tests/enrichment/enrich-all.test.ts`
- Modify: `packages/core/src/enrichment/enrichment-pipeline.ts`

**Step 1: Write failing tests for section enrichment**

Create `packages/core/tests/enrichment/section-enrichment.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EnrichmentPipeline } from '../../src/enrichment/enrichment-pipeline';
import { MockAdapter } from '../../src/adapters/mock-adapter';

describe('EnrichmentPipeline - Section Enrichment', () => {
  let adapter: MockAdapter;
  let pipeline: EnrichmentPipeline;

  beforeEach(() => {
    adapter = new MockAdapter();
    pipeline = new EnrichmentPipeline(adapter);
  });

  describe('Existing Field Mapping', () => {
    it('should map existing section field to __h_section_path', async () => {
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: { section: 'Chapter 1/Section 1.1' }
        },
        {
          id: '2',
          embedding: [4, 5, 6],
          metadata: { section: 'Chapter 2/Section 2.1' }
        }
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        existingField: 'section'
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(2);

      const records = adapter.records.get('test-collection')!;
      expect(records[0].metadata.__h_section_path).toBe('Chapter 1/Section 1.1');
      expect(records[0].metadata.__h_section_level).toBe(2);
    });

    it('should skip records without section field', async () => {
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: { section: 'Chapter 1' }
        },
        {
          id: '2',
          embedding: [4, 5, 6],
          metadata: {} // No section
        }
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        existingField: 'section'
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(1);
      expect(stats.recordsSkipped).toBe(1);
    });
  });

  describe('Auto-Detection', () => {
    it('should detect sections from markdown headers', async () => {
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: {},
          text: '# Chapter 1\n## Section 1.1\nContent here'
        }
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        autoDetect: {
          textField: 'text',
          strategy: 'markdown'
        }
      });

      expect(stats.recordsProcessed).toBe(1);
      expect(stats.recordsUpdated).toBe(1);

      const records = adapter.records.get('test-collection')!;
      expect(records[0].metadata.__h_section_path).toBe('Chapter 1/Section 1.1');
      expect(records[0].metadata.__h_section_level).toBe(2);
      expect(records[0].metadata.__h_section_title).toBe('Section 1.1');
    });

    it('should detect sections from HTML headers', async () => {
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: {},
          text: '<h1>Chapter 1</h1><h2>Section 1.1</h2><p>Content</p>'
        }
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        autoDetect: {
          textField: 'text',
          strategy: 'html'
        }
      });

      expect(stats.recordsProcessed).toBe(1);
      const records = adapter.records.get('test-collection')!;
      expect(records[0].metadata.__h_section_path).toBeDefined();
    });

    it('should use custom pattern', async () => {
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: {},
          text: 'SECTION: Introduction\nContent here'
        }
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        autoDetect: {
          textField: 'text',
          strategy: 'pattern',
          customPattern: /SECTION:\s*(.+)/
        }
      });

      expect(stats.recordsProcessed).toBe(1);
      const records = adapter.records.get('test-collection')!;
      expect(records[0].metadata.__h_section_title).toBe('Introduction');
    });
  });

  describe('Fallback Behavior', () => {
    it('should use existing field if present, else auto-detect', async () => {
      adapter.records.set('test-collection', [
        {
          id: '1',
          embedding: [1, 2, 3],
          metadata: { section: 'Explicit Section' }
        },
        {
          id: '2',
          embedding: [4, 5, 6],
          metadata: {},
          text: '# Auto-Detected Section'
        }
      ]);

      const stats = await pipeline.enrichSections('test-collection', {
        existingField: 'section',
        autoDetect: {
          textField: 'text',
          strategy: 'markdown'
        }
      });

      expect(stats.recordsProcessed).toBe(2);
      expect(stats.recordsUpdated).toBe(2);

      const records = adapter.records.get('test-collection')!;
      expect(records[0].metadata.__h_section_path).toBe('Explicit Section');
      expect(records[1].metadata.__h_section_path).toBe('Auto-Detected Section');
    });
  });
});
```

**Step 2: Write failing tests for enrichAll**

Create `packages/core/tests/enrichment/enrich-all.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EnrichmentPipeline } from '../../src/enrichment/enrichment-pipeline';
import { MockAdapter } from '../../src/adapters/mock-adapter';
import { KeywordThemeClassifier } from '../../src/enrichment/classifiers/keyword-classifier';

describe('EnrichmentPipeline - EnrichAll', () => {
  let adapter: MockAdapter;
  let pipeline: EnrichmentPipeline;
  let classifier: KeywordThemeClassifier;

  beforeEach(() => {
    adapter = new MockAdapter();
    pipeline = new EnrichmentPipeline(adapter);
    classifier = new KeywordThemeClassifier(
      ['legal', 'financial'],
      {
        legal: ['contract', 'law'],
        financial: ['revenue', 'profit']
      }
    );
  });

  it('should run all enrichment steps in sequence', async () => {
    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: { source: '/docs/file.pdf', section: 'Chapter 1' },
        text: 'This is a legal contract'
      }
    ]);

    const stats = await pipeline.enrichAll('test-collection', {
      vertical: {
        mapping: { source: '__v_source' }
      },
      themes: {
        themes: ['legal', 'financial'],
        classifier
      },
      sections: {
        existingField: 'section'
      }
    });

    expect(stats.recordsProcessed).toBeGreaterThan(0);

    const records = adapter.records.get('test-collection')!;
    // Verify all enrichment types applied
    expect(records[0].metadata.__v_source).toBe('/docs/file.pdf');
    expect(records[0].metadata.__h_theme).toBe('legal');
    expect(records[0].metadata.__h_section_path).toBe('Chapter 1');
  });

  it('should apply global filter to all steps', async () => {
    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: { source: '/docs/file1.pdf', year: 2024 },
        text: 'Legal contract'
      },
      {
        id: '2',
        embedding: [4, 5, 6],
        metadata: { source: '/docs/file2.pdf', year: 2023 },
        text: 'Financial report'
      }
    ]);

    const stats = await pipeline.enrichAll('test-collection', {
      filter: { field: 'year', op: 'eq', value: 2024 },
      vertical: {
        mapping: { source: '__v_source' }
      },
      themes: {
        themes: ['legal', 'financial'],
        classifier
      }
    });

    // Only 2024 record should be processed
    const records = adapter.records.get('test-collection')!;
    expect(records[0].metadata.__v_source).toBe('/docs/file1.pdf');
    expect(records[1].metadata.__v_source).toBeUndefined();
  });

  it('should use global batch size if not overridden', async () => {
    const records = Array.from({ length: 50 }, (_, i) => ({
      id: `${i}`,
      embedding: [i, i, i],
      metadata: { source: `/docs/file${i}.pdf` },
      text: 'Legal contract'
    }));
    adapter.records.set('test-collection', records);

    const stats = await pipeline.enrichAll('test-collection', {
      batchSize: 10,
      vertical: {
        mapping: { source: '__v_source' }
      }
    });

    expect(stats.recordsProcessed).toBe(50);
  });

  it('should aggregate stats from all steps', async () => {
    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: { source: '/docs/file.pdf' },
        text: 'Legal contract'
      }
    ]);

    const stats = await pipeline.enrichAll('test-collection', {
      vertical: {
        mapping: { source: '__v_source' }
      },
      themes: {
        themes: ['legal', 'financial'],
        classifier
      }
    });

    expect(stats.recordsProcessed).toBeGreaterThan(0);
    expect(stats.recordsUpdated).toBeGreaterThan(0);
    expect(stats.timeMs).toBeGreaterThan(0);
  });

  it('should support partial enrichment configuration', async () => {
    adapter.records.set('test-collection', [
      {
        id: '1',
        embedding: [1, 2, 3],
        metadata: { source: '/docs/file.pdf' }
      }
    ]);

    // Only vertical enrichment
    const stats = await pipeline.enrichAll('test-collection', {
      vertical: {
        mapping: { source: '__v_source' }
      }
    });

    expect(stats.recordsProcessed).toBe(1);

    const records = adapter.records.get('test-collection')!;
    expect(records[0].metadata.__v_source).toBe('/docs/file.pdf');
    expect(records[0].metadata.__h_theme).toBeUndefined();
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npm test -- tests/enrichment/section-enrichment.test.ts tests/enrichment/enrich-all.test.ts`
Expected: FAIL - Methods throw "Not implemented yet"

**Step 4: Implement enrichSections and enrichAll methods**

Modify `packages/core/src/enrichment/enrichment-pipeline.ts`, replace the methods:

```typescript
/**
 * Enrich records with section hierarchy metadata.
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
    timeMs: 0
  };

  const batchSize = config.batchSize || 100;
  const filter = config.filter;

  // Iterate through records
  const iterator = this.adapter.iterateAll(collection, filter, batchSize, false);

  try {
    for await (const batch of iterator) {
      for (const record of batch) {
        stats.recordsProcessed++;

        let metadata: Record<string, any> = {};
        let shouldUpdate = false;

        // Try existing field first
        if (config.existingField && config.existingField in record.metadata) {
          const sectionPath = record.metadata[config.existingField];
          metadata = this.extractSectionMetadata(sectionPath);
          shouldUpdate = true;
        }
        // Fall back to auto-detection
        else if (config.autoDetect) {
          const text = record.text || record.metadata[config.autoDetect.textField] || '';
          if (text) {
            metadata = this.detectSections(text, config.autoDetect.strategy, config.autoDetect.customPattern);
            shouldUpdate = Object.keys(metadata).length > 0;
          }
        }

        if (shouldUpdate) {
          await this.adapter.updateMetadata(collection, record.id, metadata, true);
          stats.recordsUpdated++;
        } else {
          stats.recordsSkipped++;
        }
      }
    }
  } catch (error) {
    throw new Error(
      `Section enrichment failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }

  stats.timeMs = Date.now() - startTime;
  return stats;
}

/**
 * Run multiple enrichment steps in sequence.
 */
async enrichAll(
  collection: string,
  config: EnrichAllConfig
): Promise<EnrichmentStats> {
  const startTime = Date.now();
  const aggregatedStats: EnrichmentStats = {
    recordsProcessed: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    timeMs: 0
  };

  try {
    // Step 1: Vertical enrichment
    if (config.vertical) {
      const verticalConfig = {
        ...config.vertical,
        filter: config.filter || config.vertical.filter,
        batchSize: config.batchSize || config.vertical.batchSize
      };
      const stats = await this.enrichVertical(collection, verticalConfig);
      this.mergeStats(aggregatedStats, stats);
    }

    // Step 2: Theme enrichment
    if (config.themes) {
      const themeConfig = {
        ...config.themes,
        filter: config.filter || config.themes.filter,
        batchSize: config.batchSize || config.themes.batchSize,
        onProgress: config.onProgress || config.themes.onProgress
      };
      const stats = await this.enrichThemes(collection, themeConfig);
      this.mergeStats(aggregatedStats, stats);
    }

    // Step 3: Section enrichment
    if (config.sections) {
      const sectionConfig = {
        ...config.sections,
        filter: config.filter || config.sections.filter,
        batchSize: config.batchSize || config.sections.batchSize
      };
      const stats = await this.enrichSections(collection, sectionConfig);
      this.mergeStats(aggregatedStats, stats);
    }

    aggregatedStats.timeMs = Date.now() - startTime;
    return aggregatedStats;
  } catch (error) {
    throw new Error(
      `EnrichAll failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

private extractSectionMetadata(sectionPath: string): Record<string, any> {
  const parts = sectionPath.split('/');
  const level = parts.length;
  const title = parts[parts.length - 1];

  return {
    __h_section_path: sectionPath,
    __h_section_level: level,
    __h_section_title: title
  };
}

private detectSections(
  text: string,
  strategy: 'markdown' | 'html' | 'pattern',
  customPattern?: RegExp
): Record<string, any> {
  if (strategy === 'markdown') {
    return this.detectMarkdownSections(text);
  } else if (strategy === 'html') {
    return this.detectHtmlSections(text);
  } else if (strategy === 'pattern' && customPattern) {
    return this.detectPatternSections(text, customPattern);
  }
  return {};
}

private detectMarkdownSections(text: string): Record<string, any> {
  // Find all markdown headers (# Header)
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const matches = Array.from(text.matchAll(headerRegex));

  if (matches.length === 0) {
    return {};
  }

  // Build section path from headers
  const path: string[] = [];
  for (const match of matches) {
    const level = match[1].length;
    const title = match[2].trim();

    // Truncate path to current level
    path.length = level - 1;
    path.push(title);
  }

  if (path.length === 0) {
    return {};
  }

  return {
    __h_section_path: path.join('/'),
    __h_section_level: path.length,
    __h_section_title: path[path.length - 1]
  };
}

private detectHtmlSections(text: string): Record<string, any> {
  // Find all HTML headers (h1-h6)
  const headerRegex = /<h([1-6])>(.+?)<\/h\1>/gi;
  const matches = Array.from(text.matchAll(headerRegex));

  if (matches.length === 0) {
    return {};
  }

  const path: string[] = [];
  for (const match of matches) {
    const level = parseInt(match[1]);
    const title = match[2].trim();

    path.length = level - 1;
    path.push(title);
  }

  if (path.length === 0) {
    return {};
  }

  return {
    __h_section_path: path.join('/'),
    __h_section_level: path.length,
    __h_section_title: path[path.length - 1]
  };
}

private detectPatternSections(text: string, pattern: RegExp): Record<string, any> {
  const match = text.match(pattern);
  if (!match || !match[1]) {
    return {};
  }

  const title = match[1].trim();
  return {
    __h_section_path: title,
    __h_section_level: 1,
    __h_section_title: title
  };
}

private mergeStats(target: EnrichmentStats, source: EnrichmentStats): void {
  target.recordsProcessed = Math.max(target.recordsProcessed, source.recordsProcessed);
  target.recordsUpdated += source.recordsUpdated;
  target.recordsSkipped += source.recordsSkipped;
}
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- tests/enrichment/section-enrichment.test.ts tests/enrichment/enrich-all.test.ts`
Expected: PASS - 11 tests passing

**Step 6: Run all enrichment tests**

Run: `npm test -- tests/enrichment/`
Expected: PASS - All enrichment tests passing

**Step 7: Commit**

```bash
git add packages/core/src/enrichment/enrichment-pipeline.ts packages/core/tests/enrichment/section-enrichment.test.ts packages/core/tests/enrichment/enrich-all.test.ts
git commit -m "feat(enrichment): add section enrichment and enrichAll method

Section Enrichment:
- Map existing section fields to __h_section_* metadata
- Auto-detect from markdown headers
- Auto-detect from HTML headers
- Custom pattern support
- Fallback behavior (existing field → auto-detect)

EnrichAll:
- Unified method running all enrichment steps
- Global filter and batch size
- Stats aggregation from all steps
- Partial configuration support

Tests: 11 new tests for sections and enrichAll

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Integration Tests

**Files:**
- Create: `packages/core/tests/enrichment/enrichment-integration.test.ts`

**Step 1: Write integration tests**

Create `packages/core/tests/enrichment/enrichment-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EnrichmentPipeline } from '../../src/enrichment/enrichment-pipeline';
import { MockAdapter } from '../../src/adapters/mock-adapter';
import { MockEmbedder } from '../../src/embedders/mock-embedder';
import { MockLLM } from '../../src/llm/mock-llm';
import { KeywordThemeClassifier } from '../../src/enrichment/classifiers/keyword-classifier';
import { EmbeddingThemeClassifier } from '../../src/enrichment/classifiers/embedding-classifier';
import { LLMThemeClassifier } from '../../src/enrichment/classifiers/llm-classifier';

describe('Enrichment Integration Tests', () => {
  let adapter: MockAdapter;
  let embedder: MockEmbedder;
  let llm: MockLLM;
  let pipeline: EnrichmentPipeline;

  beforeEach(() => {
    adapter = new MockAdapter();
    embedder = new MockEmbedder(384);
    llm = new MockLLM();
    pipeline = new EnrichmentPipeline(adapter, embedder, llm);
  });

  it('should perform end-to-end enrichment workflow', async () => {
    // Set up test collection
    await adapter.createCollection('test', 384);
    await adapter.upsert('test', [
      {
        id: '1',
        embedding: new Array(384).fill(0.5),
        metadata: {
          source: '/docs/2024/legal/contract.pdf',
          section: 'Chapter 1/Terms'
        },
        text: 'This legal contract contains important clauses and terms.'
      },
      {
        id: '2',
        embedding: new Array(384).fill(0.5),
        metadata: {
          source: '/docs/2024/finance/report.pdf',
          section: 'Chapter 2/Revenue'
        },
        text: 'The financial report shows revenue growth and profit margins.'
      }
    ]);

    // Configure enrichment
    const classifier = new KeywordThemeClassifier(
      ['legal', 'financial', 'technical'],
      {
        legal: ['contract', 'clause', 'terms'],
        financial: ['revenue', 'profit', 'finance'],
        technical: ['code', 'software', 'system']
      }
    );

    // Run complete enrichment
    const stats = await pipeline.enrichAll('test', {
      vertical: {
        extractor: (record) => {
          const source = record.metadata.source || '';
          const parts = source.split('/');
          return {
            __v_partition: parts[2],
            __v_doc_type: parts[3],
            __v_doc_id: parts[4]?.split('.')[0]
          };
        }
      },
      themes: {
        themes: ['legal', 'financial', 'technical'],
        classifier,
        confidenceThreshold: 0.3
      },
      sections: {
        existingField: 'section'
      }
    });

    // Verify stats
    expect(stats.recordsProcessed).toBe(2);
    expect(stats.recordsUpdated).toBeGreaterThan(0);

    // Verify enriched records
    const records = await adapter.fetchByIds('test', ['1', '2']);

    // Record 1 - Legal document
    expect(records[0].metadata.__v_partition).toBe('2024');
    expect(records[0].metadata.__v_doc_type).toBe('legal');
    expect(records[0].metadata.__v_doc_id).toBe('contract');
    expect(records[0].metadata.__h_theme).toBe('legal');
    expect(records[0].metadata.__h_theme_confidence).toBeGreaterThan(0);
    expect(records[0].metadata.__h_section_path).toBe('Chapter 1/Terms');
    expect(records[0].metadata.__h_section_level).toBe(2);

    // Record 2 - Financial document
    expect(records[1].metadata.__v_doc_type).toBe('finance');
    expect(records[1].metadata.__h_theme).toBe('financial');
    expect(records[1].metadata.__h_section_path).toBe('Chapter 2/Revenue');
  });

  it('should work with embedding-based classifier', async () => {
    await adapter.createCollection('test', 384);

    // Set up embeddings for themes
    embedder.setEmbedding('legal', new Array(384).fill(0).map((_, i) => i % 3 === 0 ? 1 : 0));
    embedder.setEmbedding('financial', new Array(384).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0));
    embedder.setEmbedding('technical', new Array(384).fill(0).map((_, i) => i % 3 === 2 ? 1 : 0));

    // Add test record
    await adapter.upsert('test', [
      {
        id: '1',
        embedding: new Array(384).fill(0.5),
        metadata: {},
        text: 'Legal contract document'
      }
    ]);

    // Mock embedding for test text to match legal theme
    embedder.setEmbedding(
      'Legal contract document',
      new Array(384).fill(0).map((_, i) => i % 3 === 0 ? 0.9 : 0.1)
    );

    const classifier = new EmbeddingThemeClassifier(
      ['legal', 'financial', 'technical'],
      embedder
    );

    const stats = await pipeline.enrichThemes('test', {
      themes: ['legal', 'financial', 'technical'],
      classifier
    });

    expect(stats.recordsUpdated).toBe(1);

    const records = await adapter.fetchByIds('test', ['1']);
    expect(records[0].metadata.__h_theme).toBe('legal');
  });

  it('should work with LLM-based classifier', async () => {
    await adapter.createCollection('test', 384);

    // Mock LLM responses
    llm.setResponse(
      expect.any(String),
      JSON.stringify({
        theme: 'legal',
        confidence: 0.95,
        allScores: { legal: 0.95, financial: 0.03, technical: 0.02 }
      })
    );

    await adapter.upsert('test', [
      {
        id: '1',
        embedding: new Array(384).fill(0.5),
        metadata: {},
        text: 'Complex legal agreement with multiple parties'
      }
    ]);

    const classifier = new LLMThemeClassifier(
      ['legal', 'financial', 'technical'],
      llm
    );

    const stats = await pipeline.enrichThemes('test', {
      themes: ['legal', 'financial', 'technical'],
      classifier
    });

    expect(stats.recordsUpdated).toBe(1);

    const records = await adapter.fetchByIds('test', ['1']);
    expect(records[0].metadata.__h_theme).toBe('legal');
    expect(records[0].metadata.__h_theme_confidence).toBe(0.95);
  });

  it('should handle filtered enrichment correctly', async () => {
    await adapter.createCollection('test', 384);

    await adapter.upsert('test', [
      {
        id: '1',
        embedding: new Array(384).fill(0.5),
        metadata: { year: 2024, source: 'doc1.pdf' }
      },
      {
        id: '2',
        embedding: new Array(384).fill(0.5),
        metadata: { year: 2023, source: 'doc2.pdf' }
      },
      {
        id: '3',
        embedding: new Array(384).fill(0.5),
        metadata: { year: 2024, source: 'doc3.pdf' }
      }
    ]);

    // Enrich only 2024 documents
    const stats = await pipeline.enrichVertical('test', {
      mapping: { source: '__v_source' },
      filter: { field: 'year', op: 'eq', value: 2024 }
    });

    expect(stats.recordsProcessed).toBe(2);
    expect(stats.recordsUpdated).toBe(2);

    const records = await adapter.fetchByIds('test', ['1', '2', '3']);
    expect(records[0].metadata.__v_source).toBe('doc1.pdf');
    expect(records[1].metadata.__v_source).toBeUndefined(); // 2023, not enriched
    expect(records[2].metadata.__v_source).toBe('doc3.pdf');
  });

  it('should handle large collections efficiently', async () => {
    await adapter.createCollection('test', 384);

    // Create 500 records
    const records = Array.from({ length: 500 }, (_, i) => ({
      id: `${i}`,
      embedding: new Array(384).fill(0.5),
      metadata: { source: `doc${i}.pdf` },
      text: i % 2 === 0 ? 'legal contract' : 'financial report'
    }));

    await adapter.upsert('test', records);

    const classifier = new KeywordThemeClassifier(
      ['legal', 'financial'],
      {
        legal: ['legal', 'contract'],
        financial: ['financial', 'report']
      }
    );

    const startTime = Date.now();
    const stats = await pipeline.enrichAll('test', {
      vertical: {
        mapping: { source: '__v_source' }
      },
      themes: {
        themes: ['legal', 'financial'],
        classifier
      },
      batchSize: 50
    });
    const duration = Date.now() - startTime;

    expect(stats.recordsProcessed).toBe(500);
    expect(stats.recordsUpdated).toBe(500);
    expect(duration).toBeLessThan(10000); // Should complete in < 10 seconds
  });
});
```

**Step 2: Run integration tests**

Run: `npm test -- tests/enrichment/enrichment-integration.test.ts`
Expected: PASS - 5 integration tests passing

**Step 3: Run all core tests**

Run: `npm test`
Expected: PASS - All tests passing (75 + enrichment tests)

**Step 4: Commit**

```bash
git add packages/core/tests/enrichment/enrichment-integration.test.ts
git commit -m "test(enrichment): add integration tests for enrichment pipeline

- End-to-end enrichment workflow test
- Embedding-based classifier integration
- LLM-based classifier integration
- Filtered enrichment test
- Large collection performance test

5 integration tests covering real-world enrichment scenarios

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

**Implementation complete! Phase 4: Enrichment Pipeline**

**Components built:**
1. LLMClient abstraction (Task 1)
2. ThemeClassifier interface (Task 2)
3. KeywordThemeClassifier (Task 3)
4. ZeroShotThemeClassifier (Task 4)
5. EmbeddingThemeClassifier (Task 5)
6. LLMThemeClassifier (Task 6)
7. Enrichment types (Task 7)
8. EnrichmentPipeline - vertical enrichment (Task 8)
9. EnrichmentPipeline - theme enrichment (Task 9)
10. EnrichmentPipeline - section enrichment & enrichAll (Task 10)
11. Integration tests (Task 11)

**Test coverage:**
- LLM: 5 tests
- Theme classifiers: 11 + 5 + 7 + 7 = 30 tests
- Vertical enrichment: 10 tests
- Theme enrichment: 9 tests
- Section enrichment: 6 tests
- EnrichAll: 5 tests
- Integration: 5 tests
- **Total: ~70 new tests**

**Run final verification:**
```bash
npm test
npm run build
```
