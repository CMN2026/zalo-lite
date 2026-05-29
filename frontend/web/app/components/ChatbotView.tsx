"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { API_BASE_URL } from "../lib/api";
import type { AppLanguage } from "./SettingsView";

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

function formatTime(date: DateValue | undefined, language: AppLanguage): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(language === "en" ? "en-US" : "vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(
  s: Conversation["status"] | undefined,
  labels: { needsStaff: string; resolved: string; active: string },
): string {
  if (s === "needs_staff") return labels.needsStaff;
  if (s === "resolved" || s === "closed") return labels.resolved;
  return labels.active;
}

function statusBadgeClass(s?: Conversation["status"]): string {
  if (s === "needs_staff") return "bg-amber-100 text-amber-700";
  if (s === "resolved" || s === "closed")
    return "bg-emerald-100 text-emerald-700";
  return "bg-sky-100 text-sky-700";
}

function getConversationTitle(conv: Conversation, defaultTitle: string): string {
  if (conv.title?.trim()) return conv.title;
  const firstUser = conv.messages?.find((m) => m.senderId !== "chatbot");
  if (!firstUser?.content) return defaultTitle;
  const t = firstUser.content;
  return t.length > 32 ? `${t.slice(0, 32)}…` : t;
}

function getLastPreview(
  conv: Conversation,
  labels: { noMessages: string; botPrefix: string; youPrefix: string },
): string {
  if (!conv.messages?.length) return labels.noMessages;
  const last = conv.messages.at(-1);
  if (!last) return labels.noMessages;
  const prefix = last.senderId === "chatbot" ? labels.botPrefix : labels.youPrefix;
  const text =
    last.content.length > 38 ? `${last.content.slice(0, 38)}…` : last.content;
  return `${prefix}${text}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ChatbotView({
  language = "vi",
}: Readonly<{ language?: AppLanguage }>) {
  const t =
    language === "en"
      ? {
          loading: "Loading...",
          noConversations: "No conversations yet",
          noMessages: "No messages yet",
          customerSupport: "Customer Support",
          reply247: "Reply 24/7",
          newConversation: "New conversation",
          deleteTitle: "Delete",
          deleteConfirm: "Delete this conversation?",
          deleteFail: "Cannot delete. Please try again.",
          closeConfirm: "Mark this conversation as resolved?",
          hello: "Hello!",
          intro: "I am Zalo-Lite customer support assistant.",
          intro2: "What can I help you with? Choose a suggestion or type below.",
          typeToStart: "Or type your question below to start",
          loadingMessages: "Loading messages...",
          aiAssistant: "AI Assistant",
          staff: "Staff",
          me: "ME",
          messageCount: "messages",
          closeConversation: "Close conversation",
          escalating: "Escalating to support staff",
          escalatingHint: "A staff member will reply as soon as possible.",
          resolvedTitle: "Conversation has been resolved",
          thanks: "Thank you for contacting us.",
          conversationEnded: "Conversation ended.",
          startNew: "Start new",
          inputPlaceholder: "Type a message...",
          questionPlaceholder: "Type your question to start...",
          send: "Send",
          sendFail: "Unable to send message.",
          statusNeedsStaff: "Needs staff",
          statusResolved: "Resolved",
          statusActive: "In support",
          suggestionPassword: "Forgot password",
          suggestionAddFriend: "Add friends",
          suggestionGroup: "Create group",
          suggestionAccount: "Account issue",
          suggestionPayment: "Payment",
          suggestionStaff: "Talk to staff",
          suggestionTextPassword: "I forgot my password and need to reset it",
          suggestionTextAddFriend: "How can I add friends?",
          suggestionTextGroup: "I need help creating a group chat",
          suggestionTextAccount: "I have an issue with my account",
          suggestionTextPayment: "I have a question about usage fees",
          suggestionTextStaff: "I want to talk to support staff",
          botPrefix: "Bot: ",
          youPrefix: "You: ",
        }
      : {
          loading: "Đang tải...",
          noConversations: "Chưa có cuộc trò chuyện nào",
          noMessages: "Chưa có tin nhắn",
          customerSupport: "Hỗ trợ khách hàng",
          reply247: "Trả lời 24/7",
          newConversation: "Cuộc trò chuyện mới",
          deleteTitle: "Xóa",
          deleteConfirm: "Xóa cuộc trò chuyện này?",
          deleteFail: "Không thể xóa. Vui lòng thử lại.",
          closeConfirm: "Đánh dấu cuộc trò chuyện là đã xử lý?",
          hello: "Xin chào!",
          intro: "Tôi là trợ lý hỗ trợ khách hàng của Zalo-Lite.",
          intro2: "Bạn đang gặp vấn đề gì? Hãy chọn hoặc nhập câu hỏi bên dưới.",
          typeToStart: "Hoặc gõ câu hỏi bên dưới để bắt đầu",
          loadingMessages: "Đang tải tin nhắn...",
          aiAssistant: "Trợ lý AI",
          staff: "Nhân viên",
          me: "TÔI",
          messageCount: "tin nhắn",
          closeConversation: "Đóng hội thoại",
          escalating: "Đang chuyển đến nhân viên hỗ trợ",
          escalatingHint: "Nhân viên sẽ phản hồi sớm nhất có thể.",
          resolvedTitle: "Cuộc trò chuyện đã được xử lý",
          thanks: "Cảm ơn bạn đã liên hệ.",
          conversationEnded: "Cuộc trò chuyện đã kết thúc.",
          startNew: "Bắt đầu mới",
          inputPlaceholder: "Nhập tin nhắn...",
          questionPlaceholder: "Nhập câu hỏi để bắt đầu...",
          send: "Gửi",
          sendFail: "Không thể gửi tin nhắn.",
          statusNeedsStaff: "Cần nhân viên",
          statusResolved: "Đã xử lý",
          statusActive: "Đang hỗ trợ",
          suggestionPassword: "Quên mật khẩu",
          suggestionAddFriend: "Thêm bạn bè",
          suggestionGroup: "Tạo nhóm chat",
          suggestionAccount: "Vấn đề tài khoản",
          suggestionPayment: "Thanh toán",
          suggestionStaff: "Gặp nhân viên",
          suggestionTextPassword: "Tôi quên mật khẩu, cần đặt lại",
          suggestionTextAddFriend: "Tôi muốn biết cách thêm bạn bè",
          suggestionTextGroup: "Tôi cần hỗ trợ tạo nhóm chat",
          suggestionTextAccount: "Tài khoản của tôi đang gặp vấn đề",
          suggestionTextPayment: "Tôi có câu hỏi về phí sử dụng",
          suggestionTextStaff: "Tôi muốn nói chuyện với nhân viên",
          botPrefix: "Bot: ",
          youPrefix: "Bạn: ",
        };
  const quickSuggestions = [
    { id: "password", label: t.suggestionPassword, text: t.suggestionTextPassword },
    { id: "add_friend", label: t.suggestionAddFriend, text: t.suggestionTextAddFriend },
    { id: "create_group", label: t.suggestionGroup, text: t.suggestionTextGroup },
    { id: "account", label: t.suggestionAccount, text: t.suggestionTextAccount },
    { id: "payment", label: t.suggestionPayment, text: t.suggestionTextPayment },
    { id: "staff", label: t.suggestionStaff, text: t.suggestionTextStaff },
  ] as const;
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
        throw new Error(payload.message ?? `Error ${res.status}`);
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
          err instanceof Error ? err.message : t.sendFail,
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
      if (!confirm(t.deleteConfirm)) return;
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
        alert(t.deleteFail);
      }
    },
    [activeId],
  );

  const handleCloseConv = useCallback(async () => {
    if (!activeId || !confirm(t.closeConfirm)) return;
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
      <div className="p-6 text-center text-sm text-slate-400">{t.loading}</div>
    );
  } else if (conversations.length === 0) {
    conversationListContent = (
      <div className="p-6 text-center text-sm text-slate-400">
        {t.noConversations}
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
                    {getConversationTitle(conv, t.customerSupport)}
                  </p>
                  <span
                    className={`text-[10px] shrink-0 ${
                      isActive ? "text-blue-200" : "text-slate-400"
                    }`}
                  >
                  {formatTime(conv.lastMessageAt, language)}
                  </span>
                </div>
                <p
                  className={`text-[11px] truncate mt-0.5 ${
                    isActive ? "text-blue-200" : "text-slate-400"
                  }`}
                >
                  {getLastPreview(conv, { noMessages: t.noMessages, botPrefix: t.botPrefix, youPrefix: t.youPrefix })}
                </p>
                <span
                  className={`inline-flex mt-1.5 items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : statusBadgeClass(conv.status)
                  }`}
                >
                  {statusLabel(conv.status, {
                    needsStaff: t.statusNeedsStaff,
                    resolved: t.statusResolved,
                    active: t.statusActive,
                  })}
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
                title={t.deleteTitle}
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
        <h1 className="text-2xl font-bold text-slate-900 mb-1">{t.hello}</h1>
        <p className="text-slate-500 text-sm mb-7">
          {t.intro}
          <br />
          {t.intro2}
        </p>
        <div className="grid grid-cols-2 gap-3 w-full mb-6">
          {quickSuggestions.map((s) => (
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
          {t.typeToStart}
        </p>
      </div>
    );
  } else if (loadingMsgs) {
    chatContent = (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        {t.loadingMessages}
      </div>
    );
  } else if (messages.length === 0) {
    chatContent = (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        {t.noMessages}
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
                    {isBot ? t.aiAssistant : (msg.senderName ?? t.staff)}
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
                  {formatTime(msg.createdAt, language)}
                </span>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-full shrink-0 bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">
                  {t.me}
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
              {t.customerSupport}
            </p>
            <p className="text-[11px] text-slate-400">{t.reply247}</p>
          </div>
          <button
            onClick={handleNewConv}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            title={t.newConversation}
          >
            + {language === "en" ? "New" : "Mới"}
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
                {getConversationTitle(activeConv, t.customerSupport)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(activeConv.status)}`}
                >
                  {statusLabel(activeConv.status, {
                    needsStaff: t.statusNeedsStaff,
                    resolved: t.statusResolved,
                    active: t.statusActive,
                  })}
                </span>
                <span className="text-[11px] text-slate-400">
                  {messages.length} {t.messageCount}
                </span>
              </div>
            </div>
            {!isResolved && (
              <button
                onClick={handleCloseConv}
                className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {t.closeConversation}
              </button>
            )}
          </div>
        )}

        {/* Escalation notice */}
        {needsStaff && (
          <div className="shrink-0 mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-800">
              {t.escalating}
            </p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              {t.escalatingHint}
            </p>
          </div>
        )}

        {/* Resolved notice */}
        {isResolved && (
          <div className="shrink-0 mx-4 mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-800">
                {t.resolvedTitle}
              </p>
              <p className="text-[11px] text-emerald-600">
                {t.thanks}
              </p>
            </div>
            <button
              onClick={handleNewConv}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              {t.newConversation}
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
              <span>{t.conversationEnded}</span>
              <button
                onClick={handleNewConv}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                {t.startNew}
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
                  activeId ? t.inputPlaceholder : t.questionPlaceholder
                }
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 transition-all"
              />
              <button
                onClick={() => handleSend(inputValue, activeId ?? null)}
                disabled={!inputValue.trim() || sending}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
              >
                {sending ? "..." : t.send}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
