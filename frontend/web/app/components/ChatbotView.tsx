"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import { useAuth } from "../contexts/auth";
import { API_BASE_URL } from "../lib/api";
import { getAuthToken } from "../lib/auth";
import { WEB_CHATBOT_SERVICE_BASE_URL } from "../lib/runtime-base-url";

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  type?: string;
  senderName?: string;
  createdAt: DateValue;
  confidence?: number;
  isStreaming?: boolean;
  streamStatus?: "streaming" | "done" | "error";
}

type DateValue = number | string | Date;

interface Conversation {
  conversationId: string;
  title?: string;
  createdAt: DateValue;
  messages: ChatMessage[];
  status?:
    | "waiting_response"
    | "needs_staff"
    | "resolved"
    | "active"
    | "closed";
  userId: string;
  escalatedToAdmin?: boolean;
  lastMessageAt?: DateValue;
}

// ============================================================================
// QUICK SUGGESTIONS
// ============================================================================

const QUICK_SUGGESTIONS = [
  {
    id: "password",
    label: "Quên mật khẩu",
    text: "Tôi quên mật khẩu, cần đặt lại",
  },
  {
    id: "add_friend",
    label: "Thêm bạn bè",
    text: "Tôi muốn biết cách thêm bạn bè",
  },
  {
    id: "create_group",
    label: "Tạo nhóm chat",
    text: "Tôi cần hỗ trợ tạo nhóm chat",
  },
  {
    id: "account",
    label: "Vấn đề tài khoản",
    text: "Tài khoản của tôi đang gặp vấn đề",
  },
  { id: "payment", label: "Thanh toán", text: "Tôi có câu hỏi về phí sử dụng" },
  {
    id: "staff",
    label: "Gặp nhân viên",
    text: "Tôi muốn nói chuyện với nhân viên",
  },
] as const;

// ============================================================================
// HELPERS
// ============================================================================

