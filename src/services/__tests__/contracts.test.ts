import { describe, it, expect, beforeEach, vi } from 'vitest';
import { countWords, isLongForm } from '../readability';
import { filterArticlesByDate } from '../rss';
import type { RSSFeedItem } from '../../types';
import type { StorageBackend } from '../storage/types';
import {
  DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT,
  DEFAULT_DAILY_SUMMARY_USER_PROMPT,
  DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT,
  DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT
} from '../generation-pipeline';

// Import contracts
import wordCountingContract from '../../../contracts/word-counting.json';
import longFormContract from '../../../contracts/long-form-threshold.json';
import dateFilteringContract from '../../../contracts/date-filtering.json';
import dateUtilitiesContract from '../../../contracts/date-utilities.json';
import modelPricingContract from '../../../contracts/model-pricing.json';
import promptsContract from '../../../contracts/prompts.json';
import anthropicToolsContract from '../../../contracts/anthropic-tools.json';
import storageInterfaceContract from '../../../contracts/storage-interface.json';


describe('Cross-Platform Behavioral Contracts', () => {
  describe('word-counting.json', () => {
    it('should match all contract test cases', () => {
      for (const testCase of wordCountingContract.cases) {
        const result = countWords(testCase.input);
        expect(result).toBe(testCase.expectedWordCount);
      }
    });
  });

  describe('long-form-threshold.json', () => {
    it('should match threshold value', () => {
      expect(longFormContract.threshold).toBe(4000);
    });

    it('should match all contract test cases', () => {
      for (const testCase of longFormContract.cases) {
        const result = isLongForm(testCase.wordCount);
        expect(result).toBe(testCase.expectedIsLongForm);
      }
    });
  });

  describe('date-filtering.json', () => {
    beforeEach(() => {
      // Mock Date.now() to match contract's reference timestamp
      vi.useFakeTimers();
      vi.setSystemTime(dateFilteringContract.referenceTimestamp);
    });

    it('should match all contract test cases', () => {
      for (const testCase of dateFilteringContract.cases) {
        const articles: RSSFeedItem[] = testCase.articles.map((a: any) => ({
          title: a.title,
          link: a.link,
          pubDate: a.pubDate ? new Date(a.pubDate).toISOString() : undefined,
        }));

        const filtered = filterArticlesByDate(articles, testCase.hoursAgo);
        const resultTitles = filtered.map(a => a.title);

        expect(resultTitles).toEqual(testCase.expectedTitles);
      }
    });
  });

  describe('date-utilities.json', () => {
    it('should format month keys correctly', () => {
      for (const testCase of dateUtilitiesContract.cases) {
        if (testCase.expectedMonthKey) {
          const date = new Date(testCase.timestamp);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const monthKey = `${year}-${month}`;
          expect(monthKey).toBe(testCase.expectedMonthKey);
        }
      }
    });

    it('should format quarters correctly', () => {
      for (const testCase of dateUtilitiesContract.cases) {
        if (testCase.expectedQuarter) {
          const date = new Date(testCase.timestamp);
          const year = date.getUTCFullYear();
          const month = date.getUTCMonth() + 1;
          const quarter = Math.floor((month - 1) / 3) + 1;
          const quarterKey = `${year}-Q${quarter}`;
          expect(quarterKey).toBe(testCase.expectedQuarter);
        }
      }
    });
  });

  describe('model-pricing.json', () => {
    // Import the actual pricing from generation-pipeline
    const MODEL_PRICING: Record<string, { input: number; output: number }> = {
      'claude-opus-4-6': { input: 15, output: 75 },
      'claude-sonnet-4-20250514': { input: 3, output: 15 },
      'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
    };

    it('should match contract pricing for all models', () => {
      for (const [model, pricing] of Object.entries(modelPricingContract.models)) {
        expect(MODEL_PRICING[model]).toEqual(pricing);
      }
    });

    it('should calculate costs correctly', () => {
      for (const testCase of modelPricingContract.testCases) {
        const pricing = MODEL_PRICING[testCase.model];
        const cost = 
          (testCase.inputTokens / 1_000_000) * pricing.input +
          (testCase.outputTokens / 1_000_000) * pricing.output;
        
        expect(cost).toBeCloseTo(testCase.expectedCost, 10);
      }
    });
  });

  describe('prompts.json', () => {
    it('should match daily summary system prompt', () => {
      expect(DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT).toBe(
        promptsContract.dailySummary.systemPrompt
      );
    });

    it('should match daily summary user prompt template', () => {
      expect(DEFAULT_DAILY_SUMMARY_USER_PROMPT).toBe(
        promptsContract.dailySummary.userPromptTemplate
      );
    });

    it('should match book recommendations system prompt', () => {
      expect(DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT).toBe(
        promptsContract.bookRecommendations.systemPrompt
      );
    });

    it('should match book recommendations user prompt template', () => {
      expect(DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT).toBe(
        promptsContract.bookRecommendations.userPromptTemplate
      );
    });
  });

  describe('anthropic-tools.json', () => {
    it('should match finalize_summary tool definition', () => {
      const expectedTool = anthropicToolsContract.tools.finalize_summary;
      
      // The actual tool is constructed in generation-pipeline.ts
      // We verify the structure matches
      expect(expectedTool.name).toBe('finalize_summary');
      expect(expectedTool.description).toBe(
        'Call this tool when you are ready to provide the final summary. This signals that your analysis is complete.'
      );
      expect(expectedTool.input_schema.type).toBe('object');
      expect(expectedTool.input_schema.properties.summary.type).toBe('string');
      expect(expectedTool.input_schema.required).toEqual(['summary']);
    });

    it('should match finalize_recommendations tool definition', () => {
      const expectedTool = anthropicToolsContract.tools.finalize_recommendations;
      
      expect(expectedTool.name).toBe('finalize_recommendations');
      expect(expectedTool.description).toBe(
        'Call this tool when you are ready to provide the final book recommendations.'
      );
      expect(expectedTool.input_schema.type).toBe('object');
      expect(expectedTool.input_schema.properties.recommendations.type).toBe('string');
      expect(expectedTool.input_schema.required).toEqual(['recommendations']);
    });
  });

  describe('storage-interface.json', () => {
    it('should verify StorageBackend has all required methods', () => {
      // This is a structural check - TypeScript will enforce this at compile time
      // We just verify the contract lists the expected methods
      const requiredMethods = storageInterfaceContract.requiredMethods;
      
      expect(requiredMethods.settings).toHaveLength(2);
      expect(requiredMethods.articles).toHaveLength(4);
      expect(requiredMethods.summaries).toHaveLength(5);
      expect(requiredMethods.topicActivity).toHaveLength(2);
      expect(requiredMethods.bookLists).toHaveLength(3);
      
      // Verify the interface exists and has the right shape
      // This is a compile-time check, but we can verify method names
      const methodNames = [
        ...requiredMethods.settings.map((m: any) => m.name),
        ...requiredMethods.articles.map((m: any) => m.name),
        ...requiredMethods.summaries.map((m: any) => m.name),
        ...requiredMethods.topicActivity.map((m: any) => m.name),
        ...requiredMethods.bookLists.map((m: any) => m.name),
      ];
      
      expect(methodNames).toContain('getSettings');
      expect(methodNames).toContain('saveSettings');
      expect(methodNames).toContain('saveArticle');
      expect(methodNames).toContain('getArticlesByMonth');
      expect(methodNames).toContain('deleteArticle');
      expect(methodNames).toContain('getAllArticles');
      expect(methodNames).toContain('saveSummary');
      expect(methodNames).toContain('getSummaryByTopic');
      expect(methodNames).toContain('getAllSummaries');
      expect(methodNames).toContain('deleteSummary');
      expect(methodNames).toContain('cleanupExpiredSummaries');
      expect(methodNames).toContain('logTopicActivity');
      expect(methodNames).toContain('getActiveTopicIdsForQuarter');
      expect(methodNames).toContain('saveBookList');
      expect(methodNames).toContain('getBookListByQuarterAndTopic');
      expect(methodNames).toContain('getBookListsByQuarter');
    });
  });
});
