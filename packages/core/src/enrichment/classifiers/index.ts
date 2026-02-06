/**
 * Theme classification interfaces and implementations.
 *
 * This module provides interfaces and concrete implementations for classifying
 * text content into thematic categories. Different strategies can be used
 * depending on requirements: keyword-based, zero-shot, embedding-based, or LLM-based.
 */

export type { ThemeClassification, ThemeClassifier } from './theme-classifier';
export * from './keyword-classifier';
