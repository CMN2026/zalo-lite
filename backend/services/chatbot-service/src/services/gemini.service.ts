/**
 * Gemini AI Service (Google AI)
 * Uses Google's Gemini API for advanced NLP and chatbot responses
 * More powerful than rule-based classification
 */

import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

export interface GeminiResponse {
  intent: string;
  confidence: number;
  suggestedResponse: string;
  action?: string;
}

export class GeminiService {
  private apiKey: string;
  private model: string = "gemini-2.0-flash"; // Use stable model - 3.0 may have quota issues
  private baseUrl: string =
    "https://generativelanguage.googleapis.com/v1beta/models";

  constructor() {
    this.apiKey = env.GEMINI_API_KEY;
    // Only throw error when API is actually used if key is missing
  }

  /**
   * Classify user intent and generate response using Gemini
   */
  async classifyAndRespond(userMessage: string): Promise<GeminiResponse> {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    try {
      const prompt = `
You are a helpful chatbot for Zalo-Lite messaging app. Analyze the user's message and:
1. Identify the intent (one of: HOW_TO_ADD_FRIEND, PASSWORD_RESET, HOW_TO_CREATE_GROUP, ACCOUNT_ISSUES, CONTACT_SUPPORT, GENERAL_INQUIRY)
2. Provide a helpful response in English
3. Rate your confidence (0.0-1.0)

User message: "${userMessage}"

Respond in JSON format:
{
  "intent": "INTENT_NAME",
  "confidence": 0.95,
  "suggestedResponse": "Your helpful response here",
  "action": "escalate" (optional, if needs admin)
}`;

      const response = await fetch(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 500,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.text();
        if (response.status === 429) {
          console.warn(`⚠️  [Gemini] Quota exceeded (429): Retrying later`);
        } else {
          console.error(`❌ [Gemini] HTTP ${response.status}: ${errorData}`);
        }
        throw new HttpError(response.status, "gemini_api_error");
      }

      const data = (await response.json()) as any;

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new HttpError(500, "gemini_no_response");
      }

      const responseText = data.candidates[0].content.parts[0].text;

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new HttpError(500, "gemini_invalid_format");
      }

      const result = JSON.parse(jsonMatch[0]) as GeminiResponse;
      return result;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      console.error("Gemini API error:", error);
      throw new HttpError(503, "gemini_service_unavailable");
    }
  }

  /**
   * Generate FAQ suggestions using Gemini
   */
  async generateFAQSuggestions(category: string): Promise<string[]> {
    try {
      const prompt = `Generate 5 common FAQ questions for the "${category}" category in Zalo-Lite app.
Return as JSON array of strings. Example:
["Làm sao để...?", "Tại sao...", ...]`;

      const response = await fetch(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[Gemini FAQ] HTTP ${response.status}: ${errorData}`);
        throw new HttpError(response.status, "gemini_api_error");
      }

      const data = (await response.json()) as any;
      const responseText = data.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        return [];
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Failed to generate FAQ suggestions:", error);
      return [];
    }
  }

  /**
   * Moderate content for safety
   */
  async moderateContent(
    content: string,
  ): Promise<{ safe: boolean; reason?: string }> {
    try {
      const prompt = `Is this message safe and appropriate for a messaging app? Just respond with valid JSON:
{"safe": true/false, "reason": "explanation if not safe"}

Message: "${content}"`;

      const response = await fetch(
        `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        return { safe: true }; // Default to safe if API fails
      }

      const data = (await response.json()) as any;
      const responseText = data.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return { safe: true };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Moderation error:", error);
      return { safe: true }; // Default to safe on error
    }
  }
}

export const geminiService = new GeminiService();
