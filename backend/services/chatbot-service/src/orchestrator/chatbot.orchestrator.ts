import { providerFactory } from "../providers/provider.factory.js";
import {
  getCachedResponse,
  setCachedResponse,
} from "../cache/semanticCache.js";
import { localNLPService } from "../services/local-nlp.service.js";
import { GenerateInput } from "../providers/ai-provider.interface.js";
import { buildTextEmbedding } from "../rag/embedding.js";
import {
  retrievalService,
  type RetrievalFilter,
  type RetrievalResult,
} from "../rag/retrieval.service.js";

const DEFAULT_RAG_TOP_K = Number(process.env.RAG_TOP_K ?? "4");
const DEFAULT_RAG_MIN_SCORE = Number(process.env.RAG_MIN_SCORE ?? "0.72");
const DEFAULT_MAX_CONTEXT_CHARS = Number(
  process.env.RAG_MAX_CONTEXT_CHARS ?? "4000",
);
const DEFAULT_MIN_GROUND_SCORE = Number(
  process.env.RAG_MIN_GROUND_SCORE ?? "0.76",
);

// Note: keep the orchestrator minimal and incremental. It can be expanded with RAG and safety layers.
export class ChatbotOrchestrator {
  async handleMessageStreaming(
    input: GenerateInput,
    onChunk: (chunk: string) => void,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ) {
    const timeoutMs = opts?.timeoutMs || 45000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(new Error("aborted")), timeoutMs);

    const signals: AbortSignal[] = [timeoutController.signal];
    if (opts?.signal) signals.push(opts.signal);
    const combinedSignal = AbortSignal.any(signals);

    const safeOpts = { ...opts, timeoutMs, signal: combinedSignal };

