import { describe, it, expect } from 'vitest';
import { ZeroShotThemeClassifier } from '../../../src/enrichment/classifiers/zero-shot-classifier';

describe('ZeroShotThemeClassifier', () => {
  // Increase timeout for model loading
  const TEST_TIMEOUT = 30000;

  it('should classify text into provided themes', async () => {
    const classifier = new ZeroShotThemeClassifier(['technology', 'sports', 'business']);

    const result = await classifier.classify(
      'Artificial intelligence and machine learning are transforming software development'
    );

    expect(result.theme).toBe('technology');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.allScores).toBeDefined();
    expect(Object.keys(result.allScores!).sort()).toEqual(['business', 'sports', 'technology']);
  }, TEST_TIMEOUT);

  it('should handle empty text with uniform scores', async () => {
    const classifier = new ZeroShotThemeClassifier(['technology', 'sports']);

    const result = await classifier.classify('');

    expect(result.theme).toBe('technology'); // First theme
    expect(result.confidence).toBeCloseTo(0.5, 1); // Uniform distribution for 2 themes
    expect(result.allScores).toBeDefined();
    expect(result.allScores!.technology).toBeCloseTo(0.5, 1);
    expect(result.allScores!.sports).toBeCloseTo(0.5, 1);
  }, TEST_TIMEOUT);

  it('should classify batch of texts', async () => {
    const classifier = new ZeroShotThemeClassifier(['technology', 'sports', 'finance']);

    const results = await classifier.classifyBatch([
      'Machine learning revolutionizes data science',
      'The football team won the championship',
      'Stock market hits record high',
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].theme).toBe('technology');
    expect(results[1].theme).toBe('sports');
    expect(results[2].theme).toBe('finance');
    expect(results[0].confidence).toBeGreaterThan(0);
    expect(results[1].confidence).toBeGreaterThan(0);
    expect(results[2].confidence).toBeGreaterThan(0);
  }, TEST_TIMEOUT);

  it('should lazy load model on first classify call', async () => {
    const classifier = new ZeroShotThemeClassifier(['technology', 'sports']);

    // First call loads model
    const result1 = await classifier.classify('Computers and programming');
    expect(result1.theme).toBe('technology');

    // Second call reuses loaded model (should be faster)
    const result2 = await classifier.classify('Basketball and football');
    expect(result2.theme).toBe('sports');
  }, TEST_TIMEOUT);

  it('should use custom model when specified', async () => {
    const classifier = new ZeroShotThemeClassifier(
      ['positive', 'negative'],
      'Xenova/distilbert-base-uncased-mnli'
    );

    const result = await classifier.classify('This is absolutely wonderful and amazing!');

    expect(result.theme).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.allScores).toBeDefined();
  }, TEST_TIMEOUT);
});
