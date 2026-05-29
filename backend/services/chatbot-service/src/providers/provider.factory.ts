import { AIProvider } from "./ai-provider.interface.js";
import { OllamaProvider } from "./ollama.provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import {
  markProviderFailure,
  recordProviderLatency,
} from "../observability/metrics.js";

type ProviderEntry = { instance: AIProvider; priority: number };

const DEFAULT_PRIORITY = ["ollama", "gemini"];

export class ProviderFactory {
  private readonly providers: ProviderEntry[] = [];

  constructor() {
    // Build providers based on environment priority list
    const env = process.env.AI_PROVIDER_PRIORITY || DEFAULT_PRIORITY.join(",");
    const list = env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const name of list) {
      if (name === "ollama")
        this.providers.push({
          instance: new OllamaProvider(process.env.OLLAMA_MODEL),
          priority: this.providers.length,
        });
      if (name === "gemini")
        this.providers.push({
          instance: new GeminiProvider(),
          priority: this.providers.length,
        });
    }
    // Always ensure gemini exists as last resort
    if (!this.providers.some((p) => p.instance.name === "gemini")) {
      this.providers.push({
        instance: new GeminiProvider(),
        priority: this.providers.length,
      });
    }
  }

  // Return provider instances in priority order
  getProviders(): AIProvider[] {
    return this.providers.map((p) => p.instance);
  }

  // Helper: attempt generate with failover and timeout
  async generateWithFailover(
    promptInput: { prompt: string; conversationId?: string },
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ) {
    const providers = this.getProviders();
    for (const p of providers) {
      try {
        const start = Date.now();
        const res = await p.generate(
          {
            prompt: promptInput.prompt,
            conversationId: promptInput.conversationId,
          },
          { timeoutMs: opts?.timeoutMs, signal: opts?.signal },
        );
        const ms = Date.now() - start;
        recordProviderLatency(p.name, ms);
        return { provider: p.name, response: res };
      } catch (err: unknown) {
        // continue to next provider
        console.warn(
          `provider ${p.name} failed:`,
          err instanceof Error ? err.message : String(err),
        );
        markProviderFailure(p.name, err);
      }
    }
    throw new Error("All AI providers failed");
  }
}

export const providerFactory = new ProviderFactory();
