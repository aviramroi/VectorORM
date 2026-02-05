/**
 * Tests for LLMClient abstraction layer.
 *
 * Following TDD:
 * 1. Write tests first (they will fail)
 * 2. Implement minimal code to pass
 * 3. Verify all tests pass
 */

import { describe, it, expect } from 'vitest';
import { LLMClient } from '../../src/llm/llm-client';
import { MockLLM } from '../../src/llm/mock-llm';

describe('LLMClient', () => {
  describe('Abstract Class', () => {
    it('should not allow direct instantiation of abstract class', () => {
      // TypeScript prevents this at compile time, but we can verify the concept
      // by ensuring our mock implementation is required
      expect(() => {
        // @ts-expect-error - Testing that abstract class cannot be instantiated
        new LLMClient();
      }).toThrow('Cannot instantiate abstract class LLMClient directly');
    });

    it('should allow subclass instantiation', () => {
      const llm = new MockLLM();
      expect(llm).toBeInstanceOf(LLMClient);
      expect(llm).toBeInstanceOf(MockLLM);
    });
  });

  describe('MockLLM', () => {
    it('should generate text with canned response', async () => {
      const llm = new MockLLM();
      llm.setResponse('Hello, world!');

      const result = await llm.generate('Say hello');

      expect(result).toBe('Hello, world!');
    });

    it('should generate JSON with canned response', async () => {
      interface TestResponse {
        name: string;
        age: number;
      }

      const llm = new MockLLM();
      const mockData = { name: 'Alice', age: 30 };
      llm.setResponse(JSON.stringify(mockData));

      const result = await llm.generateJSON<TestResponse>('Generate user data');

      expect(result).toEqual(mockData);
    });

    it('should generate batch responses', async () => {
      const llm = new MockLLM();
      llm.setResponse('Response');

      const prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3'];
      const results = await llm.generateBatch(prompts);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(3);
      expect(results.every((r) => r === 'Response')).toBe(true);
    });

    it('should throw error for invalid JSON in generateJSON', async () => {
      const llm = new MockLLM();
      llm.setResponse('not valid json');

      await expect(llm.generateJSON('Generate data')).rejects.toThrow(
        'Failed to parse mock response as JSON'
      );
    });

    it('should handle empty batch array', async () => {
      const llm = new MockLLM();
      llm.setResponse('Response');

      const results = await llm.generateBatch([]);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(0);
    });
  });

  describe('LLMClient Properties', () => {
    it('should expose modelName and provider properties', () => {
      const llm = new MockLLM();

      expect(llm.modelName).toBe('mock-llm-v1');
      expect(llm.provider).toBe('mock');
    });
  });
});
