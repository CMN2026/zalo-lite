import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
} from "react-native";
import { API_BASE_URL } from "../../lib/api";
import { getAuthToken } from "../../lib/auth";

// ── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  type?: string;
  senderName?: string;
  createdAt: number | string | Date;
  confidence?: number;
}

interface Conversation {
  conversationId: string;
  title?: string;
  createdAt: number | string | Date;
  messages: ChatMessage[];
  status?: "waiting_response" | "needs_staff" | "resolved" | "active" | "closed";
  userId: string;
  lastMessageAt?: number | string | Date;
}

const QUICK_SUGGESTIONS = [
  { id: "password", label: "Quên mật khẩu", text: "Tôi quên mật khẩu, cần đặt lại" },
  { id: "add_friend", label: "Thêm bạn bè", text: "Tôi muốn biết cách thêm bạn bè" },
  { id: "create_group", label: "Tạo nhóm chat", text: "Tôi cần hỗ trợ tạo nhóm chat" },
  { id: "account", label: "Vấn đề tài khoản", text: "Tài khoản của tôi đang gặp vấn đề" },
  { id: "payment", label: "Thanh toán", text: "Tôi có câu hỏi về phí sử dụng" },
  { id: "staff", label: "Gặp nhân viên", text: "Tôi muốn nói chuyện với nhân viên" },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(date: number | string | Date | undefined): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(s?: Conversation["status"]): string {
  if (s === "needs_staff") return "Cần nhân viên";
  if (s === "resolved" || s === "closed") return "Đã xử lý";
  return "Đang hỗ trợ";
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
  const text = last.content.length > 38 ? `${last.content.slice(0, 38)}…` : last.content;
  return `${prefix}${text}`;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ChatbotScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  const getHeaders = useCallback(async () => {
    const token = await getAuthToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    };
  }, []);

  const fetchConversations = useCallback(async (): Promise<Conversation[] | null> => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API_BASE_URL}/api/chatbot/conversations`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.data as Conversation[]) ?? [];
    } catch { return null; }
  }, [getHeaders]);

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API_BASE_URL}/api/chatbot/conversations/${convId}/history`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.data?.messages ?? []);
    } catch { /* ignore */ } finally { setLoadingMsgs(false); }
  }, [getHeaders]);

  const postMessage = useCallback(async (text: string, convId: string | null): Promise<string | null> => {
    const headers = await getHeaders();
    const body: Record<string, unknown> = { message: text };
    if (convId) body.conversationId = convId;

    const res = await fetch(`${API_BASE_URL}/api/chatbot/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(payload.message ?? `Lỗi ${res.status}`);
    }

    const data = await res.json();
    return (data.data?.conversationId as string) ?? null;
  }, [getHeaders]);

  const handleSend = useCallback(async (text: string, targetConvId?: string | null) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setBotTyping(true);
    setSendError(null);

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
      setSendError(err instanceof Error ? err.message : "Không thể gửi tin nhắn.");
      setMessages((prev) => prev.filter((m) => m.id !== optMsg.id));
    } finally {
      setSending(false);
      setBotTyping(false);
    }
  }, [activeId, sending, postMessage, fetchConversations, fetchMessages]);

  const handleSelectConv = useCallback(async (convId: string) => {
    setActiveId(convId);
    setSendError(null);
    setShowList(false);
    await fetchMessages(convId);
  }, [fetchMessages]);

  const handleNewConv = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setInputValue("");
    setSendError(null);
    setShowList(false);
  }, []);

  const handleDeleteConv = useCallback(async (convId: string) => {
    Alert.alert("Xác nhận", "Xóa cuộc trò chuyện này?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xóa", style: "destructive", onPress: async () => {
          try {
            const headers = await getHeaders();
            const res = await fetch(`${API_BASE_URL}/api/chatbot/conversations/${convId}`, {
              method: "DELETE", headers,
            });
            if (!res.ok) throw new Error("delete_failed");
            setConversations((prev) => prev.filter((c) => c.conversationId !== convId));
            if (activeId === convId) { setActiveId(null); setMessages([]); }
          } catch { Alert.alert("Lỗi", "Không thể xóa. Vui lòng thử lại."); }
        }
      }
    ]);
  }, [activeId, getHeaders]);

  useEffect(() => {
    setLoadingConvs(true);
    fetchConversations().then((convs) => {
      if (convs) {
        setConversations(convs);
        const active = convs.find((c) =>
          ["waiting_response", "needs_staff", "active"].includes(c.status ?? "")
        );
        if (active) { setActiveId(active.conversationId); fetchMessages(active.conversationId); }
      }
      setLoadingConvs(false);
    });
  }, []);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, botTyping]);

  const activeConv = conversations.find((c) => c.conversationId === activeId);
  const isResolved = activeConv?.status === "resolved" || activeConv?.status === "closed";
  const needsStaff = activeConv?.status === "needs_staff";

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <View>
          <Text className="font-bold text-slate-900">Hỗ trợ khách hàng</Text>
          <Text className="text-[11px] text-slate-400">Trả lời 24/7</Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => setShowList(!showList)}
            className="bg-slate-100 px-3 py-1.5 rounded-lg"
          >
            <Text className="text-slate-700 text-xs font-semibold">Lịch sử</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNewConv} className="bg-blue-600 px-3 py-1.5 rounded-lg">
            <Text className="text-white text-xs font-semibold">+ Mới</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Conversation list overlay */}
      {showList && (
        <View className="absolute top-[64px] left-0 right-0 bottom-0 bg-white z-50">
          <View className="px-4 py-3 border-b border-slate-100">
            <Text className="font-bold text-slate-800">Lịch sử trò chuyện</Text>
          </View>
          {loadingConvs ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : conversations.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-slate-400 text-sm">Chưa có cuộc trò chuyện nào</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.conversationId}
              renderItem={({ item }) => {
                const isActive = activeId === item.conversationId;
                return (
                  <TouchableOpacity
                    onPress={() => handleSelectConv(item.conversationId)}
                    className={`px-4 py-3 border-b border-slate-50 flex-row items-center ${isActive ? "bg-blue-50" : ""}`}
                  >
                    <View className="flex-1">
                      <Text className={`text-sm font-semibold ${isActive ? "text-blue-700" : "text-slate-800"}`} numberOfLines={1}>
                        {getConversationTitle(item)}
                      </Text>
                      <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>{getLastPreview(item)}</Text>
                      <View className={`mt-1 self-start px-2 py-0.5 rounded-full ${item.status === "needs_staff" ? "bg-amber-100" : item.status === "resolved" || item.status === "closed" ? "bg-emerald-100" : "bg-sky-100"}`}>
                        <Text className={`text-[10px] font-medium ${item.status === "needs_staff" ? "text-amber-700" : item.status === "resolved" || item.status === "closed" ? "text-emerald-700" : "text-sky-700"}`}>
                          {statusLabel(item.status)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteConv(item.conversationId)}
                      className="p-2 ml-2"
                    >
                      <Text className="text-slate-400 text-lg">✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        {/* Status notices */}
        {needsStaff && (
          <View className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <Text className="text-xs font-semibold text-amber-800">Đang chuyển đến nhân viên hỗ trợ</Text>
            <Text className="text-[11px] text-amber-600 mt-0.5">Bạn vẫn có thể tiếp tục nhắn tin.</Text>
          </View>
        )}
        {isResolved && (
          <View className="mx-4 mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-semibold text-emerald-800">Cuộc trò chuyện đã được xử lý</Text>
              <Text className="text-[11px] text-emerald-600">Cảm ơn bạn đã liên hệ.</Text>
            </View>
            <TouchableOpacity onPress={handleNewConv} className="bg-emerald-100 px-3 py-1.5 rounded-lg">
              <Text className="text-emerald-700 text-xs font-semibold">Cuộc mới</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Messages area */}
        {activeId === null ? (
          /* Welcome / Quick suggestions */
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
            <View className="w-14 h-14 rounded-2xl bg-blue-600 items-center justify-center mb-4">
              <Text className="text-white text-2xl">💬</Text>
            </View>
            <Text className="text-2xl font-bold text-slate-900 mb-1">Xin chào!</Text>
            <Text className="text-slate-500 text-sm mb-7 text-center">
              Tôi là trợ lý hỗ trợ khách hàng của Zalo-Lite.{"\n"}Bạn đang gặp vấn đề gì?
            </Text>
            <View className="w-full">
              {[0, 2, 4].map((i) => (
                <View key={i} className="flex-row gap-3 mb-3">
                  {QUICK_SUGGESTIONS.slice(i, i + 2).map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => handleSend(s.text, null)}
                      disabled={sending}
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3"
                    >
                      <Text className="text-sm font-medium text-slate-700">{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        ) : loadingMsgs ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-4 py-4"
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg) => {
              const isUser = msg.senderId !== "chatbot";
              return (
                <View key={msg.id} className={`flex-row items-end mb-4 ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser && (
                    <View className="w-7 h-7 rounded-full bg-blue-600 items-center justify-center mr-2 mb-1">
                      <Text className="text-white text-[10px] font-bold">AI</Text>
                    </View>
                  )}
                  <View className={`max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
                    {!isUser && (
                      <Text className="text-[10px] text-slate-400 mb-0.5 ml-1">Trợ lý AI</Text>
                    )}
                    <View className={`px-4 py-2.5 rounded-2xl ${isUser ? "bg-blue-600 rounded-br-sm" : "bg-slate-100 rounded-bl-sm"}`}>
                      <Text className={`text-sm leading-relaxed ${isUser ? "text-white" : "text-slate-800"}`}>
                        {msg.content}
                      </Text>
                    </View>
                    <Text className="text-[10px] text-slate-400 mt-0.5">{formatTime(msg.createdAt)}</Text>
                  </View>
                  {isUser && (
                    <View className="w-7 h-7 rounded-full bg-slate-200 items-center justify-center ml-2 mb-1">
                      <Text className="text-slate-500 text-[10px] font-bold">TÔI</Text>
                    </View>
                  )}
                </View>
              );
            })}

            {botTyping && (
              <View className="flex-row items-end justify-start mb-4">
                <View className="w-7 h-7 rounded-full bg-blue-600 items-center justify-center mr-2">
                  <Text className="text-white text-[10px] font-bold">AI</Text>
                </View>
                <View className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex-row gap-1.5">
                  <View className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  <View className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  <View className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Input bar */}
        <View className="border-t border-slate-200 bg-white px-4 py-3">
          {sendError && <Text className="text-xs text-red-500 mb-2">{sendError}</Text>}
          {isResolved ? (
            <View className="flex-row items-center justify-center gap-2 py-2">
              <Text className="text-sm text-slate-400">Cuộc trò chuyện đã kết thúc.</Text>
              <TouchableOpacity onPress={handleNewConv}>
                <Text className="text-blue-600 font-semibold text-sm">Bắt đầu mới</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-2 items-end">
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder={activeId ? "Nhập tin nhắn..." : "Nhập câu hỏi để bắt đầu..."}
                editable={!sending}
                multiline
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white"
                style={{ maxHeight: 100 }}
              />
              <TouchableOpacity
                onPress={() => handleSend(inputValue, activeId ?? null)}
                disabled={!inputValue.trim() || sending}
                className={`bg-blue-600 px-4 py-2.5 rounded-xl ${(!inputValue.trim() || sending) ? "bg-slate-200" : ""}`}
              >
                <Text className={`font-semibold text-sm ${(!inputValue.trim() || sending) ? "text-slate-400" : "text-white"}`}>
                  {sending ? "..." : "Gửi"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
