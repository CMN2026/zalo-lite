import {
  AIProvider,
  GenerateInput,
  ProviderResponse,
} from "./ai-provider.interface.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b-instruct-q4_K_M";

export class OllamaProvider implements AIProvider {
  name = "ollama";

  private readonly model: string;

  constructor(model?: string) {
    this.model = model || DEFAULT_MODEL;
  }

  async generate(
    input: GenerateInput,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<ProviderResponse> {
    const url = `${OLLAMA_URL}/api/chat`;
    const body = {
      model: this.model,
      messages: [{ role: "user", content: input.prompt }],
      max_tokens: 1024,
      stream: false,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });

    if (!res.ok) {
      throw new Error(
        `Ollama generate failed: ${res.status} ${res.statusText}`,
      );
    }

    const json = await res.json();
    const text =
      json?.message?.content || json?.response || json?.choices?.map((c: any) => c.text).join("\n") || String(json);
    return { text, raw: json };
  }

  async *stream(
    input: GenerateInput,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ): AsyncGenerator<string, void, unknown> {
    const url = `${OLLAMA_URL}/api/chat`;
    // Split the prompt into system and user based on BizMa structure
    // We pass the entire orchestrated prompt as the user role, but chat endpoint
    // properly templates it for Qwen-Instruct, whereas generate does not.
    const body = {
      model: this.model,
      messages: [{ role: "user", content: input.prompt }],
      max_tokens: 2048,
      stream: true,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Ollama stream failed: ${res.status} ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let buffer = "";
    while (!done) {
      const { value, done: rdone } = await reader.read();
      done = !!rdone;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const part = buffer.slice(0, idx + 1);
          buffer = buffer.slice(idx + 1);
          if (part.trim()) {
            try {
              const parsed = JSON.parse(part);
              if (parsed.message?.content) {
                yield parsed.message.content;
              }
            } catch (e) {
              // ignore parse errors for incomplete chunks
            }
          }
        }
        if (buffer.length > 256) {
          // If buffer gets too large without a newline, something is wrong, yield it.
          // Note: for chat endpoint, it usually sends complete JSON lines.
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        if (parsed.message?.content) yield parsed.message.content;
      } catch (e) {}
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/ping`);
      return res.ok;
    } catch (error) {
      console.warn("Ollama health check failed:", error);
      return false;
    }
  }
}
