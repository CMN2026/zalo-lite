export type SearchableMessage = {
  type: "text" | "file" | "call" | "system";
  content: string;
  recalled_at?: string | null;
};

type ParsedFilePayload = {
  text?: string;
  file?: {
    filename?: string;
    originalName?: string;
    mimetype?: string;
    size?: number;
    path?: string;
  } | null;
};

function parseMessageContent(content: string): ParsedFilePayload {
  if (!content || !content.trim().startsWith("{")) {
    return { text: content, file: null };
  }

  try {
    const parsed = JSON.parse(content) as ParsedFilePayload;
    return {
      text: parsed.text ?? "",
      file: parsed.file ?? null,
    };
  } catch {
    return { text: content, file: null };
  }
}

export function formatMessageSearchPreview(
  message: SearchableMessage,
  senderName: string,
): string {
  if (message.recalled_at) {
    return "Tin nhắn đã được thu hồi";
  }

  const { text, file } = parseMessageContent(message.content);
  if (file) {
    return file.mimetype?.startsWith("image/")
      ? "🖼 Hình ảnh"
      : `📎 ${file.originalName ?? file.filename ?? "[Tệp đính kèm]"}`;
  }

  const rawText = (text || message.content || "").trim();
  const isCallLikeContent =
    message.type === "call" ||
    rawText.includes("đã gọi") ||
    rawText.includes("Cuộc gọi");

  if (!isCallLikeContent) {
    return rawText || "Tin nhắn";
  }

  const durationMatch =
    rawText.match(/•\s*(.+)$/) ??
    rawText.match(/đã gọi\s*[•:]?\s*(.+)$/i) ??
    rawText.match(/Cuộc gọi kết thúc:\s*(.+)$/i);
  const duration = durationMatch?.[1]?.trim();

  return duration
    ? `📞 ${senderName} đã gọi ${duration}`
    : `📞 ${senderName} đã gọi`;
}

export function findKeywordMatchRange(content: string, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return null;
  }

  const normalizedContent = content.toLowerCase();
  const start = normalizedContent.indexOf(normalizedKeyword);
  if (start < 0) {
    return null;
  }

  return {
    start,
    end: start + normalizedKeyword.length,
  };
}
