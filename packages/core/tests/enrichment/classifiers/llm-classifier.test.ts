import { describe, it, expect } from 'vitest';
import { LLMThemeClassifier } from '../../../src/enrichment/classifiers/llm-classifier';
import { MockLLM } from '../../../src/llm/mock-llm';

describe('LLMThemeClassifier', () => {
  it('should classify text using LLM', async () => {
    const llm = new MockLLM();
    const classifier = new LLMThemeClassifier(
      ['technology', 'sports', 'finance'],
      llm
    );

    // Set mock response with valid JSON
    llm.setResponse(JSON.stringify({
      theme: 'technology',
      confidence: 0.95,
      allScores: {
        technology: 0.95,
        sports: 0.03,
        finance: 0.02,
      },
    }));

    const result = await classifier.classify('Machine learning is transforming AI');

    expect(result.theme).toBe('technology');
    expect(result.confidence).toBe(0.95);
    expect(result.allScores).toBeDefined();
    expect(result.allScores?.technology).toBe(0.95);
  });

  it('should parse JSON response from LLM', async () => {
    const llm = new MockLLM();
    const classifier = new LLMThemeClassifier(['technology', 'sports'], llm);

    // Set mock response
    llm.setResponse(JSON.stringify({
      theme: 'sports',
      confidence: 0.88,
      allScores: {
        technology: 0.12,
        sports: 0.88,
      },
    }));

    const result = await classifier.classify('Football championship game');

    expect(result.theme).toBe('sports');
    expect(result.confidence).toBe(0.88);
    expect(result.allScores).toEqual({
      technology: 0.12,
      sports: 0.88,
    });
  });

  it('should support custom prompt templates', async () => {
    const llm = new MockLLM();
    const customTemplate = `Custom classification for: {text}
Available themes: {themes}
Return JSON with theme, confidence, allScores.`;

    const classifier = new LLMThemeClassifier(
      ['technology', 'sports'],
      llm,
      customTemplate
    );

    llm.setResponse(JSON.stringify({
      theme: 'technology',
      confidence: 0.92,
      allScores: {
        technology: 0.92,
        sports: 0.08,
      },
    }));

    const result = await classifier.classify('AI and machine learning');

    expect(result.theme).toBe('technology');
    expect(result.confidence).toBe(0.92);
  });

  it('should classify batch of texts sequentially', async () => {
    const llm = new MockLLM();
    const classifier = new LLMThemeClassifier(
      ['technology', 'sports', 'finance'],
      llm
    );

    // Set responses that will be returned for all calls
    const responses = [
      { theme: 'technology', confidence: 0.95, allScores: { technology: 0.95, sports: 0.03, finance: 0.02 } },
      { theme: 'sports', confidence: 0.89, allScores: { technology: 0.05, sports: 0.89, finance: 0.06 } },
      { theme: 'finance', confidence: 0.91, allScores: { technology: 0.04, sports: 0.05, finance: 0.91 } },
    ];

    let callIndex = 0;
    // Override generateJSON to return different responses per call
    llm.generateJSON = async () => {
      const response = responses[callIndex % responses.length];
      callIndex++;
      return response;
    };

    const results = await classifier.classifyBatch([
      'Machine learning is transforming AI',
      'The football team won the championship',
      'Stock market hits record high',
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].theme).toBe('technology');
    expect(results[1].theme).toBe('sports');
    expect(results[2].theme).toBe('finance');
  });

  it('should handle empty text with uniform scores', async () => {
    const llm = new MockLLM();
    const classifier = new LLMThemeClassifier(
      ['technology', 'sports', 'finance'],
      llm
    );

    const result = await classifier.classify('');

    expect(result.theme).toBe('technology'); // First theme
    expect(result.confidence).toBeCloseTo(1 / 3, 5); // Uniform score
    expect(result.allScores).toBeDefined();

    if (result.allScores) {
      expect(result.allScores['technology']).toBeCloseTo(1 / 3, 5);
      expect(result.allScores['sports']).toBeCloseTo(1 / 3, 5);
      expect(result.allScores['finance']).toBeCloseTo(1 / 3, 5);
    }
  });

  it('should handle malformed JSON from LLM with error', async () => {
    const llm = new MockLLM();
    const classifier = new LLMThemeClassifier(['technology', 'sports'], llm);

    // Set invalid JSON response
    llm.setResponse('This is not valid JSON');

    await expect(classifier.classify('Some text')).rejects.toThrow(
      'Failed to classify text with LLM'
    );
  });

  it('should include all prompt template elements in classification', async () => {
    const llm = new MockLLM();
    const themes = ['technology', 'sports', 'finance'];
    const classifier = new LLMThemeClassifier(themes, llm);

    llm.setResponse(JSON.stringify({
      theme: 'technology',
      confidence: 0.95,
      allScores: {
        technology: 0.95,
        sports: 0.03,
        finance: 0.02,
      },
    }));

    const text = 'Machine learning and artificial intelligence';
    const result = await classifier.classify(text);

    // Verify that the classification respects the themes provided
    expect(result.theme).toBe('technology');
    expect(result.allScores).toBeDefined();

    // Verify all themes are present in allScores
    if (result.allScores) {
      expect(Object.keys(result.allScores).sort()).toEqual(themes.sort());
    }
  });
});
