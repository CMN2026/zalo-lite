import {
  AIProvider,
  GenerateInput,
  ProviderResponse,
} from "./ai-provider.interface.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

export class GroqProvider implements AIProvider {
  name = "groq";

  private readonly model: string;
  private readonly apiKey: string;

  constructor(model?: string) {
    this.model = model || DEFAULT_MODEL;
    this.apiKey = process.env.GROQ_API_KEY || "";
    if (!this.apiKey) {
      console.warn("GROQ_API_KEY is not set. GroqProvider will fail.");
    }
  }

  async generate(
    input: GenerateInput,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<ProviderResponse> {
    const body = {
      model: this.model,
      messages: [{ role: "user", content: input.prompt }],
      max_tokens: 1024,
      stream: false,
    };
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });

    if (!res.ok) {
      throw new Error(`Groq generate failed: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content || String(json);
    return { text, raw: json };
  }

  async *stream(
    input: GenerateInput,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ): AsyncGenerator<string, void, unknown> {
    const body = {
      model: this.model,
      messages: [{ role: "user", content: input.prompt }],
      max_tokens: 2048,
      stream: true,
    };

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text();
      throw new Error(`Groq stream failed: ${res.status} ${res.statusText} - ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") {
            return;
          }
          if (dataStr) {
            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // ignore parse errors for chunks
            }
          }
        }
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    return !!this.apiKey;
  }
}