    try {
      const hash = this.hashPrompt(input.prompt);
      const cached = await this.streamCachedResponse(hash, onChunk);
      if (cached) {
        return { provider: "cache", cached: true };
      }

      const local = await this.tryLocalNlp(input.prompt, hash, onChunk);
      if (local) {
        return local;
      }

      const retrieval = await this.retrieveContext(input);
      const promptToUse = this.selectPrompt(
        input.prompt,
        retrieval,
        input.metadata,
      );

      return await this.streamFromProviders(
        promptToUse,
        input,
        onChunk,
        hash,
        retrieval,
        safeOpts,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  hashPrompt(prompt: string) {
    // simple normalized hashing; replace with sha256 in production
    const s = prompt.replace(/\s+/g, " ").toLowerCase().trim();
    let hash = 0;
    for (const char of s) {
      hash = Math.trunc((hash << 5) - hash + (char.codePointAt(0) ?? 0));
    }
    return `h_${Math.abs(hash)}`;
  }

  private async streamCachedResponse(
    hash: string,
    onChunk: (chunk: string) => void,
  ) {
    const cached = await getCachedResponse(hash);
    if (!cached) return false;

    for (let index = 0; index < cached.length; index += 200) {
      onChunk(cached.slice(index, index + 200));
    }

    return true;
  }

  private async tryLocalNlp(
    prompt: string,
    hash: string,
    onChunk: (chunk: string) => void,
  ) {
    try {
      const localResult = await localNLPService.classifyAndRespond(prompt);
      if (
        localResult?.suggestedResponse &&
        (localResult.confidence ?? 0) > 0.85
      ) {
        for (
          let index = 0;
          index < localResult.suggestedResponse.length;
          index += 200
        ) {
          onChunk(localResult.suggestedResponse.slice(index, index + 200));
        }

        await this.safeCache(hash, localResult.suggestedResponse);
        return {
          provider: "local-nlp",
          cached: false,
          text: localResult.suggestedResponse,
        };
      }
    } catch (error) {
      console.warn("Local NLP fallback skipped:", error);
    }

    return null;
  }

  private async retrieveContext(input: GenerateInput) {
    const queryEmbedding = await buildTextEmbedding(input.prompt);
    const ragFilters = this.extractRetrievalFilters(input.metadata);

    return retrievalService.searchSimilarDocuments({
      embedding: queryEmbedding,
      topK: DEFAULT_RAG_TOP_K,
      minScore: DEFAULT_RAG_MIN_SCORE,
      filters: ragFilters,
    });
  }

  private selectPrompt(
    prompt: string,
    retrieval: RetrievalResult,
    metadata?: Record<string, any>,
  ) {
    if (
      retrieval.contexts.length === 0 ||
      retrieval.confidence < DEFAULT_MIN_GROUND_SCORE ||
      !retrieval.shouldGround
    ) {
      return prompt;
    }

    return this.buildGroundedPrompt(prompt, retrieval, metadata);
  }

  private async streamFromProviders(
    promptToUse: string,
    input: GenerateInput,
    onChunk: (chunk: string) => void,
    hash: string,
    retrieval: RetrievalResult,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ) {
    const providers = providerFactory.getProviders();
    for (const provider of providers) {
      try {
        const finalText = await this.streamSingleProvider(
          provider,
          promptToUse,
          input,
          onChunk,
          opts,
        );
        await this.safeCache(hash, finalText);
        return { provider: provider.name, text: finalText, retrieval };
      } catch (error) {
        if (this.isAbortError(error)) {
          console.warn(`Orchestrator: provider ${provider.name} aborted`);
          throw error;
        }

        console.warn(
          `Orchestrator: provider ${provider.name} failed:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    throw new Error("No providers available");
  }

  private async streamSingleProvider(
    provider: ReturnType<typeof providerFactory.getProviders>[number],
    promptToUse: string,
    input: GenerateInput,
    onChunk: (chunk: string) => void,
    opts?: { timeoutMs?: number; signal?: AbortSignal },
  ) {
    if (opts?.signal?.aborted) throw new Error("aborted");

    const assembled: string[] = [];
    const modelInput = {
      prompt: promptToUse,
      conversationId: input.conversationId,
      metadata: input.metadata,
    };

    if (provider.stream) {
      for await (const chunk of provider.stream(modelInput, {
        timeoutMs: opts?.timeoutMs,
        signal: opts?.signal,
      })) {
        if (opts?.signal?.aborted) throw new Error("aborted");
        assembled.push(chunk);
        onChunk(chunk);
      }
      return assembled.join("");
    }

    const response = await provider.generate(modelInput, {
      timeoutMs: opts?.timeoutMs,
      signal: opts?.signal,
    });
    this.emitTextChunks(response.text, assembled, onChunk);
    return assembled.join("");
  }

  private emitTextChunks(
    text: string,
    assembled: string[],
    onChunk: (chunk: string) => void,
  ) {
    for (let index = 0; index < text.length; index += 200) {
      const chunk = text.slice(index, index + 200);
      assembled.push(chunk);
      onChunk(chunk);
    }
  }

  private async safeCache(hash: string, text: string) {
    try {
      await setCachedResponse(hash, text, 3600);
    } catch (error) {
      console.warn("Cache write skipped:", error);
    }
  }

  private isAbortError(error: unknown) {
    return error instanceof Error && error.message === "aborted";
  }

  private buildGroundedPrompt(
    prompt: string,
    retrieval: RetrievalResult,
    metadata?: Record<string, any>,
  ) {
    const language =
      `${metadata?.language || metadata?.lang || "vi"}`.toLowerCase();
    const contexts = retrieval.contexts
      .slice(0, DEFAULT_RAG_TOP_K)
      .map((context, index) => {
        const title =
          context.metadata?.title ||
          context.metadata?.question ||
          context.metadata?.category ||
          `Nguồn ${index + 1}`;
        return `[${index + 1}] ${title}\n${context.content}`;
      })
      .join("\n\n");

    const cappedContexts =
      contexts.length > DEFAULT_MAX_CONTEXT_CHARS
        ? `${contexts.slice(0, DEFAULT_MAX_CONTEXT_CHARS)}\n\n[...context truncated...]`
        : contexts;

    const instruction = [
      `Bạn là trợ lý hỗ trợ người dùng Zalo-Lite. Trả lời ngắn gọn, chính xác, ưu tiên tiếng Việt nếu câu hỏi là tiếng Việt.`,
      `Chỉ dựa vào ngữ cảnh được cung cấp khi trả lời. Nếu ngữ cảnh không đủ, hãy nói rõ là chưa đủ thông tin và đưa ra hướng dẫn an toàn, không bịa đặt.`,
      `Ưu tiên FAQ/tài liệu hệ thống hơn suy diễn chung. Nếu có mâu thuẫn giữa ngữ cảnh và suy đoán, chọn ngữ cảnh.`,
      `Giữ câu trả lời tự nhiên, thực dụng và phù hợp với người dùng Việt Nam.`,
    ].join(" ");

    return [
      instruction,
      `Ngôn ngữ mục tiêu: ${language}`,
      `Ngữ cảnh truy xuất (độ tin cậy ${retrieval.confidence.toFixed(2)}):`,
      cappedContexts || "(không có ngữ cảnh đáng tin cậy)",
      `Câu hỏi: ${prompt}`,
      `Trả lời:`,
    ].join("\n\n");
  }

  private extractRetrievalFilters(
    metadata?: Record<string, any>,
  ): RetrievalFilter | undefined {
    if (!metadata) return undefined;

    const filters: RetrievalFilter = {};
    this.mergeStringFilter(filters, "category", metadata.category);
    this.mergeStringFilter(
      filters,
      "language",
      metadata.language ?? metadata.lang,
    );
    this.mergeStringFilter(filters, "source", metadata.source);

    if (metadata.filters && typeof metadata.filters === "object") {
      for (const [key, value] of Object.entries(metadata.filters)) {
        this.mergeStringFilter(filters, key, value);
      }
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  }

  private mergeStringFilter(
    target: RetrievalFilter,
    key: string,
    value: unknown,
  ) {
    if (typeof value !== "string") return;

    const trimmed = value.trim();
    if (!trimmed) return;

    target[key] = trimmed;
  }
}

export const chatbotOrchestrator = new ChatbotOrchestrator();
