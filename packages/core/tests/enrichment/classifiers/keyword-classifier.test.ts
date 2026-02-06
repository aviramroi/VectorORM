import { describe, it, expect } from 'vitest';
import { KeywordThemeClassifier } from '../../../src/enrichment/classifiers/keyword-classifier';

describe('KeywordThemeClassifier', () => {
  it('should classify text with clear theme', () => {
    const classifier = new KeywordThemeClassifier(
      ['technology', 'sports'],
      {
        technology: ['computer', 'software', 'programming'],
        sports: ['football', 'basketball', 'soccer'],
      }
    );

    const result = classifier.classify(
      'I love programming and building software on my computer'
    );

    expect(result.theme).toBe('technology');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should classify financial keywords correctly', () => {
    const classifier = new KeywordThemeClassifier(
      ['finance', 'technology'],
      {
        finance: ['investment', 'stock', 'trading', 'portfolio'],
        technology: ['software', 'code'],
      }
    );

    const result = classifier.classify(
      'My investment portfolio includes several tech stocks for trading'
    );

    expect(result.theme).toBe('finance');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle no matches', () => {
    const classifier = new KeywordThemeClassifier(
      ['technology', 'sports'],
      {
        technology: ['computer', 'software'],
        sports: ['football', 'basketball'],
      }
    );

    const result = classifier.classify('I like gardening and cooking');

    expect(result.theme).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('should be case insensitive by default', () => {
    const classifier = new KeywordThemeClassifier(
      ['technology'],
      {
        technology: ['computer', 'software', 'programming'],
      }
    );

    const result = classifier.classify('I love PROGRAMMING and COMPUTER software');

    expect(result.theme).toBe('technology');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should support case sensitive matching when configured', () => {
    const classifier = new KeywordThemeClassifier(
      ['technology'],
      {
        technology: ['computer', 'software'],
      },
      true // case sensitive
    );

    const resultLower = classifier.classify('I love computer and software');
    expect(resultLower.theme).toBe('technology');

    const resultUpper = classifier.classify('I love COMPUTER and SOFTWARE');
    expect(resultUpper.theme).toBe('unknown');
  });

  it('should return highest scoring theme', () => {
    const classifier = new KeywordThemeClassifier(
      ['technology', 'sports'],
      {
        technology: ['computer', 'software', 'programming'],
        sports: ['football', 'basketball', 'soccer', 'tennis', 'hockey'],
      }
    );

    const result = classifier.classify(
      'football basketball soccer tennis hockey are great sports'
    );

    expect(result.theme).toBe('sports');
    expect(result.allScores).toBeDefined();
    expect(result.allScores!.sports).toBeGreaterThan(result.allScores!.technology);
  });

  it('should include all scores in result', () => {
    const classifier = new KeywordThemeClassifier(
      ['technology', 'sports'],
      {
        technology: ['computer', 'software'],
        sports: ['football', 'basketball'],
      }
    );

    const result = classifier.classify('I love computer and football');

    expect(result.allScores).toBeDefined();
    expect(result.allScores!.technology).toBe(1);
    expect(result.allScores!.sports).toBe(1);
    expect(result.theme).toBe('technology'); // First in themes array wins ties
  });

  it('should normalize confidence based on total keywords', () => {
    const classifier = new KeywordThemeClassifier(
      ['technology'],
      {
        technology: ['computer', 'software', 'programming', 'code'],
      }
    );

    const result = classifier.classify('computer software');

    // 2 matches out of 4 total keywords = 0.5 confidence
    expect(result.confidence).toBeCloseTo(0.5, 2);
  });

  it('should classify batch of texts', () => {
    const classifier = new KeywordThemeClassifier(
      ['technology', 'sports'],
      {
        technology: ['computer', 'software'],
        sports: ['football', 'basketball'],
      }
    );

    const results = classifier.classifyBatch([
      'I love computer programming',
      'Football is my favorite sport',
      'Cooking is fun',
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].theme).toBe('technology');
    expect(results[1].theme).toBe('sports');
    expect(results[2].theme).toBe('unknown');
  });

  it('should handle empty text', () => {
    const classifier = new KeywordThemeClassifier(
      ['technology'],
      {
        technology: ['computer', 'software'],
      }
    );

    const result = classifier.classify('');

    expect(result.theme).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('should use word boundary matching', () => {
    const classifier = new KeywordThemeClassifier(
      ['technology'],
      {
        technology: ['soft', 'ware'],
      }
    );

    // Should match "soft" and "ware" as complete words only
    const result1 = classifier.classify('soft ware');
    expect(result1.theme).toBe('technology');

    // Should NOT match "soft" inside "software" or "ware" inside "warehouse"
    const result2 = classifier.classify('software warehouse');
    expect(result2.theme).toBe('unknown');
  });
});
