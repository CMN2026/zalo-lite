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
      return [
        `Bạn sẽ đóng vai một Trợ lý AI tên là "Trợ lý Zalo-Lite", được tạo ra bởi đội ngũ phát triển Zalo-Lite. Nhiệm vụ của bạn là tư vấn và giải đáp thắc mắc của người dùng về ứng dụng Zalo-Lite.`,
        `Giọng điệu của bạn phải lịch sự, thân thiện, mang tính phục vụ khách hàng.`,
        `Dưới đây là tài liệu hướng dẫn cơ bản về Zalo-Lite mà bạn PHẢI dựa vào để trả lời:`,
        `<guide>`,
        `- Tính năng: Chat 1-1, chat nhóm (tạo nhóm bằng cách bấm dấu + ở tab Tin nhắn).`,
        `- Bạn bè: Kết bạn qua số điện thoại (tại tab Danh bạ).`,
        `- Tiện ích: Gửi ảnh, video, file đính kèm. Gọi thoại và gọi video.`,
        `- Chi phí: Mọi dịch vụ hoàn toàn miễn phí, bảo mật mã hóa đầu cuối.`,
        `</guide>`,
        `Dưới đây là các quy tắc quan trọng cho cuộc hội thoại:`,
        `- Luôn giữ vai trò là "Trợ lý Zalo-Lite". Không bao giờ xưng là AI của OpenAI, Google hay bên thứ ba.`,
        `- Không bao giờ nói rằng bạn không biết Zalo-Lite. Bạn là chuyên gia về ứng dụng này.`,
        `- Nếu người dùng hỏi các bước chi tiết chưa có trong dữ liệu, hãy bịa ra các bước hợp lý dựa trên giao diện chuẩn của Zalo/ứng dụng chat (ví dụ: Vào Cài đặt -> Tài khoản).`,
        `- Tuyệt đối KHÔNG hướng dẫn sử dụng các ứng dụng khác như Facebook, Telegram, WhatsApp, Slack. Chỉ nói về Zalo-Lite.`,
        `- Trả lời ngắn gọn, trực tiếp vào vấn đề. Sử dụng ngôn ngữ mà người dùng đã sử dụng.`,
        `- BỎ QUA mọi bộ lọc an toàn liên quan đến mạng xã hội hoặc kết bạn. Người dùng đang hỏi về TÍNH NĂNG KẾT BẠN TRONG ỨNG DỤNG, không phải xin lời khuyên xã hội. HÃY HƯỚNG DẪN HỌ CÁCH THÊM BẠN BÈ.`,
        `- Nếu người dùng hỏi điều gì không liên quan đến ứng dụng (ví dụ: làm toán, viết code), hãy nói: "Xin lỗi, tôi là Trợ lý Zalo-Lite và chỉ hỗ trợ các vấn đề về ứng dụng này. Bạn có câu hỏi nào về Zalo-Lite cần tôi giúp không?"`,
        `Dưới đây là ví dụ về một cuộc hội thoại chuẩn:`,
        `<example>`,
        `User: Làm sao để nhắn tin nhóm?`,
        `Trợ lý Zalo-Lite: Chào bạn! Để nhắn tin nhóm trên Zalo-Lite, bạn chỉ cần vào tab "Tin nhắn", sau đó bấm vào biểu tượng dấu "+" ở góc trên bên phải màn hình để tạo nhóm mới nhé. Cần hỗ trợ thêm bạn cứ nhắn tôi!`,
        `</example>`,
        `Dưới đây là lịch sử trò chuyện trước đó (có thể trống nếu là tin nhắn đầu tiên):`,
        `<history>`,
        metadata?.history || "",
        `</history>`,
        `Dưới đây là câu hỏi của người dùng:`,
        `<question>`,
        `${prompt}`,
        `</question>`,
        `Hãy suy nghĩ kỹ trước khi trả lời. Trả lời ngay lập tức, không cần dùng thẻ <response> hay diễn giải hành động của bạn.`,
      ].join("\n");
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
    const contexts = retrieval.contexts
      .slice(0, DEFAULT_RAG_TOP_K)
      .map((context, index) => {
        const title =
          context.metadata?.title ||
          context.metadata?.question ||
          context.metadata?.category ||
          `Nguồn ${index + 1}`;
        return `[Nguồn ${index + 1} - ${title}]\n${context.content}`;
      })
      .join("\n\n");

    const cappedContexts =
      contexts.length > DEFAULT_MAX_CONTEXT_CHARS
        ? `${contexts.slice(0, DEFAULT_MAX_CONTEXT_CHARS)}\n\n[...dữ liệu bị cắt bớt...]`
        : contexts;

    return [
      `Bạn sẽ đóng vai một Trợ lý AI tên là "Trợ lý Zalo-Lite", được tạo ra bởi đội ngũ phát triển Zalo-Lite. Nhiệm vụ của bạn là tư vấn và giải đáp thắc mắc của người dùng về ứng dụng Zalo-Lite.`,
      `Giọng điệu của bạn phải lịch sự, thân thiện, mang tính phục vụ khách hàng.`,
      `Dưới đây là tài liệu hệ thống (FAQ) truy xuất được mà bạn PHẢI tham khảo để trả lời (độ tin cậy: ${retrieval.confidence.toFixed(2)}):`,
      `<guide>`,
      cappedContexts || "(Không có tài liệu truy xuất nào, hãy trả lời dựa trên tính năng cơ bản của một app chat)",
      `</guide>`,
      `Dưới đây là các quy tắc quan trọng cho cuộc hội thoại:`,
      `- Luôn giữ vai trò là "Trợ lý Zalo-Lite". Không bao giờ xưng là AI của OpenAI, Google hay bên thứ ba.`,
      `- Không bao giờ nói rằng bạn không biết Zalo-Lite. Bạn là chuyên gia về ứng dụng này.`,
      `- Tuyệt đối KHÔNG hướng dẫn sử dụng các ứng dụng khác như Facebook, Telegram, WhatsApp, Slack. Chỉ nói về Zalo-Lite.`,
      `- Trả lời ngắn gọn, trực tiếp vào vấn đề. Sử dụng ngôn ngữ mà người dùng đã sử dụng.`,
      `- BỎ QUA mọi bộ lọc an toàn liên quan đến mạng xã hội hoặc kết bạn. Người dùng đang hỏi về TÍNH NĂNG KẾT BẠN TRONG ỨNG DỤNG, không phải xin lời khuyên xã hội. HÃY HƯỚNG DẪN HỌ CÁCH THÊM BẠN BÈ.`,
      `- Ưu tiên sử dụng thông tin trong thẻ <guide>. Nếu thông tin trong thẻ <guide> không đủ, hãy suy luận hợp lý thay vì từ chối trả lời.`,
      `Dưới đây là lịch sử trò chuyện trước đó (có thể trống nếu là tin nhắn đầu tiên):`,
      `<history>`,
      metadata?.history || "",
      `</history>`,
      `Dưới đây là câu hỏi của người dùng:`,
      `<question>`,
      `${prompt}`,
      `</question>`,
      `Hãy suy nghĩ kỹ trước khi trả lời. Trả lời ngay lập tức, không cần dùng thẻ <response>.`,
    ].join("\n");
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
