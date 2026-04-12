/**
 * Dynamic Learning Service - Chatbot learns from user interactions
 * Stores learned patterns, keywords, and improves responses over time
 */

import { redisClient } from "../config/redis.js";

export interface LearnedPattern {
  intent: string;
  keywords: string[];
  responseVariations: string[];
  matchCount: number;
  avgConfidence: number;
  lastUpdated: number;
}

export interface UserFeedback {
  messageId: string;
  intent: string;
  rating: number; // 1-5 stars
  feedback?: string;
  timestamp: number;
}

export class LearningService {
  private readonly LEARNED_PATTERNS_PREFIX = "learned:pattern:";
  private readonly USER_FEEDBACK_PREFIX = "feedback:";
  private readonly LEARNING_TTL = 30 * 24 * 60 * 60; // 30 days

  /**
   * Extract keywords from user message for learning
   */
  private extractKeywords(text: string): string[] {
    const normalized = text.toLowerCase().trim();

    // Split by whitespace and punctuation
    const tokens = normalized.split(/[\s\.,!?;:]+/).filter((t) => t.length > 2); // Min 3 chars

    // Remove common stop words
    const stopWords = new Set([
      "là",
      "của",
      "cái",
      "được",
      "không",
      "có",
      "thế",
      "rồi",
      "và",
      "hay",
      "hoặc",
      "từ",
      "đến",
      "nào",
      "gì",
      "như",
      "cách",
      "muốn",
      "cần",
      "để",
    ]);

    return tokens.filter((token) => !stopWords.has(token));
  }

  /**
   * Learn from successful classification (high confidence responses)
   */
  async learnFromSuccess(
    userMessage: string,
    intent: string,
    confidence: number,
    response: string,
  ): Promise<void> {
    if (confidence < 0.6) return; // Only learn from confident matches

    try {
      const keywords = this.extractKeywords(userMessage);
      const patternKey = `${this.LEARNED_PATTERNS_PREFIX}${intent}`;

      // Get existing pattern
      const existingData = await redisClient.get(patternKey);
      let pattern: LearnedPattern = existingData
        ? JSON.parse(existingData)
        : {
            intent,
            keywords: [],
            responseVariations: [],
            matchCount: 0,
            avgConfidence: 0,
            lastUpdated: Date.now(),
          };

      // Add new keywords (avoid duplicates)
      const existingKeywords = new Set(pattern.keywords);
      const newKeywords = keywords.filter((k) => !existingKeywords.has(k));
      pattern.keywords.push(...newKeywords);

      // Add response variation
      if (
        response &&
        !pattern.responseVariations.includes(response) &&
        pattern.responseVariations.length < 5
      ) {
        pattern.responseVariations.push(response);
      }

      // Update stats
      pattern.matchCount++;
      pattern.avgConfidence =
        (pattern.avgConfidence * (pattern.matchCount - 1) + confidence) /
        pattern.matchCount;
      pattern.lastUpdated = Date.now();

      // Save to Redis
      await redisClient.setEx(
        patternKey,
        this.LEARNING_TTL,
        JSON.stringify(pattern),
      );

      console.log(
        `📚 [LEARNING] Pattern "${intent}" learned: +${newKeywords.length} keywords, confidence: ${pattern.avgConfidence.toFixed(2)}`,
      );
    } catch (error) {
      console.error("Learning error:", error);
      // Don't fail - learning is optional
    }
  }

  /**
   * Get learned pattern for an intent
   */
  async getLearnedPattern(intent: string): Promise<LearnedPattern | null> {
    try {
      const patternKey = `${this.LEARNED_PATTERNS_PREFIX}${intent}`;
      const data = await redisClient.get(patternKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Pattern retrieval error:", error);
      return null;
    }
  }

  /**
   * Collect user feedback for continuous improvement
   */
  async recordFeedback(
    messageId: string,
    intent: string,
    rating: number,
    feedback?: string,
  ): Promise<void> {
    try {
      const feedbackKey = `${this.USER_FEEDBACK_PREFIX}${intent}:${Date.now()}`;

      const feedbackData: UserFeedback = {
        messageId,
        intent,
        rating, // 1-5 stars
        feedback,
        timestamp: Date.now(),
      };

      await redisClient.setEx(
        feedbackKey,
        this.LEARNING_TTL,
        JSON.stringify(feedbackData),
      );

      // Update learned pattern confidence based on rating
      if (rating >= 4) {
        // Good feedback - increase confidence
        const pattern = await this.getLearnedPattern(intent);
        if (pattern) {
          pattern.avgConfidence = Math.min(pattern.avgConfidence + 0.05, 0.99);
          await redisClient.setEx(
            `${this.LEARNED_PATTERNS_PREFIX}${intent}`,
            this.LEARNING_TTL,
            JSON.stringify(pattern),
          );
        }
      }

      console.log(
        `⭐ [FEEDBACK] ${intent}: ${rating}🌟 ${feedback ? `(${feedback})` : ""}`,
      );
    } catch (error) {
      console.error("Feedback recording error:", error);
    }
  }

  /**
   * Get learning statistics
   */
  async getStats(): Promise<{ learned: number; feedback: number }> {
    try {
      const patterns = await redisClient.keys(
        `${this.LEARNED_PATTERNS_PREFIX}*`,
      );
      const feedbacks = await redisClient.keys(`${this.USER_FEEDBACK_PREFIX}*`);

      return {
        learned: patterns.length,
        feedback: feedbacks.length,
      };
    } catch (error) {
      console.error("Stats error:", error);
      return { learned: 0, feedback: 0 };
    }
  }

  /**
   * Get all learned patterns
   */
  async getAllLearnedPatterns(): Promise<LearnedPattern[]> {
    try {
      const patternKeys = await redisClient.keys(
        `${this.LEARNED_PATTERNS_PREFIX}*`,
      );
      const patterns: LearnedPattern[] = [];

      for (const key of patternKeys) {
        const data = await redisClient.get(key);
        if (data) {
          patterns.push(JSON.parse(data));
        }
      }

      return patterns.sort((a, b) => b.matchCount - a.matchCount);
    } catch (error) {
      console.error("Pattern retrieval error:", error);
      return [];
    }
  }
}

export const learningService = new LearningService();
