import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";
import {
  conversationRepository,
  type IMessage,
} from "../repositories/conversation.repository.js";
import { faqRepository } from "../repositories/faq.repository.js";
import { geminiService, type GeminiResponse } from "./gemini.service.js";
import { localNLPService } from "./local-nlp.service.js";
import { responseCacheService } from "./response-cache.service.js";
import { learningService } from "./learning.service.js";

export class ChatbotService {
  // Confidence threshold: if below, prioritize local NLP
  private readonly CONFIDENCE_THRESHOLD = 0.5;

  async handleMessage(
    userId: string,
    message: string,
    conversationId?: string,
  ) {
    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      convId = await conversationRepository.create(userId);
    }

    // ⚡ Step 1: Check cache first (fastest response)
    const cachedResponse =
      await responseCacheService.getCachedResponse(message);
    if (cachedResponse) {
      console.log(
        `⚡ [CACHE HIT] Using cached response for intent: ${cachedResponse.intent}`,
      );

      // Store user message
      const userMessage: IMessage = {
        id: uuidv4(),
        type: "user",
        content: message,
        senderId: userId,
        createdAt: Date.now(),
      };

      await conversationRepository.addMessage(convId, userMessage);

      // Return cached response directly
      const botMessage: IMessage = {
        id: uuidv4(),
        type: "bot",
        content: cachedResponse.response,
        senderId: "chatbot",
        intent: cachedResponse.intent,
        confidence: cachedResponse.confidence,
        createdAt: Date.now(),
      };

      await conversationRepository.addMessage(convId, botMessage);

      return {
        conversationId: convId,
        message: botMessage,
        action: undefined,
        engine: "cache",
      };
    }

    // Smart Hybrid Intent Classification
    // Priority: Best Confidence (Gemini or Local NLP) > Gemini > Local NLP > Default
    let classifyResult: GeminiResponse;
    let selectedEngine = "local-nlp"; // default

    if (env.ENABLE_AI_ENGINE) {
      try {
        // Try Gemini with timeout
        const geminiPromise = geminiService.classifyAndRespond(message);
        const timeoutPromise = new Promise<GeminiResponse>((_, reject) =>
          setTimeout(
            () => reject(new Error("Gemini timeout")),
            5000, // 5 second timeout
          ),
        );

        let geminiResult: GeminiResponse | null = null;
        try {
          geminiResult = await Promise.race([geminiPromise, timeoutPromise]);
        } catch {
          geminiResult = null;
        }

        if (geminiResult) {
          // Gemini succeeded - check confidence
          const localResult = await localNLPService.classifyAndRespond(message);

          // Compare and pick the best
          if (
            geminiResult.confidence >= this.CONFIDENCE_THRESHOLD &&
            geminiResult.confidence >= localResult.confidence
          ) {
            classifyResult = geminiResult;
            selectedEngine = "gemini";
            console.log(
              `✅ [HYBRID] Selected: Gemini (confidence: ${geminiResult.confidence}, local: ${localResult.confidence})`,
            );
          } else if (localResult.confidence >= geminiResult.confidence) {
            classifyResult = localResult;
            selectedEngine = "local-nlp-hybrid";
            console.log(
              `✅ [HYBRID] Selected: LocalNLP (confidence: ${localResult.confidence} > gemini: ${geminiResult.confidence})`,
            );
          } else {
            classifyResult = geminiResult;
            selectedEngine = "gemini-low-confidence";
            console.warn(
              `⚠️  [HYBRID] Using Gemini (low confidence: ${geminiResult.confidence}, below threshold)`,
            );
          }
        } else {
          // Gemini timeout or error - use local NLP
          classifyResult = await localNLPService.classifyAndRespond(message);
          selectedEngine = "local-nlp-fallback";
          console.warn(`⚠️  [HYBRID] Gemini unavailable, using LocalNLP`);
        }
      } catch (error) {
        // Unexpected error - fallback to local NLP
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ [HYBRID] Gemini error (${errorMsg}), using LocalNLP`);
        classifyResult = await localNLPService.classifyAndRespond(message);
        selectedEngine = "local-nlp-error-fallback";
      }
    } else {
      // AI engine disabled - use local NLP only
      classifyResult = await localNLPService.classifyAndRespond(message);
      selectedEngine = "local-nlp-only";
    }

    // Log selected engine and confidence
    console.log(
      `📊 [${selectedEngine.toUpperCase()}] Intent: ${classifyResult.intent} | Confidence: ${classifyResult.confidence}`,
    );

    // Store user message
    const userMessage: IMessage = {
      id: uuidv4(),
      type: "user",
      content: message,
      senderId: userId,
      createdAt: Date.now(),
    };

    await conversationRepository.addMessage(convId, userMessage);

    // Generate bot response (with intent and confidence from hybrid engine)
    const botMessage: IMessage = {
      id: uuidv4(),
      type: "bot",
      content: classifyResult.suggestedResponse,
      senderId: "chatbot",
      intent: classifyResult.intent,
      confidence: classifyResult.confidence,
      createdAt: Date.now(),
    };

    await conversationRepository.addMessage(convId, botMessage);

    // 💾 Step 2: Cache successful response for future use
    if (selectedEngine.includes("gemini") || classifyResult.confidence > 0.7) {
      await responseCacheService.cacheResponse(
        message,
        classifyResult.intent,
        classifyResult.suggestedResponse,
        classifyResult.confidence,
        selectedEngine.includes("gemini") ? "gemini" : "local-nlp",
      );
    }

    return {
      conversationId: convId,
      message: botMessage,
      action: classifyResult.action,
      engine: selectedEngine,
    };
  }

  async listConversations(userId: string, limit: number = 10) {
    return conversationRepository.listByUserId(userId, limit);
  }

  async getHistory(conversationId: string, limit: number = 50) {
    return conversationRepository.getHistory(conversationId, limit);
  }

  async getFAQ() {
    return faqRepository.getAll();
  }

  async searchFAQ(query: string) {
    const keywords = query.toLowerCase().split(/\s+/);
    // Simple search - in production use full-text search or Elasticsearch
    const faqs = await faqRepository.getAll();
    return faqs.filter((faq) =>
      keywords.some(
        (kw) =>
          faq.question.toLowerCase().includes(kw) ||
          faq.answer.toLowerCase().includes(kw) ||
          faq.keywords.some((k) => k.includes(kw)),
      ),
    );
  }

  async escalateToAdmin(conversationId: string, adminId: string) {
    return conversationRepository.escalateToAdmin(conversationId, adminId);
  }

  async closeConversation(conversationId: string) {
    return conversationRepository.close(conversationId);
  }

  /**
   * Record user feedback for response quality tracking
   * Used for continuous learning and improvement
   */
  async recordFeedback(
    messageId: string,
    intent: string,
    rating: number, // 1-5 stars
    feedback?: string,
  ) {
    // Record in learning service for pattern improvement
    await learningService.recordFeedback(messageId, intent, rating, feedback);

    return {
      status: "recorded",
      intent,
      rating,
      feedback: feedback || null,
    };
  }

  /**
   * Get learning statistics
   */
  async getLearningStats() {
    const stats = await learningService.getStats();
    const patterns = await learningService.getAllLearnedPatterns();

    return {
      ...stats,
      topPatterns: patterns.slice(0, 5).map((p) => ({
        intent: p.intent,
        keywords: p.keywords.length,
        responses: p.responseVariations.length,
        matches: p.matchCount,
        confidence: p.avgConfidence.toFixed(2),
      })),
    };
  }
}

export const chatbotService = new ChatbotService();
