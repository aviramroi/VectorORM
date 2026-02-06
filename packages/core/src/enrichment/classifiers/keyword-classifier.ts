/**
 * Fast, deterministic keyword-based theme classifier
 * Uses precompiled regex patterns with word boundaries for efficient matching
 */

export interface ThemeClassificationResult {
  theme: string;
  confidence: number;
  allScores?: Record<string, number>;
}

export class KeywordThemeClassifier {
  private patterns: Map<string, RegExp[]>;
  private keywordCounts: Map<string, number>;

  /**
   * Creates a new KeywordThemeClassifier
   * @param themes - Array of theme names
   * @param keywords - Map of theme names to their keyword arrays
   * @param caseSensitive - Whether matching should be case sensitive (default: false)
   */
  constructor(
    private themes: string[],
    keywords: Record<string, string[]>,
    private caseSensitive: boolean = false
  ) {
    this.patterns = new Map();
    this.keywordCounts = new Map();

    // Precompile regex patterns for each theme
    for (const theme of themes) {
      const themeKeywords = keywords[theme] || [];
      this.keywordCounts.set(theme, themeKeywords.length);

      const patterns = themeKeywords.map((keyword) => {
        const escapedKeyword = this.escapeRegex(keyword);
        const flags = caseSensitive ? 'g' : 'gi';
        return new RegExp(`\\b${escapedKeyword}\\b`, flags);
      });

      this.patterns.set(theme, patterns);
    }
  }

  /**
   * Classify a single text
   * @param text - Text to classify
   * @returns Classification result with theme, confidence, and all scores
   */
  classify(text: string): ThemeClassificationResult {
    if (!text || text.trim().length === 0) {
      return {
        theme: 'unknown',
        confidence: 0,
        allScores: {},
      };
    }

    const scores: Record<string, number> = {};
    let maxScore = 0;
    let winningTheme = 'unknown';

    // Count keyword matches for each theme
    for (const theme of this.themes) {
      const patterns = this.patterns.get(theme) || [];
      let matchCount = 0;

      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          matchCount += matches.length;
        }
      }

      scores[theme] = matchCount;

      // Track highest scoring theme (first theme wins ties)
      if (matchCount > maxScore) {
        maxScore = matchCount;
        winningTheme = theme;
      }
    }

    // No matches found
    if (maxScore === 0) {
      return {
        theme: 'unknown',
        confidence: 0,
        allScores: scores,
      };
    }

    // Normalize confidence: matches / total keywords for winning theme
    const totalKeywords = this.keywordCounts.get(winningTheme) || 1;
    const confidence = maxScore / totalKeywords;

    return {
      theme: winningTheme,
      confidence: Math.min(confidence, 1.0), // Cap at 1.0
      allScores: scores,
    };
  }

  /**
   * Classify multiple texts in batch
   * @param texts - Array of texts to classify
   * @returns Array of classification results
   */
  classifyBatch(texts: string[]): ThemeClassificationResult[] {
    return texts.map((text) => this.classify(text));
  }

  /**
   * Escape special regex characters in a string
   * @param str - String to escape
   * @returns Escaped string safe for use in regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
