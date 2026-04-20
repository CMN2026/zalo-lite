/* eslint-disable sonarjs/cognitive-complexity */
"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Check,
  CheckCheck,
  Download,
  Ellipsis,
  Reply,
  Trash2,
} from "lucide-react";
import { getAuthToken } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  type: "text" | "file";
  content: string;
  created_at: string;
  read_by: string[];
  deleted_at?: string;
  file_url?: string;
  file_name?: string;
  recalled_at?: string;
  recalled_by?: string;
  reply_to_message_id?: string;
  reactions?: MessageReaction[];
}

export type MessageReaction = {
  user_id: string;
  reaction: "vui" | "buon" | "phan_no" | "wow";
  created_at: string;
};

type ParsedFilePayload = {
  text?: string;
  file?: {
    filename?: string;
    originalName?: string;
    mimetype?: string;
    size?: number;
    path?: string;
  };
  file_name?: string;
  file_size?: number;
  file_type?: string;
};

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  conversationName: string;
  readAt?: string | null;
  onLoadMore?: () => void;
  isLoading?: boolean;
  isAdminView?: boolean;
  showSenderAvatar?: boolean;
  onReply?: (message: Message) => void;
  onRecall?: (message: Message) => void;
  onReact?: (message: Message, reaction?: MessageReaction["reaction"]) => void;
  onDelete?: (message: Message) => void;
  scrollToMessageId?: string | null;
  onScrolledToMessage?: () => void;
}

