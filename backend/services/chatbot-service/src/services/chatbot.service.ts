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
import { chatbotOrchestrator } from "../orchestrator/chatbot.orchestrator.js";

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
      const latestActiveConversation =
        await conversationRepository.getLatestActiveConversationByUserId(
          userId,
        );
      convId =
        latestActiveConversation?.conversationId ||
        (await conversationRepository.create(userId));
    } else {
      const currentConversation =
        await conversationRepository.getConversation(convId);

      if (
        !currentConversation ||
        ["resolved", "closed"].includes(currentConversation.status)
      ) {
        convId = await conversationRepository.create(userId);
      }
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

    // Orchestrator-based generation
    // New flow: semantic cache -> local NLP short-circuit -> RAG (placeholder) -> Ollama (stream) -> Gemini fallback
    // This preserves the previous behaviour but centralizes provider logic in the orchestrator.
    // Store user message
    const userMessage: IMessage = {
      id: uuidv4(),
      type: "user",
      content: message,
      senderId: userId,
      createdAt: Date.now(),
    };

    await conversationRepository.addMessage(convId, userMessage);

    // Generate using orchestrator and stream into an assembled response
    const assembled: string[] = [];
    try {
      // Fetch conversation history to provide context
      let historyText = "";
      try {
        const historyMsgs = await conversationRepository.getMessages(convId, 8);
        if (historyMsgs && historyMsgs.length > 0) {
          // Sort ascending for chronological order
          const sorted = historyMsgs.sort((a, b) => a.createdAt - b.createdAt);
          historyText = sorted
            .filter((m) => m.id !== userMessage.id) // Exclude current message
            .map((msg) => `${msg.type === "user" ? "User" : "Trợ lý Zalo-Lite"}: ${msg.content}`)
            .join("\n");
        }
      } catch (err) {
        console.warn("Failed to fetch history for orchestrator context");
      }

      await chatbotOrchestrator.handleMessageStreaming(
        { 
          prompt: message, 
          conversationId: convId,
          metadata: { history: historyText }
        },
        (chunk: string) => assembled.push(chunk),
        { timeoutMs: 30_000 },
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Orchestrator failed:", errorMessage);
      // As a safe fallback, use previous geminiService if available
      try {
        const fallback = await geminiService.classifyAndRespond(message);
        assembled.push(fallback.suggestedResponse || String(fallback));
      } catch (e2) {
        assembled.push("Xin lỗi, tôi không thể trả lời lúc này.");
      }
    }

    const finalText = assembled.join("");
    const botMessage: IMessage = {
      id: uuidv4(),
      type: "bot",
      content: finalText,
      senderId: "chatbot",
      intent: undefined,
      confidence: undefined,
      createdAt: Date.now(),
    };

    await conversationRepository.addMessage(convId, botMessage);

    // Cache if appropriate
    try {
      await responseCacheService.cacheResponse(
        message,
        "auto",
        finalText,
        0.8,
        "gemini",
      );
    } catch (e) {
      // ignore cache failures
    }

    return {
      conversationId: convId,
      message: botMessage,
      action: undefined,
      engine: "orchestrator",
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

  /**
   * Delete a single conversation
   */
  async deleteConversation(userId: string, conversationId: string) {
    return conversationRepository.deleteConversationForUser(
      conversationId,
      userId,
    );
  }
}

export const chatbotService = new ChatbotService();
