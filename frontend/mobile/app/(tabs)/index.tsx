import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Dimensions,
  PanResponder,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  recalled_by?: string | null;
  reactions?: MessageReaction[];
}

type MessageReaction = {
  user_id: string;
  reaction: "vui" | "buon" | "phan_no" | "wow";
  created_at: string;
};

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  preview: string;
  time: string;
  lastMessageAt?: string | null;
  online: boolean;
  type?: "direct" | "group";
  peerId?: string;
  unread: number;
}

const SYSTEM_GREETING = "Hai bạn đã trở thành bạn bè. Hãy gửi lời chào 👋";
const REACTION_EMOJI: Record<MessageReaction["reaction"], string> = {
  vui: "😀",
  buon: "😢",
  wow: "😮",
  phan_no: "😡",
};

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

function getMessagePreview(content: string, recalledAt?: string | null): string {
  if (recalledAt) {
    return "Tin nhắn đã được thu hồi";
  }

  const { text, file } = parseMessageContent(content);
  if (file) {
    return file.mimetype?.startsWith("image/")
      ? "🖼 Hình ảnh"
      : `📎 ${file.originalName ?? file.filename}`;
  }

  return text || SYSTEM_GREETING;
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
  const router = useRouter();
  const {
    openConversationId: openConversationIdParam,
    openConversationNonce: openConversationNonceParam,
    showConversationListNonce: showConversationListNonceParam,
  } = useLocalSearchParams<{
    openConversationId?: string | string[];
    openConversationNonce?: string | string[];
    showConversationListNonce?: string | string[];
  }>();
  const openConversationId = Array.isArray(openConversationIdParam)
    ? openConversationIdParam[0]
    : openConversationIdParam;
  const openConversationNonce = Array.isArray(openConversationNonceParam)
    ? openConversationNonceParam[0]
    : openConversationNonceParam;
  const showConversationListNonce = Array.isArray(showConversationListNonceParam)
    ? showConversationListNonceParam[0]
    : showConversationListNonceParam;
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
  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);
  // userId → { fullName, avatarUrl } cache
  const [userCache, setUserCache] = useState<Record<string, { fullName: string; avatarUrl?: string | null }>>({});

  const scrollRef = useRef<ScrollView>(null);
  const openChatRef = useRef<((conv: Conversation) => Promise<void>) | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const pendingAutoOpenConversationIdRef = useRef<string | null>(null);
  const forceOpenConversationIdRef = useRef<string | null>(null);
  const activeConv = conversations.find((c) => c.id === activeChatId);

  const updateConversationPreviewFromMessages = useCallback((conversationId: string, nextMessages: Message[]) => {
    const lastMessage = nextMessages[nextMessages.length - 1];

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              preview: lastMessage
                ? getMessagePreview(lastMessage.content, lastMessage.recalled_at)
                : SYSTEM_GREETING,
              time: lastMessage ? formatTime(lastMessage.created_at) : "",
            }
          : conv,
      ),
    );
  }, []);

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
          preview: conv.lastMessageAt ? "Đang tải..." : SYSTEM_GREETING,
          time: conv.lastMessageAt ? formatTime(conv.lastMessageAt) : "",
          lastMessageAt: conv.lastMessageAt ?? null,
          online: false,
          type: conv.type ?? "direct",
          peerId,
          unread: 0,
        };
      });

      setConversations(mapped);
      conversationsRef.current = mapped;
      void hydrateConversationPreviews(mapped);

      // Auto-open a specific conversation if requested
      const targetId = autoOpenId ?? openConversationId;
      if (targetId) {
        const target = mapped.find((c) => c.id === targetId);
        pendingAutoOpenConversationIdRef.current = targetId;
        if (target && openChatRef.current) {
          pendingAutoOpenConversationIdRef.current = null;
          forceOpenConversationIdRef.current = target.id;
          void openChatRef.current(target);
        }
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [currentUserId, openConversationId, userCache]);

  const hydrateConversationPreviews = useCallback(async (items: Conversation[]) => {
    const targets = items.filter((conv) => conv.lastMessageAt);
    if (targets.length === 0) return;

    const results = await Promise.allSettled(
      targets.map(async (conv) => {
        const response = await authFetch(`/api/messages/${conv.id}?limit=1`);
        const latest = Array.isArray(response.data) ? response.data[0] as Message | undefined : undefined;
        if (!latest) return null;

        return {
          id: conv.id,
          preview: getMessagePreview(latest.content, latest.recalled_at),
          time: formatTime(latest.created_at),
        };
      }),
    );

    const updates = results
      .filter((result): result is PromiseFulfilledResult<{ id: string; preview: string; time: string } | null> => result.status === "fulfilled")
      .map((result) => result.value)
      .filter((value): value is { id: string; preview: string; time: string } => value !== null);

    if (updates.length === 0) return;

    setConversations((prev) =>
      prev.map((conv) => {
        const update = updates.find((item) => item.id === conv.id);
        return update ? { ...conv, preview: update.preview, time: update.time } : conv;
      }),
    );
  }, []);

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
      pendingAutoOpenConversationIdRef.current = null;
      forceOpenConversationIdRef.current = conv.id;
      void openChatRef.current(conv);
    } else if (currentUserId) {
      loadConversations(openConversationId);
    }
  }, [openConversationId, openConversationNonce, currentUserId, loadConversations]);

  useEffect(() => {
    const pendingConversationId = pendingAutoOpenConversationIdRef.current;
    if (!pendingConversationId || !openChatRef.current) {
      return;
    }

    const target = conversationsRef.current.find((c) => c.id === pendingConversationId);
    if (!target) {
      return;
    }

    pendingAutoOpenConversationIdRef.current = null;
    forceOpenConversationIdRef.current = target.id;
    void openChatRef.current(target);
  }, [conversations]);

  // ── Open a chat ───────────────────────────────────────────────────────────
  const openChat = useCallback(async (conv: Conversation) => {
    const shouldForceReload = forceOpenConversationIdRef.current === conv.id;
    forceOpenConversationIdRef.current = null;
    if (activeChatId === conv.id && !shouldForceReload) return;
    if (activeChatId) leave(activeChatId);

    setActiveChatId(conv.id);
    setMessages([]);
    setActiveActionMessageId(null);
    setLoadingMsgs(true);
    join(conv.id);

    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c))
    );

    try {
      let msgs: Message[] = [];

      try {
        const res = await authFetch(`/api/messages/${conv.id}?limit=200`);
        msgs = (res.data ?? []) as Message[];
      } catch {
        // Fallback for environments where message routes are exposed through conversation endpoints.
        const fallback = await authFetch(`/api/conversations/${conv.id}/messages?limit=200`);
        msgs = (fallback.data ?? []) as Message[];
      }

      setMessages(msgs.reverse());
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [activeChatId, join, leave]);

  useEffect(() => { openChatRef.current = openChat; }, [openChat]);

  const closeActiveChat = useCallback(() => {
    if (activeChatId) {
      leave(activeChatId);
    }
    forceOpenConversationIdRef.current = null;
    pendingAutoOpenConversationIdRef.current = null;
    setActiveChatId(null);
    setMessages([]);
    setActiveActionMessageId(null);
    setLoadingMsgs(false);
    setInputText("");
    router.setParams({
      openConversationId: undefined,
      openConversationNonce: undefined,
      showConversationListNonce: undefined,
    });
  }, [activeChatId, leave, router]);

  useEffect(() => {
    if (!showConversationListNonce) {
      return;
    }
    closeActiveChat();
  }, [showConversationListNonce, closeActiveChat]);

  const chatSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (_event, gestureState) => {
          return activeChatId !== null && gestureState.x0 <= 28 && gestureState.y0 > 72;
        },
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          return (
            activeChatId !== null &&
            gestureState.x0 <= 28 &&
            gestureState.y0 > 72 &&
            Math.abs(gestureState.dx) > 12 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2
          );
        },
        onPanResponderRelease: (_event, gestureState) => {
          const shouldClose = gestureState.dx > 70 && Math.abs(gestureState.dy) < 60;
          if (shouldClose) {
            closeActiveChat();
          }
        },
      }),
    [activeChatId, closeActiveChat],
  );

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

  const setMessageReactions = useCallback((messageId: string, reactions: MessageReaction[]) => {
    setMessages((prev) =>
      prev.map((item) => (item.id === messageId ? { ...item, reactions } : item)),
    );
  }, []);

  const markMessageRecalled = useCallback((messageId: string, recalledAt?: string, recalledBy?: string) => {
    if (!activeChatId) return;

    setMessages((prev) => {
      const next = prev.map((item) =>
        item.id === messageId
          ? {
              ...item,
              content: "Tin nhắn đã được thu hồi",
              recalled_at: recalledAt ?? new Date().toISOString(),
              recalled_by: recalledBy ?? currentUserId,
              reactions: [],
            }
          : item,
      );

      updateConversationPreviewFromMessages(activeChatId, next);
      return next;
    });
    setActiveActionMessageId((current) => (current === messageId ? null : current));
  }, [activeChatId, currentUserId, updateConversationPreviewFromMessages]);

  const removeMessageForCurrentUser = useCallback((messageId: string) => {
    if (!activeChatId) return;

    setMessages((prev) => {
      const next = prev.filter((item) => item.id !== messageId);
      updateConversationPreviewFromMessages(activeChatId, next);
      return next;
    });
    setActiveActionMessageId((current) => (current === messageId ? null : current));
  }, [activeChatId, updateConversationPreviewFromMessages]);

  const handleRecallMessage = useCallback(async (message: Message) => {
    if (message.sender_id !== currentUserId) {
      Alert.alert("Không thể thu hồi", "Bạn chỉ có thể thu hồi tin nhắn của chính mình.");
      return;
    }

    try {
      const response = await authFetch(`/api/messages/${message.id}/recall`, {
        method: "PATCH",
      });
      const recalled = response.data as Message | undefined;
      markMessageRecalled(
        message.id,
        recalled?.recalled_at ?? undefined,
        recalled?.recalled_by ?? undefined,
      );
    } catch {
      emit("message:recall", {
        message_id: message.id,
        conversation_id: message.conversation_id,
      });
      markMessageRecalled(message.id);
    }
  }, [currentUserId, emit, markMessageRecalled]);

  const handleDeleteMessage = useCallback(async (message: Message) => {
    try {
      await authFetch(`/api/messages/${message.id}`, { method: "DELETE" });
      removeMessageForCurrentUser(message.id);
    } catch {
      emit("message:delete", {
        message_id: message.id,
        conversation_id: message.conversation_id,
      });
      removeMessageForCurrentUser(message.id);
    }
  }, [emit, removeMessageForCurrentUser]);

  const handleReactMessage = useCallback(async (
    message: Message,
    reaction?: MessageReaction["reaction"],
  ) => {
    try {
      const response = await authFetch(`/api/messages/${message.id}/reaction`, {
        method: "PUT",
        body: JSON.stringify({ reaction }),
      });
      const updated = response.data as Message | undefined;
      setMessageReactions(message.id, updated?.reactions ?? []);
    } catch {
      emit("message:react", {
        message_id: message.id,
        conversation_id: message.conversation_id,
        reaction,
      });

      const withoutMine = (message.reactions ?? []).filter(
        (item) => item.user_id !== currentUserId,
      );
      const nextReactions = reaction
        ? [
            ...withoutMine,
            {
              user_id: currentUserId,
              reaction,
              created_at: new Date().toISOString(),
            },
          ]
        : withoutMine;
      setMessageReactions(message.id, nextReactions);
    }
  }, [currentUserId, emit, setMessageReactions]);

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

  useEffect(() => {
    const handleMessageRecalled = (payload: unknown) => {
      const data = payload as {
        message_id?: string;
        recalled_at?: string;
        recalled_by?: string;
      };

      if (!data.message_id) return;
      markMessageRecalled(data.message_id, data.recalled_at, data.recalled_by);
    };

    const handleMessageDeleted = (payload: unknown) => {
      const data = payload as {
        message_id?: string;
        user_id?: string;
      };

      if (!data.message_id) return;
      if (data.user_id && data.user_id !== currentUserId) return;
      removeMessageForCurrentUser(data.message_id);
    };

    const handleReactionUpdated = (payload: unknown) => {
      const data = payload as {
        message_id?: string;
        reactions?: MessageReaction[];
      };

      if (!data.message_id) return;
      setMessageReactions(data.message_id, data.reactions ?? []);
    };

    on("message:recalled", handleMessageRecalled);
    on("message:deleted", handleMessageDeleted);
    on("message:reaction_updated", handleReactionUpdated);

    return () => {
      off("message:recalled", handleMessageRecalled);
      off("message:deleted", handleMessageDeleted);
      off("message:reaction_updated", handleReactionUpdated);
    };
  }, [currentUserId, markMessageRecalled, off, on, removeMessageForCurrentUser, setMessageReactions]);

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

  function renderMessageReactions(msg: Message) {
    const counts: Partial<Record<MessageReaction["reaction"], number>> = {};
    for (const item of msg.reactions ?? []) {
      counts[item.reaction] = (counts[item.reaction] ?? 0) + 1;
    }

    const myReaction = (msg.reactions ?? []).find((item) => item.user_id === currentUserId)?.reaction;

    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        {(Object.keys(counts) as MessageReaction["reaction"][]).map((reactionKey) => (
          <View
            key={`${msg.id}-${reactionKey}`}
            style={{
              borderWidth: 1,
              borderColor: myReaction === reactionKey ? "#60a5fa" : "#cbd5e1",
              backgroundColor: myReaction === reactionKey ? "#eff6ff" : "#ffffff",
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 11, color: myReaction === reactionKey ? "#1d4ed8" : "#475569" }}>
              {REACTION_EMOJI[reactionKey]} {counts[reactionKey]}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-white">
      {activeChatId && activeConv ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* Chat header */}
          <View className="flex-row items-center px-3 py-2.5 border-b border-slate-200 bg-white">
            <TouchableOpacity
              onPress={closeActiveChat}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="flex-row items-center px-2 py-2 mr-2"
            >
              <Text className="text-blue-600 text-base font-semibold">← Danh sách</Text>
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
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              {...chatSwipeResponder.panHandlers}
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

                const myReaction = (msg.reactions ?? []).find((item) => item.user_id === currentUserId)?.reaction;

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
                      <Pressable
                        onLongPress={() =>
                          setActiveActionMessageId((current) =>
                            current === msg.id ? null : msg.id,
                          )
                        }
                        delayLongPress={250}
                        style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}
                      >
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
                      </Pressable>

                      {renderMessageReactions(msg)}

                      {!msg.recalled_at && activeActionMessageId === msg.id && (
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 8,
                            marginTop: 6,
                            justifyContent: isMe ? "flex-end" : "flex-start",
                          }}
                        >
                          {(Object.keys(REACTION_EMOJI) as MessageReaction["reaction"][]).map((reactionKey) => (
                            <TouchableOpacity
                              key={`${msg.id}-react-${reactionKey}`}
                              onPress={() =>
                                void handleReactMessage(
                                  msg,
                                  myReaction === reactionKey ? undefined : reactionKey,
                                )
                              }
                              style={{
                                backgroundColor: "#f8fafc",
                                borderColor: "#cbd5e1",
                                borderWidth: 1,
                                borderRadius: 999,
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                              }}
                            >
                              <Text style={{ fontSize: 12 }}>{REACTION_EMOJI[reactionKey]}</Text>
                            </TouchableOpacity>
                          ))}

                          {isMe && (
                            <TouchableOpacity onPress={() => void handleRecallMessage(msg)}>
                              <Text className="text-[11px] text-rose-500 font-medium">Thu hồi</Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity onPress={() => void handleDeleteMessage(msg)}>
                            <Text className="text-[11px] text-rose-500 font-medium">Xóa</Text>
                          </TouchableOpacity>
                        </View>
                      )}

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