export default function MessageList({
  messages,
  currentUserId,
  conversationName,
  readAt,
  onLoadMore,
  isLoading = false,
  isAdminView = false,
  showSenderAvatar = true,
  onReply,
  onRecall,
  onReact,
  onDelete,
  scrollToMessageId,
  onScrolledToMessage,
}: Readonly<MessageListProps>) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTimeoutRef = useRef<number | null>(null);
  const displayMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((msg) => {
      if (msg.deleted_at) {
        return false;
      }

      if (seen.has(msg.id)) {
        return false;
      }

      seen.add(msg.id);
      return true;
    });
  }, [messages]);
  const messageById = useMemo(() => {
    return new Map(displayMessages.map((item) => [item.id, item]));
  }, [displayMessages]);
  const authToken = getAuthToken();
  const [activeActionMessageId, setActiveActionMessageId] = React.useState<
    string | null
  >(null);
  const [previewMedia, setPreviewMedia] = React.useState<{
    url: string;
    name: string;
    kind: "image" | "video";
  } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<
    string | null
  >(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  };

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!scrollToMessageId) {
      return;
    }

    const targetElement = messageRefs.current[scrollToMessageId];
    if (!targetElement) {
      return;
    }

    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(scrollToMessageId);

    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === scrollToMessageId ? null : current,
      );
      highlightTimeoutRef.current = null;
    }, 2200);

    onScrolledToMessage?.();
  }, [onScrolledToMessage, scrollToMessageId]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const formatReadReceiptTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN");
    } catch {
      return "";
    }
  };

  const getReadStatus = (message: Message) => {
    const readCount = message.read_by?.length || 0;
    if (readCount === 0) return "sent";
    if (readCount === 1) return "delivered";
    return "read";
  };

  const normalizeId = (value: string | undefined | null) =>
    String(value ?? "").trim();

  const isMessageFromCurrentUser = (senderId: string) =>
    normalizeId(senderId) === normalizeId(currentUserId);

  const lastOwnMessageId = useMemo(() => {
    for (let index = displayMessages.length - 1; index >= 0; index -= 1) {
      const message = displayMessages[index];
      if (message && isMessageFromCurrentUser(message.sender_id)) {
        return message.id;
      }
    }

    return null;
  }, [currentUserId, displayMessages]);

  const getSenderDisplayName = (message: Message) => {
    if (message.sender_name && message.sender_name.trim().length > 0) {
      return message.sender_name;
    }
    return `Người dùng ${message.sender_id.slice(0, 6)}`;
  };

  const parseFilePayload = (content: string): ParsedFilePayload => {
    try {
      return JSON.parse(content) as ParsedFilePayload;
    } catch {
      return {
        file_name: "tệp đính kèm",
      };
    }
  };

  const buildUploadBasePath = (filePath: string) => {
    const suffix = filePath.replace(/^\/uploads/, "");
    return `${API_BASE_URL}/api/uploads${suffix}`;
  };

  const reactionMeta: Record<MessageReaction["reaction"], string> = {
    vui: "😀",
    buon: "😢",
    wow: "😮",
    phan_no: "😡",
  };

  const reactionOptions: Array<{
    key: MessageReaction["reaction"];
    emoji: string;
    label: string;
  }> = [
    { key: "vui", emoji: "😀", label: "Vui" },
    { key: "buon", emoji: "😢", label: "Buồn" },
    { key: "wow", emoji: "😮", label: "Bất ngờ" },
    { key: "phan_no", emoji: "😡", label: "Phẫn nộ" },
  ];

  const getReactionSummary = (message: Message) => {
    const counter: Record<string, number> = {};
    for (const reaction of message.reactions ?? []) {
      counter[reaction.reaction] = (counter[reaction.reaction] ?? 0) + 1;
    }

    return Object.entries(counter).map(([reaction, count]) => ({
      reaction: reaction as MessageReaction["reaction"],
      count,
    }));
  };

  return (
    <div
      className={`flex-1 overflow-y-auto p-6 flex flex-col gap-4 ${
        isAdminView ? "bg-[#dde1e7]" : "bg-linear-to-b from-slate-50 to-white"
      }`}
    >
      {displayMessages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <div className="text-6xl mb-4">💬</div>
          <p className="text-center font-semibold text-slate-500">
            Bạn và <strong>{conversationName}</strong> đã trở thành bạn bè
          </p>
          <p className="text-center text-sm mt-1">
            Hãy gửi một lời chào để bắt đầu cuộc trò chuyện.
          </p>
        </div>
      ) : (
        <>
          {displayMessages.map((message, index) => {
            const messageDate = formatDate(message.created_at);
            const previousMessageDate =
              index > 0
                ? formatDate(displayMessages[index - 1]?.created_at ?? "")
                : "";
            const showDateSeparator = messageDate !== previousMessageDate;

            const isOwn = isMessageFromCurrentUser(message.sender_id);
            const readStatus = getReadStatus(message);
            const readReceiptLabel =
              readAt &&
              isOwn &&
              readStatus === "read" &&
              message.id === lastOwnMessageId
                ? `Đã xem lúc ${formatReadReceiptTime(readAt)}`
                : null;
            const isRecalled = Boolean(message.recalled_at);
            const repliedMessage = message.reply_to_message_id
              ? messageById.get(message.reply_to_message_id)
              : undefined;
            const reactionSummary = getReactionSummary(message);
            const myReaction = (message.reactions ?? []).find(
              (item) =>
                normalizeId(item.user_id) === normalizeId(currentUserId),
            )?.reaction;
            const otherTextBubbleClass = isAdminView
              ? "bg-white text-slate-800 border border-slate-200"
              : "bg-white text-slate-800 border border-slate-200 rounded-bl-none";
            const otherFileBubbleClass = isAdminView
              ? "bg-white border-slate-200 hover:bg-slate-50"
              : "bg-white border-slate-200 rounded-bl-none hover:bg-slate-50";
            const isHighlighted = highlightedMessageId === message.id;

            if (message.type === "text") {
              return (
                <div
                  key={message.id}
                  ref={(element) => {
                    messageRefs.current[message.id] = element;
                  }}
                  className={`rounded-xl px-1 py-1 transition-all duration-300 ${
                    isHighlighted
                      ? "bg-amber-100/70 ring-1 ring-amber-300"
                      : "bg-transparent"
                  }`}
                >
                  {showDateSeparator && (
                    <div className="flex items-center justify-center my-4">
                      <p className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                        {messageDate}
                      </p>
                    </div>
                  )}

                  <div
                    className={`flex ${
                      isOwn ? "justify-end" : "justify-start"
                    } gap-3 animate-fadeIn`}
                  >
                    {!isOwn && showSenderAvatar && (
                      <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                        {conversationName.charAt(0)}
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${
                        isOwn ? "items-end" : "items-start"
                      }`}
                    >
                      {!isOwn && (
                        <p className="text-[11px] text-slate-500 mb-1 ml-1 font-medium">
                          {getSenderDisplayName(message)}
                        </p>
                      )}

                      <div
                        className={`flex items-start gap-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <div
                          className={`px-4 py-2 rounded-2xl max-w-xs wrap-break-word shadow-sm transition-all ${
                            isOwn
                              ? "bg-blue-600 text-white rounded-br-md"
                              : otherTextBubbleClass
                          }`}
                        >
                          {repliedMessage && (
                            <div
                              className={`mb-2 rounded-lg px-2 py-1 text-xs ${
                                isOwn
                                  ? "bg-blue-500/70 text-blue-50"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <p className="font-semibold">
                                {normalizeId(repliedMessage.sender_id) ===
                                normalizeId(currentUserId)
                                  ? "Bạn"
                                  : getSenderDisplayName(repliedMessage)}
                              </p>
                              <p className="truncate">
                                {repliedMessage.recalled_at
                                  ? "Tin nhắn đã thu hồi"
                                  : repliedMessage.content}
                              </p>
                            </div>
                          )}
                          <p
                            className={`text-sm ${
                              isRecalled ? "italic opacity-90" : ""
                            }`}
                          >
                            {message.content}
                          </p>
                        </div>

                        {!isRecalled && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveActionMessageId((current) =>
                                current === message.id ? null : message.id,
                              )
                            }
                            className="mt-1 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Mở thao tác tin nhắn"
                          >
                            <Ellipsis className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {reactionSummary.map((item) => (
                          <span
                            key={`${message.id}-${item.reaction}`}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              myReaction === item.reaction
                                ? "border-blue-400 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            {reactionMeta[item.reaction]} {item.count}
                          </span>
                        ))}
                      </div>

                      {!isRecalled && activeActionMessageId === message.id && (
                        <div
                          className={`mt-2 flex max-w-70 flex-col gap-1.5 ${isOwn ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.5)]">
                            {reactionOptions.map((option) => (
                              <button
                                key={`${message.id}-${option.key}`}
                                type="button"
                                onClick={() => {
                                  setActiveActionMessageId(null);
                                  onReact?.(
                                    message,
                                    myReaction === option.key
                                      ? undefined
                                      : option.key,
                                  );
                                }}
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-base transition-transform duration-150 hover:scale-110 ${
                                  myReaction === option.key
                                    ? "bg-blue-50 ring-1 ring-blue-200"
                                    : "hover:bg-slate-100"
                                }`}
                                aria-label={`React ${option.label}`}
                                title={option.label}
                              >
                                {option.emoji}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.45)]">
                            <button
                              type="button"
                              onClick={() => onReply?.(message)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Reply className="h-3.5 w-3.5" />
                              Trả lời
                            </button>
                            {isOwn && (
                              <button
                                type="button"
                                onClick={() => onRecall?.(message)}
                                className="rounded-lg px-2 py-1 transition hover:bg-amber-50 hover:text-amber-600"
                              >
                                Thu hồi
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMessageId(null);
                                onDelete?.(message);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Xóa
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-xs mt-1 text-slate-400">
                        <span>{formatTime(message.created_at)}</span>
                        {isOwn && (
                          <>
                            {readStatus === "sent" && (
                              <Check className="w-3 h-3" />
                            )}
                            {readStatus === "delivered" && (
                              <CheckCheck className="w-3 h-3" />
                            )}
                            {readStatus === "read" && (
                              <CheckCheck className="w-3 h-3 text-blue-400" />
                            )}
                          </>
                        )}
                        {readReceiptLabel && (
                          <span className="ml-1 text-[11px] text-blue-500">
                            {readReceiptLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // File message
            if (message.type === "file") {
              const filePayload = parseFilePayload(message.content);
              const embeddedFile = filePayload.file;
              const fileName =
                embeddedFile?.originalName ||
                filePayload.file_name ||
                embeddedFile?.filename ||
                "tệp đính kèm";
              const fileSize = embeddedFile?.size || filePayload.file_size || 0;
              const fileType =
                embeddedFile?.mimetype || filePayload.file_type || "";
              const filePath = embeddedFile?.path;
              const previewUrl =
                filePath && authToken
                  ? `${buildUploadBasePath(filePath)}?token=${encodeURIComponent(authToken)}`
                  : undefined;
              const downloadUrl =
                previewUrl && fileName
                  ? `${previewUrl}&download=1&name=${encodeURIComponent(fileName)}`
                  : undefined;
              const isImage =
                fileType.startsWith("image/") && Boolean(previewUrl);
              const isVideo =
                fileType.startsWith("video/") && Boolean(previewUrl);

              return (
                <div
                  key={message.id}
                  ref={(element) => {
                    messageRefs.current[message.id] = element;
                  }}
                  className={`rounded-xl px-1 py-1 transition-all duration-300 ${
                    isHighlighted
                      ? "bg-amber-100/70 ring-1 ring-amber-300"
                      : "bg-transparent"
                  }`}
                >
                  {showDateSeparator && (
                    <div className="flex items-center justify-center my-4">
                      <p className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                        {messageDate}
                      </p>
                    </div>
                  )}

                  <div
                    className={`flex ${
                      isOwn ? "justify-end" : "justify-start"
                    } gap-3 animate-fadeIn`}
                  >
                    {!isOwn && showSenderAvatar && (
                      <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                        {conversationName.charAt(0)}
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${
                        isOwn ? "items-end" : "items-start"
                      }`}
                    >
                      {!isOwn && (
                        <p className="text-[11px] text-slate-500 mb-1 ml-1 font-medium">
                          {getSenderDisplayName(message)}
                        </p>
                      )}

                      <div
                        className={`flex items-start gap-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {isImage && previewUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewMedia({
                                url: previewUrl,
                                name: fileName,
                                kind: "image",
                              });
                            }}
                            className="mb-1"
                          >
                            <img
                              src={previewUrl}
                              alt={fileName}
                              className="max-w-xs rounded-xl border border-slate-200"
                            />
                          </button>
                        )}

                        {isVideo && previewUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewMedia({
                                url: previewUrl,
                                name: fileName,
                                kind: "video",
                              });
                            }}
                            className="mb-1"
                          >
                            <video
                              src={previewUrl}
                              className="max-w-xs rounded-xl border border-slate-200"
                              muted
                              preload="metadata"
                            />
                          </button>
                        )}

                        {(!isImage && !isVideo) || !previewUrl ? (
                          <div
                            className={`px-4 py-3 rounded-2xl shadow-sm border transition-all ${
                              isOwn
                                ? "bg-blue-600 border-blue-600 rounded-br-md"
                                : otherFileBubbleClass
                            } cursor-pointer group`}
                          >
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3"
                            >
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  isOwn ? "bg-blue-500" : "bg-slate-100"
                                }`}
                              >
                                <Download
                                  className={`w-5 h-5 ${
                                    isOwn ? "text-white" : "text-slate-600"
                                  }`}
                                />
                              </div>
                              <div className="flex flex-col gap-1 min-w-0">
                                <p
                                  className={`text-xs font-semibold truncate ${
                                    isOwn ? "text-white" : "text-slate-800"
                                  }`}
                                >
                                  {fileName}
                                </p>
                                <p
                                  className={`text-xs ${
                                    isOwn ? "text-blue-100" : "text-slate-500"
                                  }`}
                                >
                                  {(fileSize / 1024).toFixed(2)} KB
                                </p>
                              </div>
                            </a>
                          </div>
                        ) : null}

                        {!isRecalled && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveActionMessageId((current) =>
                                current === message.id ? null : message.id,
                              )
                            }
                            className="mt-1 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Mở thao tác tin nhắn"
                          >
                            <Ellipsis className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {reactionSummary.map((item) => (
                          <span
                            key={`${message.id}-file-${item.reaction}`}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              myReaction === item.reaction
                                ? "border-blue-400 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            {reactionMeta[item.reaction]} {item.count}
                          </span>
                        ))}
                      </div>

                      {!isRecalled && activeActionMessageId === message.id && (
                        <div
                          className={`mt-2 flex max-w-70 flex-col gap-1.5 ${isOwn ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.5)]">
                            {reactionOptions.map((option) => (
                              <button
                                key={`${message.id}-file-${option.key}`}
                                type="button"
                                onClick={() => {
                                  setActiveActionMessageId(null);
                                  onReact?.(
                                    message,
                                    myReaction === option.key
                                      ? undefined
                                      : option.key,
                                  );
                                }}
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-base transition-transform duration-150 hover:scale-110 ${
                                  myReaction === option.key
                                    ? "bg-blue-50 ring-1 ring-blue-200"
                                    : "hover:bg-slate-100"
                                }`}
                                aria-label={`React ${option.label}`}
                                title={option.label}
                              >
                                {option.emoji}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.45)]">
                            <button
                              type="button"
                              onClick={() => onReply?.(message)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Reply className="h-3.5 w-3.5" />
                              Trả lời
                            </button>
                            {isOwn && (
                              <button
                                type="button"
                                onClick={() => onRecall?.(message)}
                                className="rounded-lg px-2 py-1 transition hover:bg-amber-50 hover:text-amber-600"
                              >
                                Thu hồi
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMessageId(null);
                                onDelete?.(message);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Xóa
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-xs mt-1 text-slate-400">
                        <span>{formatTime(message.created_at)}</span>
                        {isOwn && (
                          <>
                            {readStatus === "sent" && (
                              <Check className="w-3 h-3" />
                            )}
                            {readStatus === "delivered" && (
                              <CheckCheck className="w-3 h-3" />
                            )}
                            {readStatus === "read" && (
                              <CheckCheck className="w-3 h-3 text-blue-400" />
                            )}
                          </>
                        )}
                        {readReceiptLabel && (
                          <span className="ml-1 text-[11px] text-blue-500">
                            {readReceiptLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })}
          <div ref={messagesEndRef} />
        </>
      )}

      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {previewMedia.name}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={`${previewMedia.url}&download=1&name=${encodeURIComponent(previewMedia.name)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white"
                >
                  Tải xuống
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewMedia(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700"
                >
                  Đóng
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-56px)] flex items-center justify-center bg-slate-50">
              {previewMedia.kind === "image" ? (
                <img
                  src={previewMedia.url}
                  alt={previewMedia.name}
                  className="max-w-full max-h-[75vh] object-contain"
                />
              ) : (
                <video
                  src={previewMedia.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[75vh] object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
