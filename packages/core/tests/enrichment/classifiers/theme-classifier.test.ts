/**
 * Tests for ThemeClassifier interface.
 *
 * Following TDD:
 * 1. Write tests first (they will fail)
 * 2. Implement minimal code to pass
 * 3. Verify all tests pass
 */

import { describe, it, expect } from 'vitest';
import type { ThemeClassifier, ThemeClassification } from '../../../src/enrichment/classifiers/theme-classifier';

/**
 * Mock implementation of ThemeClassifier for testing.
 */
class MockThemeClassifier implements ThemeClassifier {
  async classify(text: string): Promise<ThemeClassification> {
    // Simple mock: return 'general' theme with high confidence
    return {
      theme: 'general',
      confidence: 0.95,
      allScores: {
        general: 0.95,
        technology: 0.03,
        business: 0.02,
      },
    };
  }

  async classifyBatch(texts: string[]): Promise<ThemeClassification[]> {
    // Simple mock: classify each text
    return Promise.all(texts.map((text) => this.classify(text)));
  }
}

describe('ThemeClassifier', () => {
  describe('Interface Compliance', () => {
    it('should classify single text and return ThemeClassification', async () => {
      const classifier = new MockThemeClassifier();
      const text = 'This is a sample text about artificial intelligence.';

      const result = await classifier.classify(text);

      expect(result).toBeDefined();
      expect(result.theme).toBe('general');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(typeof result.theme).toBe('string');
      expect(typeof result.confidence).toBe('number');
    });

    it('should classify batch of texts and return array of ThemeClassifications', async () => {
      const classifier = new MockThemeClassifier();
      const texts = [
        'First text about technology',
        'Second text about business',
        'Third text about science',
      ];

      const results = await classifier.classifyBatch(texts);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(typeof result.theme).toBe('string');
        expect(typeof result.confidence).toBe('number');
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should include optional allScores in ThemeClassification', async () => {
      const classifier = new MockThemeClassifier();
      const text = 'Sample text for classification';

      const result = await classifier.classify(text);

      expect(result.allScores).toBeDefined();
      expect(typeof result.allScores).toBe('object');
      expect(result.allScores).toHaveProperty('general');
      expect(result.allScores).toHaveProperty('technology');
      expect(result.allScores).toHaveProperty('business');
    });
  });
});
