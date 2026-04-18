import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../contexts/auth";
import { useSocket } from "../../hooks/useSocket";
import { getAuthToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";

// ── Types ────────────────────────────────────────────────────────────────────
interface FileAttachment {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  type: "text" | "file" | "system";
  content: string;
  created_at: string;
  recalled_at?: string | null;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  preview: string;
  time: string;
  online: boolean;
  type?: "direct" | "group";
  peerId?: string;
  unread: number;
}

const SYSTEM_GREETING = "Hai bạn đã trở thành bạn bè. Hãy gửi lời chào 👋";

// ── Helpers ──────────────────────────────────────────────────────────────────
async function authFetch(path: string, init: RequestInit = {}) {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
      ...(init.headers as object ?? {}),
    },
  });
  if (!response.ok) throw new Error(`http_${response.status}`);
  return response.json();
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Hôm qua";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

/** Parse message content — may be plain text or JSON with a `file` attachment */
function parseMessageContent(content: string): { text: string; file: FileAttachment | null } {
  if (!content || !content.trim().startsWith("{")) {
    return { text: content, file: null };
  }
  try {
    const parsed = JSON.parse(content) as { text?: string; file?: FileAttachment };
    return {
      text: parsed.text ?? "",
      file: parsed.file ?? null,
    };
  } catch {
    return { text: content, file: null };
  }
}

