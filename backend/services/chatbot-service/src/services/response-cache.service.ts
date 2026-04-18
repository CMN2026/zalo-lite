/**
 * Response Cache Service - Store and reuse intelligent responses
 * Reduces API calls + speeds up repeated questions
 */

import { redisClient } from "../config/redis.js";

export interface CachedResponse {
  originalMessage: string;
  intent: string;
  response: string;
  confidence: number;
  createdAt: number;
  engine: "gemini" | "local-nlp" | "cache";
}

export class ResponseCacheService {
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours
  private readonly SIMILARITY_THRESHOLD = 0.7; // 70% similarity

  /**
   * Calculate similarity between two strings (0-1)
   * Using simple token overlap for speed
   */
  private similarityScore(str1: string, str2: string): number {
    const tokens1 = str1.toLowerCase().split(/\s+/);
    const tokens2 = str2.toLowerCase().split(/\s+/);

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    const intersection = [...set1].filter((word) => set2.has(word)).length;
    const union = new Set([...set1, ...set2]).size;

    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Get cached response for similar question
   */
  async getCachedResponse(userMessage: string): Promise<CachedResponse | null> {
    try {
      // Get all cache keys
      const cacheKeys = await redisClient.keys("chatbot:response:*");

      if (cacheKeys.length === 0) return null;

      let bestMatch: CachedResponse | null = null;
      let bestSimilarity = 0;

      // Find most similar cached response
      for (const key of cacheKeys) {
        const cached = await redisClient.get(key);
        if (!cached) continue;

        const cachedData = JSON.parse(cached) as CachedResponse;
        const similarity = this.similarityScore(userMessage, cachedData.originalMessage);

        // If similarity above threshold and better than current best
        if (
          similarity > this.SIMILARITY_THRESHOLD &&
          similarity > bestSimilarity
        ) {
          bestMatch = cachedData;
          bestSimilarity = similarity;
        }
      }

      if (bestMatch) {
        console.log(
          `✅ [CACHE HIT] Similarity: ${(bestSimilarity * 100).toFixed(1)}%`,
        );
        return { ...bestMatch, engine: "cache" };
      }

      return null;
    } catch (error) {
      console.error("Cache retrieval error:", error);
      return null;
    }
  }

  /**
   * Store response in cache for future use
   */
  async cacheResponse(
    userMessage: string,
    intent: string,
    response: string,
    confidence: number,
    engine: "gemini" | "local-nlp",
  ): Promise<void> {
    try {
      const cacheKey = `chatbot:response:${intent}:${Date.now()}`;
      const cacheData: CachedResponse = {
        originalMessage: userMessage,
        intent,
        response,
        confidence,
        createdAt: Date.now(),
        engine,
      };

      await redisClient.setEx(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(cacheData),
      );

      console.log(`💾 [CACHE SAVED] Intent: ${intent}`);
    } catch (error) {
      console.error("Cache save error:", error);
      // Don't throw - cache is optional
    }
  }

  /**
   * Clear old cache entries (run periodically)
   */
  async clearExpiredCache(): Promise<void> {
    try {
      // Redis TTL handles automatic expiration
      // This is just for logging/maintenance
      const cacheKeys = await redisClient.keys("chatbot:response:*");
      console.log(`📊 Cache entries: ${cacheKeys.length}`);
    } catch (error) {
      console.error("Cache cleanup error:", error);
    }
  }
}

export const responseCacheService = new ResponseCacheService();