function getToken(): string {
  if (globalThis.window === undefined) return "";
  return getAuthToken() ?? "";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

function formatTime(date: DateValue | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(s?: Conversation["status"]): string {
  if (s === "needs_staff") return "Cần nhân viên";
  if (s === "resolved" || s === "closed") return "Đã xử lý";
  return "Đang hỗ trợ";
}

function statusBadgeClass(s?: Conversation["status"]): string {
  if (s === "needs_staff") return "bg-amber-100 text-amber-700";
  if (s === "resolved" || s === "closed")
    return "bg-emerald-100 text-emerald-700";
  return "bg-sky-100 text-sky-700";
}

function getConversationTitle(conv: Conversation): string {
  if (conv.title?.trim()) return conv.title;
  const firstUser = conv.messages?.find((m) => m.senderId !== "chatbot");
  if (!firstUser?.content) return "Hỗ trợ khách hàng";
  const t = firstUser.content;
  return t.length > 32 ? `${t.slice(0, 32)}…` : t;
}

function getLastPreview(conv: Conversation): string {
  if (!conv.messages?.length) return "Chưa có tin nhắn";
  const last = conv.messages.at(-1);
  if (!last) return "Chưa có tin nhắn";
  const prefix = last.senderId === "chatbot" ? "Bot: " : "Bạn: ";
  const text =
    last.content.length > 38 ? `${last.content.slice(0, 38)}…` : last.content;
  return `${prefix}${text}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ChatbotView({ language }: { language?: any }) {
  const streamingEnabled =
    process.env.NEXT_PUBLIC_CHATBOT_STREAMING === "true";
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatbotSocketRef = useRef<Socket | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const streamingConversationIdRef = useRef<string | null>(null);
  const streamedTextRef = useRef<string>("");
  const isStreamingRef = useRef(false);

  // ─── API ──────────────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async (): Promise<
    Conversation[] | null
  > => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chatbot/conversations`, {
        headers: authHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.data as Conversation[]) ?? [];
    } catch {
      return null;
    }
  }, []);

  const fetchMessages = useCallback(async (convId: string, showLoading = true) => {
    if (showLoading) setLoadingMsgs(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/chatbot/conversations/${convId}/history`,
        { headers: authHeaders() },
      );
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.data?.messages ?? []);
    } catch {
      /* ignore */
    } finally {
      if (showLoading) setLoadingMsgs(false);
    }
  }, []);

  const postMessage = useCallback(
    async (text: string, convId: string | null): Promise<string | null> => {
      const body: Record<string, unknown> = { message: text };
      if (convId) body.conversationId = convId;

      const res = await fetch(`${API_BASE_URL}/api/chatbot/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(payload.message ?? `Lỗi ${res.status}`);
      }

      const data = await res.json();
      return (data.data?.conversationId as string) ?? null;
    },
    [],
  );

  const resetStreamingState = useCallback(() => {
    streamingMessageIdRef.current = null;
    streamingConversationIdRef.current = null;
    streamedTextRef.current = "";
    isStreamingRef.current = false;
    setBotTyping(false);
    setSending(false);
  }, []);

  const updateStreamingMessage = useCallback(
    (nextText: string, status?: ChatMessage["streamStatus"]) => {
      const messageId = streamingMessageIdRef.current;
      if (!messageId) return;

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: nextText,
                isStreaming: status === "streaming",
                streamStatus: status ?? message.streamStatus,
              }
            : message,
        ),
      );
    },
    [],
  );

  const appendStreamingChunk = useCallback(
    (chunk: string) => {
      if (!isStreamingRef.current || !chunk) return;

      const previous = streamedTextRef.current;
      if (previous.endsWith(chunk)) return;

      const next = `${previous}${chunk}`;
      streamedTextRef.current = next;
      updateStreamingMessage(next, "streaming");
    },
    [updateStreamingMessage],
  );

  const finalizeStreamingMessage = useCallback(
    (payload?: { conversationId?: string; message?: ChatMessage }) => {
      const messageId = streamingMessageIdRef.current;
      if (!messageId) return;

      const finalContent = payload?.message?.content ?? streamedTextRef.current;
      const finalMessage: ChatMessage = payload?.message
        ? {
            ...payload.message,
            id: payload.message.id,
            content: finalContent,
            isStreaming: false,
            streamStatus: "done",
          }
        : {
            id: messageId,
            content: finalContent,
            senderId: "chatbot",
            type: "system",
            createdAt: Date.now(),
            isStreaming: false,
            streamStatus: "done",
          };

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? finalMessage : message,
        ),
      );

      const resolvedConversationId =
        payload?.conversationId ??
        streamingConversationIdRef.current ??
        activeId;
      resetStreamingState();

      if (resolvedConversationId && !activeId) {
        setActiveId(resolvedConversationId);
      }

      if (resolvedConversationId) {
        void fetchMessages(resolvedConversationId, false);
      }
      void fetchConversations().then((fresh) => {
        if (fresh) setConversations(fresh);
      });
    },
    [activeId, fetchConversations, fetchMessages, resetStreamingState],
  );

  const markStreamingError = useCallback(
    (message: string) => {
      const messageId = streamingMessageIdRef.current;
      if (messageId) {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === messageId
              ? { ...item, streamStatus: "error", isStreaming: false }
              : item,
          ),
        );
      }
      setSendError(message);
      resetStreamingState();
    },
    [resetStreamingState],
  );

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string, targetConvId?: string | null) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setSending(true);
      setBotTyping(true);
      setSendError(null);
      const convId = targetConvId === undefined ? activeId : targetConvId;

      // Optimistic user message
      const optMsg: ChatMessage = {
        id: `opt-${Date.now()}`,
        content: trimmed,
        senderId: "me",
        type: "user",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, optMsg]);
      setInputValue("");

      const canStream =
        streamingEnabled &&
        Boolean(socketConnected && chatbotSocketRef.current?.connected && user);
      if (canStream) {
        const streamMessageId = `stream-${Date.now()}`;
        streamingMessageIdRef.current = streamMessageId;
        streamingConversationIdRef.current = convId ?? null;
        streamedTextRef.current = "";
        isStreamingRef.current = true;

        setMessages((prev) => [
          ...prev,
          {
            id: streamMessageId,
            content: "",
            senderId: "chatbot",
            type: "system",
            createdAt: Date.now(),
            isStreaming: true,
            streamStatus: "streaming",
          },
        ]);

        const socket = chatbotSocketRef.current;
        if (socket && user) {
          socket.emit("send_message_stream", {
            userId: user.id,
            message: trimmed,
            conversationId: convId ?? undefined,
          });
        }

        return;
      }

      try {
        const resultConvId = await postMessage(trimmed, convId);

        const resolvedConvId = resultConvId ?? convId;
        if (resolvedConvId && !activeId) setActiveId(resolvedConvId);

        const freshConvs = await fetchConversations();
        if (freshConvs) setConversations(freshConvs);

        if (resolvedConvId) await fetchMessages(resolvedConvId);
      } catch (err) {
        setSendError(
          err instanceof Error ? err.message : "Không thể gửi tin nhắn.",
        );
        setMessages((prev) => prev.filter((m) => m.id !== optMsg.id));
      } finally {
        setSending(false);
        setBotTyping(false);
        inputRef.current?.focus();
      }
    },
    [
      activeId,
      sending,
      postMessage,
      fetchConversations,
      fetchMessages,
      socketConnected,
      user,
    ],
  );

  const handleCancelStreaming = useCallback(() => {
    if (chatbotSocketRef.current && isStreamingRef.current) {
      chatbotSocketRef.current.emit("chatbot:ai:cancel", {
        conversationId: streamingConversationIdRef.current ?? activeId,
      });
    }

    if (streamingMessageIdRef.current) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === streamingMessageIdRef.current
            ? { ...message, isStreaming: false, streamStatus: "error" }
            : message,
        ),
      );
    }

    resetStreamingState();
    setSendError("Đã hủy tạo phản hồi.");
  }, [activeId, resetStreamingState]);

  const handleSelectConv = useCallback(
    async (convId: string) => {
      setActiveId(convId);
      setSendError(null);
      await fetchMessages(convId);
    },
    [fetchMessages],
  );

  const handleNewConv = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setInputValue("");
    setSendError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleDeleteConv = useCallback(
    async (convId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Xóa cuộc trò chuyện này?")) return;
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/chatbot/conversations/${convId}`,
          { method: "DELETE", headers: authHeaders() },
        );
        if (!res.ok) throw new Error("delete_failed");
        setConversations((prev) =>
          prev.filter((c) => c.conversationId !== convId),
        );
        if (activeId === convId) {
          setActiveId(null);
          setMessages([]);
        }
      } catch {
        alert("Không thể xóa. Vui lòng thử lại.");
      }
    },
    [activeId],
  );

  const handleCloseConv = useCallback(async () => {
    if (!activeId || !confirm("Đánh dấu cuộc trò chuyện là đã xử lý?")) return;
    try {
      await fetch(
        `${API_BASE_URL}/api/chatbot/conversations/${activeId}/close`,
        {
          method: "POST",
          headers: authHeaders(),
        },
      );
      const freshConvs = await fetchConversations();
      if (freshConvs) setConversations(freshConvs);
      await fetchMessages(activeId);
    } catch {
      /* ignore */
    }
  }, [activeId, fetchConversations, fetchMessages]);

  useEffect(() => {
    if (!streamingEnabled) {
      chatbotSocketRef.current?.disconnect();
      chatbotSocketRef.current = null;
      setSocketConnected(false);
      return;
    }

    if (!user) {
      chatbotSocketRef.current?.disconnect();
      chatbotSocketRef.current = null;
      setSocketConnected(false);
      return;
    }

    const token = getToken();
    if (!token) return;

    const socket: Socket = io(WEB_CHATBOT_SERVICE_BASE_URL, {
      path: "/socket.io/",
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ["polling", "websocket"],
      timeout: 6000,
    });

    chatbotSocketRef.current = socket;

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    const onChunk = (payload: { conversationId?: string; chunk?: string }) => {
      if (!isStreamingRef.current) return;
      if (
        payload.conversationId &&
        streamingConversationIdRef.current &&
        payload.conversationId !== streamingConversationIdRef.current
      )
        return;
      appendStreamingChunk(payload.chunk ?? "");
    };
    const onDone = (payload: {
      conversationId?: string;
      message?: ChatMessage;
    }) => {
      if (!isStreamingRef.current) return;
      if (
        payload.conversationId &&
        streamingConversationIdRef.current &&
        payload.conversationId !== streamingConversationIdRef.current
      )
        return;
      finalizeStreamingMessage(payload);
    };
    const onError = (payload: {
      conversationId?: string;
      message?: string;
    }) => {
      if (!isStreamingRef.current) return;
      if (
        payload.conversationId &&
        streamingConversationIdRef.current &&
        payload.conversationId !== streamingConversationIdRef.current
      )
        return;
      markStreamingError(
        payload.message ?? "Không thể tạo phản hồi. Vui lòng thử lại.",
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chatbot:ai:chunk", onChunk);
    socket.on("chatbot:ai:done", onDone);
    socket.on("chatbot:ai:error", onError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chatbot:ai:chunk", onChunk);
      socket.off("chatbot:ai:done", onDone);
      socket.off("chatbot:ai:error", onError);
      socket.disconnect();
      if (chatbotSocketRef.current === socket) {
        chatbotSocketRef.current = null;
      }
      setSocketConnected(false);
    };
  }, [
    appendStreamingChunk,
    finalizeStreamingMessage,
    markStreamingError,
    streamingEnabled,
    user,
  ]);

  // ─── LIFECYCLE ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoadingConvs(true);
    fetchConversations().then((convs) => {
      if (convs) {
        setConversations(convs);
        const active = convs.find((c) =>
          ["waiting_response", "needs_staff", "active"].includes(
            c.status ?? "",
          ),
        );
        if (active) {
          setActiveId(active.conversationId);
          fetchMessages(active.conversationId);
        }
      }
      setLoadingConvs(false);
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: isStreamingRef.current ? "auto" : "smooth",
    });
  }, [messages, botTyping]);

  const activeConv = conversations.find((c) => c.conversationId === activeId);
  const isResolved =
    activeConv?.status === "resolved" || activeConv?.status === "closed";
  const needsStaff = activeConv?.status === "needs_staff";

  let conversationListContent: React.ReactNode;
  if (loadingConvs) {
    conversationListContent = (
      <div className="p-6 text-center text-sm text-slate-400">Đang tải...</div>
    );
  } else if (conversations.length === 0) {
    conversationListContent = (
      <div className="p-6 text-center text-sm text-slate-400">
        Chưa có cuộc trò chuyện nào
      </div>
    );
  } else {
    conversationListContent = (
      <div className="py-2 space-y-0.5 px-2">
        {conversations.map((conv) => {
          const isActive = activeId === conv.conversationId;
          return (
            <div
              key={conv.conversationId}
              className={`group flex items-start gap-2 p-3 transition-all cursor-pointer border-l-2 ${
                isActive ? "bg-blue-50 border-blue-600" : "border-transparent hover:bg-slate-50"
              }`}
              onClick={() => handleSelectConv(conv.conversationId)}
            >
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-baseline justify-between gap-1">
                  <p
                    className={`text-sm font-medium truncate ${
                      isActive ? "text-blue-700" : "text-slate-800"
                    }`}
                  >
                    {getConversationTitle(conv)}
                  </p>
                  <span className="text-[10px] shrink-0 text-slate-400 font-medium">
                    {formatTime(conv.lastMessageAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-1">
                  {getLastPreview(conv)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(
                      conv.status,
                    )}`}
                  >
                    {statusLabel(conv.status)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteConv(conv.conversationId, e);
                }}
                className={`opacity-0 group-hover:opacity-100 shrink-0 text-xs p-1.5 rounded-md transition-all ${
                  isActive
                    ? "text-blue-400 hover:text-blue-600 hover:bg-blue-100"
                    : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                }`}
                title="Xóa cuộc trò chuyện"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  let chatContent: React.ReactNode;
  if (activeId === null) {
    chatContent = (
      <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center py-8">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl mb-4 shadow-md">
          💬
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Xin chào!</h1>
        <p className="text-slate-500 text-sm mb-7">
          Tôi là trợ lý hỗ trợ khách hàng của Zalo-Lite.
          <br />
          Bạn đang gặp vấn đề gì? Hãy chọn hoặc nhập câu hỏi bên dưới.
        </p>
        <div className="grid grid-cols-2 gap-3 w-full mb-6">
          {QUICK_SUGGESTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSend(s.text, null)}
              disabled={sending}
              className="p-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left text-sm font-medium text-slate-700 hover:text-blue-700 transition-all disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Hoặc gõ câu hỏi bên dưới để bắt đầu
        </p>
      </div>
    );
  } else if (loadingMsgs) {
    chatContent = (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Đang tải tin nhắn...
      </div>
    );
  } else if (messages.length === 0) {
    chatContent = (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Chưa có tin nhắn
      </div>
    );
  } else {
    chatContent = (
      <>
        {messages.map((msg) => {
          const isUser = msg.senderId !== "chatbot";
          const isBot = msg.senderId === "chatbot";

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm mb-1">
                  {isBot ? "AI" : "NV"}
                </div>
              )}

              <div
                className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed break-words shadow-sm ${
                    isUser
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                  }`}
                  style={{ whiteSpace: "pre-line" }}
                >
                  {msg.content}
                </div>
                {msg.isStreaming && !isUser && (
                  <span className="mt-1.5 text-xs text-blue-500 font-medium animate-pulse">
                    Đang tạo phản hồi...
                  </span>
                )}
                <span className="text-[11px] text-slate-400 mt-1">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}

        {botTyping && (
          <div className="flex items-end gap-3 justify-start">
            <div className="w-8 h-8 rounded-full shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm mb-1">
              AI
            </div>
            <div className="bg-white border border-slate-200 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3.5 flex items-center gap-1.5 mb-5">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="flex w-full h-full bg-white">
      {/* ─── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-slate-200 flex flex-col bg-slate-50">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">
              Hỗ trợ khách hàng
            </p>
            <p className="text-[11px] text-slate-400">Trả lời 24/7</p>
          </div>
          <button
            onClick={handleNewConv}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            title="Cuộc trò chuyện mới"
          >
            + Mới
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">{conversationListContent}</div>
      </div>

      {/* ─── RIGHT: CHAT AREA ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat header */}
        {activeConv && (
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
            <div>
              <p className="text-[15px] font-bold text-slate-800">
                {getConversationTitle(activeConv)}
              </p>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {messages.length} tin nhắn trong cuộc hội thoại này
              </p>
            </div>
            {!isResolved && (
              <button
                onClick={handleCloseConv}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Kết thúc hỗ trợ
              </button>
            )}
          </div>
        )}

        {/* Escalation notice */}
        {needsStaff && (
          <div className="shrink-0 bg-amber-50 px-6 py-3 flex items-center gap-4 border-b border-amber-100">
            <div className="w-8 h-8 rounded-full bg-amber-200/50 flex items-center justify-center text-amber-600 text-sm">
              ⏳
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">
                Đang chờ nhân viên hỗ trợ
              </p>
              <p className="text-xs text-amber-600/80 mt-0.5 font-medium">
                Nhân viên sẽ phản hồi bạn trong chốc lát. Bạn vẫn có thể tiếp tục nhắn tin.
              </p>
            </div>
          </div>
        )}

        {/* Resolved notice */}
        {isResolved && (
          <div className="shrink-0 bg-emerald-50 px-6 py-4 flex items-center justify-between border-b border-emerald-100">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-200/50 flex items-center justify-center text-emerald-600 text-sm">
                ✓
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-800">
                  Vấn đề đã được giải quyết
                </p>
                <p className="text-xs text-emerald-600/80 mt-0.5 font-medium">
                  Cảm ơn bạn đã liên hệ với đội ngũ hỗ trợ.
                </p>
              </div>
            </div>
            <button
              onClick={handleNewConv}
              className="text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Hội thoại mới
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {chatContent}
        </div>

        {/* ─── INPUT BAR — always visible ───────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
          {sendError && (
            <p className="text-xs text-red-500 mb-2">{sendError}</p>
          )}

          {isResolved ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-slate-400">
              <span>Cuộc trò chuyện đã kết thúc.</span>
              <button
                onClick={handleNewConv}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Bắt đầu mới
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(inputValue, activeId ?? null);
                  }
                }}
                disabled={sending}
                placeholder={
                  activeId ? "Nhập tin nhắn..." : "Nhập câu hỏi để bắt đầu..."
                }
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 transition-all"
              />
              {botTyping && socketConnected && (
                <button
                  onClick={handleCancelStreaming}
                  className="px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium rounded-xl transition-colors shrink-0 border border-amber-200"
                >
                  Hủy
                </button>
              )}
              <button
                onClick={() => handleSend(inputValue, activeId ?? null)}
                disabled={!inputValue.trim() || sending}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
              >
                {sending ? "..." : "Gửi"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
