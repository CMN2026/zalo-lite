// Lightweight adapter that delegates to existing gemini service implementation.
import {
  AIProvider,
  GenerateInput,
  ProviderResponse,
} from "./ai-provider.interface.js";

import { geminiService } from "../services/gemini.service.js";

export class GeminiProvider implements AIProvider {
  name = "gemini";

  async generate(
    input: GenerateInput,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<ProviderResponse> {
    // Try known exported functions from existing gemini.service
    if (
      geminiService &&
      typeof geminiService.classifyAndRespond === "function"
    ) {
      const resp = await geminiService.classifyAndRespond(input.prompt);
      return {
        text: resp?.suggestedResponse || JSON.stringify(resp),
        raw: resp,
      };
    }

    // Fallback: throw so factory falls back to other providers.
    throw new Error("Gemini provider binding not found");
  }

  async *stream(
    input: GenerateInput,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ): AsyncGenerator<string, void, unknown> {
    const r = await this.generate(input);
    // naive chunker: yield in 200-char chunks
    const s = r.text || "";
    for (let i = 0; i < s.length; i += 200) {
      yield s.slice(i, i + 200);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // otherwise assume available if API key present
      return !!process.env.GEMINI_API_KEY;
    } catch (error) {
      console.warn("Gemini health check failed:", error);
      return false;
    }
  }
}