function buildFileUrl(path: string, token?: string | null): string {
  if (path.startsWith("http")) {
    // already absolute — just append token if needed
    const url = token ? `${path}?token=${encodeURIComponent(token)}` : path;
    return url;
  }
  // path = /uploads/{id}/{filename} → /api/uploads/{id}/{filename}
  const suffix = path.replace(/^\/uploads/, "");
  const base = `${API_BASE_URL}/api/uploads${suffix}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

// ── Image Viewer Modal ────────────────────────────────────────────────────────
function ImageViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { width, height } = Dimensions.get("window");
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" }}
        activeOpacity={1}
        onPress={onClose}
      >
        <Image
          source={{ uri, headers: { Accept: "image/*" } }}
          style={{ width: width - 16, height: height * 0.7, resizeMode: "contain" }}
        />
        <Text style={{ color: "#94a3b8", marginTop: 12, fontSize: 13 }}>Nhấn để đóng</Text>
      </TouchableOpacity>
    </Modal>
  );
}

// ── File/Image Message Renderer ───────────────────────────────────────────────
function FileMessage({ file, isMe, token }: { file: FileAttachment; isMe: boolean; token?: string | null }) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const url = buildFileUrl(file.path, token);
  const isImage = file.mimetype?.startsWith("image/");

  if (isImage) {
    return (
      <>
        <TouchableOpacity onPress={() => setPreviewUri(url)} activeOpacity={0.85}>
          <Image
            source={{ uri: url }}
            style={{ width: 200, height: 200, borderRadius: 12, resizeMode: "cover" }}
            onError={() => {/* ignore */}}
          />
          <Text style={{ fontSize: 11, marginTop: 4, color: isMe ? "#dbeafe" : "#64748b" }} numberOfLines={1}>
            {file.originalName ?? file.filename}
          </Text>
        </TouchableOpacity>
        {previewUri && <ImageViewer uri={previewUri} onClose={() => setPreviewUri(null)} />}
      </>
    );
  }

  // Non-image file
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontSize: 22 }}>📎</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontSize: 13, fontWeight: "600", color: isMe ? "#fff" : "#1e293b" }}
          numberOfLines={2}
        >
          {file.originalName ?? file.filename}
        </Text>
        <Text style={{ fontSize: 11, color: isMe ? "#dbeafe" : "#94a3b8" }}>
          {file.mimetype} · {Math.round((file.size ?? 0) / 1024)}KB
        </Text>
      </View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatsScreen() {
  const { user } = useAuth();
  const { isConnected, on, off, emit, join, leave } = useSocket();
  const { openConversationId } = useLocalSearchParams<{ openConversationId?: string }>();
  const currentUserId = user?.id ?? "";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  // userId → { fullName, avatarUrl } cache
  const [userCache, setUserCache] = useState<Record<string, { fullName: string; avatarUrl?: string | null }>>({});

  const scrollRef = useRef<ScrollView>(null);
  const openChatRef = useRef<((conv: Conversation) => Promise<void>) | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const activeConv = conversations.find((c) => c.id === activeChatId);

  // ── Load user info (friends + chat-peers) for name resolution ────────────
  const loadUserCache = useCallback(async () => {
    try {
      const token = await getAuthToken();
      setAuthToken(token);
      const [peersRes, friendsRes] = await Promise.allSettled([
        authFetch("/api/users/chat-peers"),
        authFetch("/api/users/friends"),
      ]);

      const cache: Record<string, { fullName: string; avatarUrl?: string | null }> = {};
      const applyUsers = (data: unknown) => {
        if (!Array.isArray(data)) return;
        for (const u of data) {
          if (u?.id && u.fullName) {
            cache[u.id] = { fullName: u.fullName, avatarUrl: u.avatarUrl ?? null };
          }
        }
      };
      if (peersRes.status === "fulfilled") applyUsers(peersRes.value?.data);
      if (friendsRes.status === "fulfilled") applyUsers(friendsRes.value?.data);
      setUserCache(cache);
      return cache;
    } catch {
      return {};
    }
  }, []);

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async (
    autoOpenId?: string,
    existingCache?: Record<string, { fullName: string; avatarUrl?: string | null }>
  ) => {
    try {
      const cache = existingCache ?? userCache;
      const res = await authFetch("/api/conversations");
      const data = (res.data ?? []) as any[];

      const mapped: Conversation[] = data.map((conv: any) => {
        const isGroup = conv.type === "group";
        const peerId = isGroup
          ? undefined
          : (conv.memberIds as string[]).find((id: string) => id !== currentUserId);

        // Resolve name from cache
        const peerInfo = peerId ? cache[peerId] : undefined;
        const resolvedName = isGroup
          ? (conv.name || "Nhóm")
          : (peerInfo?.fullName || conv.name || "Đang tải...");

        const resolvedAvatar = isGroup
          ? "https://api.dicebear.com/7.x/shapes/svg?seed=group"
          : (peerInfo?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${peerId ?? conv.id}`);

        return {
          id: conv.id,
          name: resolvedName,
          avatar: resolvedAvatar,
          preview: conv.lastMessageAt ? "Nhấn để xem tin nhắn" : SYSTEM_GREETING,
          time: conv.lastMessageAt ? formatTime(conv.lastMessageAt) : "",
          online: false,
          type: conv.type ?? "direct",
          peerId,
          unread: 0,
        };
      });

      setConversations(mapped);
      conversationsRef.current = mapped;

      // Auto-open a specific conversation if requested
      const targetId = autoOpenId ?? openConversationId;
      if (targetId) {
        const target = mapped.find((c) => c.id === targetId);
        if (target && openChatRef.current) {
          openChatRef.current(target);
        }
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [currentUserId, openConversationId, userCache]);

  useEffect(() => {
    if (!currentUserId) return;
    // Load user cache first, then conversations (so names resolve on first render)
    loadUserCache().then((cache) => loadConversations(undefined, cache));
  }, [currentUserId]);

  // When openConversationId param arrives (from Friends tab navigation)
  useEffect(() => {
    if (!openConversationId) return;
    const conv = conversationsRef.current.find((c) => c.id === openConversationId);
    if (conv && openChatRef.current) {
      openChatRef.current(conv);
    } else if (currentUserId) {
      loadConversations(openConversationId);
    }
  }, [openConversationId]);

  // ── Open a chat ───────────────────────────────────────────────────────────
  const openChat = useCallback(async (conv: Conversation) => {
    if (activeChatId === conv.id) return;
    if (activeChatId) leave(activeChatId);

    setActiveChatId(conv.id);
    setMessages([]);
    setLoadingMsgs(true);
    join(conv.id);

    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c))
    );

    try {
      const res = await authFetch(`/api/messages/${conv.id}?limit=50`);
      const msgs = (res.data ?? []) as Message[];
      setMessages(msgs.reverse());
    } catch { /* ignore */ } finally {
      setLoadingMsgs(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [activeChatId, join, leave]);

  useEffect(() => { openChatRef.current = openChat; }, [openChat]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !activeChatId || sending) return;

    setSending(true);
    setInputText("");

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: activeChatId,
      sender_id: currentUserId,
      type: "text",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollRef.current?.scrollToEnd({ animated: true });

    try {
      await authFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({ conversation_id: activeChatId, content: text, type: "text" }),
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert("Lỗi", "Không thể gửi tin nhắn. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  }, [inputText, activeChatId, currentUserId, sending]);

  // ── Real-time messages ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (payload: unknown) => {
      const data = payload as any;
      const convId: string = Array.isArray(data.conversation_id) ? data.conversation_id[0] : data.conversation_id;
      if (!convId) return;

      const rawContent = typeof data.content === "object"
        ? JSON.stringify(data.content)
        : (data.content ?? "");

      const newMsg: Message = {
        id: data.message_id ?? data.id ?? `rt-${Date.now()}`,
        conversation_id: convId,
        sender_id: data.sender_id ?? "",
        sender_name: data.sender_name,
        type: data.type ?? "text",
        content: rawContent,
        created_at: data.created_at ?? new Date().toISOString(),
      };

      if (convId === activeChatId) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === newMsg.id);
          if (exists) return prev;
          return [...prev, newMsg];
        });
        scrollRef.current?.scrollToEnd({ animated: true });
      } else {
        if (data.sender_id !== currentUserId) {
          setConversations((prev) =>
            prev.map((c) => c.id === convId ? { ...c, unread: c.unread + 1 } : c)
          );
        }
      }

      // Build preview text (avoid showing JSON)
      const { text, file } = parseMessageContent(rawContent);
      const previewText = file
        ? (file.mimetype?.startsWith("image/") ? "🖼 Hình ảnh" : `📎 ${file.originalName ?? file.filename}`)
        : text;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, preview: previewText || c.preview, time: formatTime(newMsg.created_at) }
            : c
        )
      );
    };

    on("receive_message", handler);
    on("message:receive", handler);
    on("notification:new_message", handler);
    return () => {
      off("receive_message", handler);
      off("message:receive", handler);
      off("notification:new_message", handler);
    };
  }, [activeChatId, currentUserId, on, off]);

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  // ── Message renderer ─────────────────────────────────────────────────────
  function renderMessageContent(msg: Message, isMe: boolean) {
    const isRecalled = Boolean(msg.recalled_at);
    if (isRecalled) {
      return <Text style={{ fontSize: 14, fontStyle: "italic", color: "#94a3b8" }}>Tin nhắn đã được thu hồi</Text>;
    }

    const { text, file } = parseMessageContent(msg.content);

    return (
      <View style={{ gap: 6 }}>
        {file && <FileMessage file={file} isMe={isMe} token={authToken} />}
        {text ? (
          <Text style={{ fontSize: 14, color: isMe ? "#fff" : "#1e293b", lineHeight: 20 }}>
            {text}
          </Text>
        ) : null}
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-white">
      {activeChatId && activeConv ? (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          {/* Chat header */}
          <View className="flex-row items-center px-3 py-2.5 border-b border-slate-200 bg-white">
            <TouchableOpacity onPress={() => { leave(activeChatId); setActiveChatId(null); }} className="p-2 mr-2">
              <Text className="text-blue-600 text-xl">←</Text>
            </TouchableOpacity>
            <Image source={{ uri: activeConv.avatar }} className="w-10 h-10 rounded-full bg-slate-200 mr-3" />
            <View className="flex-1">
              <Text className="font-semibold text-slate-800" numberOfLines={1}>{activeConv.name}</Text>
              <Text className="text-xs text-slate-400">{activeConv.type === "group" ? "Nhóm" : "Trực tiếp"}</Text>
            </View>
          </View>

          {/* Messages */}
          {loadingMsgs ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              className="flex-1 px-4 py-3"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {/* System greeting when no messages yet */}
              {messages.length === 0 && (
                <View className="items-center mt-8 mb-4">
                  <Image source={{ uri: activeConv.avatar }} className="w-20 h-20 rounded-full bg-slate-200 mb-3" />
                  <Text className="font-bold text-slate-800 text-base">{activeConv.name}</Text>
                  <View className="mt-4 bg-slate-100 rounded-2xl px-5 py-3 mx-8">
                    <Text className="text-slate-500 text-sm text-center">{SYSTEM_GREETING}</Text>
                  </View>
                </View>
              )}

              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId;
                const isSystem = msg.type === "system";
                const { text: previewText } = parseMessageContent(msg.content);

                if (isSystem) {
                  return (
                    <View key={msg.id} className="items-center my-3">
                      <View className="bg-slate-100 rounded-full px-4 py-1.5">
                        <Text className="text-slate-500 text-xs">{msg.content}</Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={msg.id} className={`flex-row items-end mb-3 ${isMe ? "justify-end" : "justify-start"}`}>
                    {!isMe && (
                      <Image
                        source={{ uri: userCache[msg.sender_id]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender_id}` }}
                        className="w-8 h-8 rounded-full bg-slate-200 mr-2"
                      />
                    )}
                    <View style={{ maxWidth: "75%", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      {!isMe && (
                        <Text className="text-[10px] text-slate-400 mb-0.5 ml-1">
                          {userCache[msg.sender_id]?.fullName || msg.sender_name || ""}
                        </Text>
                      )}
                      <View
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 18,
                          borderBottomRightRadius: isMe ? 4 : 18,
                          borderBottomLeftRadius: isMe ? 18 : 4,
                          backgroundColor: isMe ? "#2563eb" : "#f1f5f9",
                        }}
                      >
                        {renderMessageContent(msg, isMe)}
                      </View>
                      <Text className="text-[10px] text-slate-400 mt-0.5">
                        {formatTime(msg.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Quick greetings when no messages */}
          {!loadingMsgs && messages.length === 0 && (
            <View className="flex-row flex-wrap gap-2 px-4 pb-2 justify-center">
              {["👋 Xin chào!", "Hi bạn 😊", "Chào mừng bạn bè mới!"].map((greeting) => (
                <TouchableOpacity
                  key={greeting}
                  onPress={() => setInputText(greeting)}
                  className="bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5"
                >
                  <Text className="text-blue-600 text-sm font-medium">{greeting}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Input */}
          <View className="flex-row items-end gap-2 px-4 py-3 border-t border-slate-200 bg-white">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Nhập tin nhắn..."
              multiline
              className="flex-1 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm bg-slate-50"
              style={{ maxHeight: 100 }}
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
              className={`px-4 py-2.5 rounded-2xl ${inputText.trim() && !sending ? "bg-blue-600" : "bg-slate-200"}`}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text className={`font-semibold text-sm ${inputText.trim() ? "text-white" : "text-slate-400"}`}>Gửi</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-200">
            <View className="flex-row items-center gap-3">
              <Image
                source={{ uri: user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}` }}
                className="w-10 h-10 rounded-full bg-slate-200"
              />
              <View>
                <Text className="text-base font-bold text-slate-800">Tin nhắn</Text>
                <Text className="text-xs text-slate-400">{isConnected ? "● Đã kết nối" : "○ Đang kết nối..."}</Text>
              </View>
            </View>
            {totalUnread > 0 && (
              <View className="bg-red-500 rounded-full min-w-[22px] h-[22px] items-center justify-center px-1.5">
                <Text className="text-white text-xs font-bold">{totalUnread}</Text>
              </View>
            )}
          </View>

          <View className="px-4 py-2">
            <View className="bg-slate-100 rounded-xl px-4 py-2 flex-row items-center gap-2">
              <Text className="text-slate-400">🔍</Text>
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Tìm kiếm..."
                className="flex-1 text-sm text-slate-700"
              />
            </View>
          </View>

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="text-slate-400 text-sm mt-3">Đang tải...</Text>
            </View>
          ) : filteredConversations.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-4">
                <Text className="text-4xl">💬</Text>
              </View>
              <Text className="text-slate-600 font-medium">Chưa có cuộc trò chuyện</Text>
              <Text className="text-slate-400 text-xs mt-1">Kết bạn để bắt đầu nhắn tin</Text>
            </View>
          ) : (
            <FlatList
              data={filteredConversations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const { text: previewText, file: previewFile } = parseMessageContent(item.preview);
                const displayPreview = previewFile
                  ? (previewFile.mimetype?.startsWith("image/") ? "🖼 Hình ảnh" : `📎 ${previewFile.originalName}`)
                  : (previewText || item.preview);

                return (
                  <TouchableOpacity
                    onPress={() => openChat(item)}
                    className="flex-row items-center px-4 py-3 border-b border-slate-50"
                  >
                    <View className="relative">
                      <Image source={{ uri: item.avatar }} className="w-14 h-14 rounded-full bg-slate-200" />
                      {item.online && (
                        <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                      )}
                    </View>
                    <View className="flex-1 ml-4">
                      <View className="flex-row justify-between items-center mb-0.5">
                        <Text className="text-base font-semibold text-slate-800" numberOfLines={1}>{item.name}</Text>
                        <Text className="text-xs text-slate-400">{item.time}</Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text
                          className={`text-sm flex-1 mr-3 ${item.unread > 0 ? "text-slate-800 font-medium" : "text-slate-500"}`}
                          numberOfLines={1}
                        >
                          {displayPreview}
                        </Text>
                        {item.unread > 0 && (
                          <View className="bg-red-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1">
                            <Text className="text-white text-xs font-bold">{item.unread}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
