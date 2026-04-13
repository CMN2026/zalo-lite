"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../lib/api";

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
  return localStorage.getItem("token") ?? "";
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

export default function ChatbotView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
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
      setLoadingMsgs(false);
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

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text: string, targetConvId?: string | null) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setSending(true);
      setBotTyping(true);
      setSendError(null);

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

      try {
        const convId = targetConvId === undefined ? activeId : targetConvId;
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
    [activeId, sending, postMessage, fetchConversations, fetchMessages],
  );

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
              className={`group flex items-start gap-2 p-3 rounded-xl transition-all ${
                isActive ? "bg-blue-600" : "hover:bg-white"
              }`}
            >
              <button
                type="button"
                className="flex-1 min-w-0 text-left"
                onClick={() => handleSelectConv(conv.conversationId)}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <p
                    className={`text-xs font-semibold truncate ${
                      isActive ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {getConversationTitle(conv)}
                  </p>
                  <span
                    className={`text-[10px] shrink-0 ${
                      isActive ? "text-blue-200" : "text-slate-400"
                    }`}
                  >
                    {formatTime(conv.lastMessageAt)}
                  </span>
                </div>
                <p
                  className={`text-[11px] truncate mt-0.5 ${
                    isActive ? "text-blue-200" : "text-slate-400"
                  }`}
                >
                  {getLastPreview(conv)}
                </p>
                <span
                  className={`inline-flex mt-1.5 items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : statusBadgeClass(conv.status)
                  }`}
                >
                  {statusLabel(conv.status)}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteConv(conv.conversationId, e)}
                className={`opacity-0 group-hover:opacity-100 shrink-0 text-[11px] px-1.5 py-0.5 rounded transition-all ${
                  isActive
                    ? "text-blue-200 hover:text-white"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="Xóa"
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
              className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-full shrink-0 bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {isBot ? "AI" : "NV"}
                </div>
              )}

              <div
                className={`max-w-sm flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                {!isUser && (
                  <span className="text-[10px] text-slate-400 mb-0.5 ml-1">
                    {isBot ? "Trợ lý AI" : (msg.senderName ?? "Nhân viên")}
                  </span>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed wrap-break-word ${
                    isUser
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm"
                  }`}
                  style={{ whiteSpace: "pre-line" }}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  {formatTime(msg.createdAt)}
                </span>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-full shrink-0 bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">
                  TÔI
                </div>
              )}
            </div>
          );
        })}

        {botTyping && (
          <div className="flex items-end gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              AI
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
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
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {getConversationTitle(activeConv)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(activeConv.status)}`}
                >
                  {statusLabel(activeConv.status)}
                </span>
                <span className="text-[11px] text-slate-400">
                  {messages.length} tin nhắn
                </span>
              </div>
            </div>
            {!isResolved && (
              <button
                onClick={handleCloseConv}
                className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Đóng hội thoại
              </button>
            )}
          </div>
        )}

        {/* Escalation notice */}
        {needsStaff && (
          <div className="shrink-0 mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-800">
              Đang chuyển đến nhân viên hỗ trợ
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              Nhân viên sẽ phản hồi sớm nhất có thể. Bạn vẫn có thể tiếp tục
              nhắn tin.
            </p>
          </div>
        )}

        {/* Resolved notice */}
        {isResolved && (
          <div className="shrink-0 mx-4 mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800">
                Cuộc trò chuyện đã được xử lý
              </p>
              <p className="text-[11px] text-emerald-600">
                Cảm ơn bạn đã liên hệ.
              </p>
            </div>
            <button
              onClick={handleNewConv}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Cuộc trò chuyện mới
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
