import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../contexts/auth";
import { useSocket } from "../../hooks/useSocket";
import { getAuthToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";
import { blockFriendship, unblockFriendship, getFriendshipStatus } from "../../lib/users";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

interface GroupMember {
  userId: string;
  role: "owner" | "admin" | "member";
  profile?: {
    id?: string;
    fullName?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
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
      ...((init.headers as object) ?? {}),
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
  if (diffDays === 0)
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (diffDays === 1) return "Hôm qua";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

/** Parse message content — may be plain text or JSON with a `file` attachment */
function parseMessageContent(content: string): {
  text: string;
  file: FileAttachment | null;
} {
  if (!content || !content.trim().startsWith("{")) {
    return { text: content, file: null };
  }
  try {
    const parsed = JSON.parse(content) as {
      text?: string;
      file?: FileAttachment;
    };
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

function getMessagePreview(
  content: string,
  recalledAt?: string | null,
): string {
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
function ImageViewer({
  uri,
  onClose,
  token,
}: {
  uri: string;
  onClose: () => void;
  token?: string | null;
}) {
  const { width, height } = Dimensions.get("window");
  const headers: Record<string, string> = { Accept: "image/*" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.92)",
          justifyContent: "center",
          alignItems: "center",
        }}
        activeOpacity={1}
        onPress={onClose}
      >
        <Image
          source={{ uri, headers }}
          resizeMode="contain"
          style={{
            width: width - 16,
            height: height * 0.7,
          }}
        />
        <Text style={{ color: "#94a3b8", marginTop: 12, fontSize: 13 }}>
          Nhấn để đóng
        </Text>
      </TouchableOpacity>
    </Modal>
  );
}

// ── File/Image Message Renderer ───────────────────────────────────────────────
function FileMessage({
  file,
  isMe,
  token,
}: {
  file: FileAttachment;
  isMe: boolean;
  token?: string | null;
}) {
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const url = buildFileUrl(file.path, token);
  const isImage = file.mimetype?.startsWith("image/");

  // Build headers with Authorization token for React Native Image loader
  const imageHeaders: Record<string, string> = {};
  if (token) {
    imageHeaders["Authorization"] = `Bearer ${token}`;
  }

  if (isImage) {
    return (
      <>
        <TouchableOpacity
          onPress={() => setPreviewUri(url)}
          activeOpacity={0.85}
        >
          {imgError ? (
            <View
              style={{
                width: 200,
                height: 120,
                borderRadius: 12,
                backgroundColor: isMe ? "rgba(255,255,255,0.15)" : "#f1f5f9",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 28, marginBottom: 4 }}>🖼</Text>
              <Text
                style={{
                  fontSize: 11,
                  color: isMe ? "#dbeafe" : "#94a3b8",
                }}
              >
                Không tải được ảnh
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: url, headers: imageHeaders }}
              resizeMode="cover"
              style={{
                width: 200,
                height: 200,
                borderRadius: 12,
              }}
              onError={(e) => {
                console.warn(
                  "[FileMessage] Image load failed:",
                  url,
                  e.nativeEvent?.error,
                );
                setImgError(true);
              }}
            />
          )}
          <Text
            style={{
              fontSize: 11,
              marginTop: 4,
              color: isMe ? "#dbeafe" : "#64748b",
            }}
            numberOfLines={1}
          >
            {file.originalName ?? file.filename}
          </Text>
        </TouchableOpacity>
        {previewUri && (
          <ImageViewer
            uri={previewUri}
            onClose={() => setPreviewUri(null)}
            token={token}
          />
        )}
      </>
    );
  }

  // Non-image file
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ fontSize: 22 }}>📎</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: isMe ? "#fff" : "#1e293b",
          }}
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
  const insets = useSafeAreaInsets();
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
  const showConversationListNonce = Array.isArray(
    showConversationListNonceParam,
  )
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
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeActionMessageId, setActiveActionMessageId] = useState<
    string | null
  >(null);
  const [showChatDetails, setShowChatDetails] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByCurrentUser, setBlockedByCurrentUser] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupCandidates, setGroupCandidates] = useState<
    Array<{ id: string; fullName: string }>
  >([]);
  const [selectedAddMemberIds, setSelectedAddMemberIds] = useState<string[]>(
    [],
  );
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupBusyAction, setGroupBusyAction] = useState<string>("");
  const [groupError, setGroupError] = useState<string>("");
  // userId → { fullName, avatarUrl } cache
  const [userCache, setUserCache] = useState<
    Record<string, { fullName: string; avatarUrl?: string | null }>
  >({});

  const scrollRef = useRef<ScrollView>(null);
  const openChatRef = useRef<((conv: Conversation) => Promise<void>) | null>(
    null,
  );
  const conversationsRef = useRef<Conversation[]>([]);
  const pendingAutoOpenConversationIdRef = useRef<string | null>(null);
  const forceOpenConversationIdRef = useRef<string | null>(null);
  const typingUserTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const localTypingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const localTypingActiveRef = useRef(false);
  const activeConv = conversations.find((c) => c.id === activeChatId);
  const currentGroupMember = useMemo(
    () => groupMembers.find((member) => member.userId === currentUserId),
    [groupMembers, currentUserId],
  );
  const canManageGroupMembers =
    currentGroupMember?.role === "owner" ||
    currentGroupMember?.role === "admin";
  const isGroupOwner = currentGroupMember?.role === "owner";

  const clearTypingUsers = useCallback(() => {
    Object.values(typingUserTimeoutsRef.current).forEach((timer) => {
      clearTimeout(timer);
    });
    typingUserTimeoutsRef.current = {};
    setTypingUserIds([]);
  }, []);

  const sharedMedia = useMemo(() => {
    return messages
      .filter((m) => m.type === "file")
      .map((m) => {
        const { file } = parseMessageContent(m.content);
        if (!file) return null;
        const isImage = file.mimetype?.startsWith("image/") ?? false;
        const url = buildFileUrl(file.path, authToken);
        return {
          id: m.id,
          fileName: file.originalName || file.filename,
          isImage,
          url,
          size: file.size,
          mimetype: file.mimetype,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [messages, authToken]);

  const imageItems = useMemo(() => sharedMedia.filter((item) => item.isImage), [sharedMedia]);
  const fileItems = useMemo(() => sharedMedia.filter((item) => !item.isImage), [sharedMedia]);

  const directPeerId = activeConv?.type === "direct" && activeConv.peerId ? activeConv.peerId : null;

  const handleBlockToggle = useCallback(async () => {
    if (!directPeerId) return;
    try {
      if (isBlocked && blockedByCurrentUser) {
        await unblockFriendship(directPeerId);
        setIsBlocked(false);
        setBlockedByCurrentUser(false);
        Alert.alert("Thành công", "Đã mở chặn tin nhắn.");
      } else if (!isBlocked) {
        await blockFriendship(directPeerId);
        setIsBlocked(true);
        setBlockedByCurrentUser(true);
        Alert.alert("Thành công", "Đã chặn người dùng này.");
      } else {
        Alert.alert("Lỗi", "Bạn đang bị chặn, không thể tự mở chặn.");
      }
    } catch {
      Alert.alert("Lỗi", "Không thể thực hiện thao tác này.");
    }
  }, [directPeerId, isBlocked, blockedByCurrentUser]);

  // Load blocked status when opening chat details
  useEffect(() => {
    if (showChatDetails && activeConv?.type === "direct" && directPeerId) {
      getFriendshipStatus(directPeerId).then((res) => {
        const blocked = Boolean(res.data?.isBlocked);
        const meBlocker = blocked && res.data?.blockedByUserId === currentUserId;
        setIsBlocked(blocked);
        setBlockedByCurrentUser(meBlocker);
      }).catch(console.warn);
    }
  }, [showChatDetails, activeConv?.type, directPeerId, currentUserId]);

  const typingIndicatorText = useMemo(() => {
    if (!activeConv || typingUserIds.length === 0) {
      return null;
    }

    const typingNames = typingUserIds
      .map((userId) => {
        const cached = userCache[userId];
        return cached?.fullName || "Ai đó";
      })
      .filter(Boolean);

    if (typingNames.length === 0) {
      return "Đang nhập...";
    }

    if (typingNames.length === 1) {
      return `${typingNames[0]} đang nhập...`;
    }

    return `${typingNames.length} người đang nhập...`;
  }, [activeConv, typingUserIds, userCache]);

  const updateConversationPreviewFromMessages = useCallback(
    (conversationId: string, nextMessages: Message[]) => {
      const lastMessage = nextMessages[nextMessages.length - 1];

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                preview: lastMessage
                  ? getMessagePreview(
                      lastMessage.content,
                      lastMessage.recalled_at,
                    )
                  : SYSTEM_GREETING,
                time: lastMessage ? formatTime(lastMessage.created_at) : "",
              }
            : conv,
        ),
      );
    },
    [],
  );

  // ── Load user info (friends + chat-peers) for name resolution ────────────
  const loadUserCache = useCallback(async () => {
    try {
      const token = await getAuthToken();
      setAuthToken(token);
      const [peersRes, friendsRes] = await Promise.allSettled([
        authFetch("/api/users/chat-peers"),
        authFetch("/api/users/friends"),
      ]);

      const cache: Record<
        string,
        { fullName: string; avatarUrl?: string | null }
      > = {};
      const applyUsers = (data: unknown) => {
        if (!Array.isArray(data)) return;
        for (const u of data) {
          if (u?.id && u.fullName) {
            cache[u.id] = {
              fullName: u.fullName,
              avatarUrl: u.avatarUrl ?? null,
            };
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
  const loadConversations = useCallback(
    async (
      autoOpenId?: string,
      existingCache?: Record<
        string,
        { fullName: string; avatarUrl?: string | null }
      >,
    ) => {
      try {
        const cache = existingCache ?? userCache;
        const res = await authFetch("/api/conversations");
        const data = (res.data ?? []) as any[];

        const mapped: Conversation[] = data.map((conv: any) => {
          const isGroup = conv.type === "group";
          const peerId = isGroup
            ? undefined
            : (conv.memberIds as string[]).find(
                (id: string) => id !== currentUserId,
              );
          const groupOwnerId =
            typeof conv.createdBy === "string" && conv.createdBy.trim().length > 0
              ? conv.createdBy
              : undefined;

          // Resolve name from cache
          const peerInfo = peerId ? cache[peerId] : undefined;
          const groupOwnerInfo = groupOwnerId ? cache[groupOwnerId] : undefined;
          const resolvedName = isGroup
            ? conv.name || "Nhóm"
            : peerInfo?.fullName || conv.name || "Đang tải...";

          const resolvedAvatar = isGroup
            ? ((typeof conv.avatarUrl === "string" ? conv.avatarUrl : null) ??
              groupOwnerInfo?.avatarUrl ??
              ((groupOwnerId === currentUserId ? user?.avatarUrl : null) ??
                `https://api.dicebear.com/7.x/identicon/png?seed=${groupOwnerId ?? conv.id}`))
            : (peerInfo?.avatarUrl ??
              (typeof conv.avatarUrl === "string" ? conv.avatarUrl : null) ??
              `https://api.dicebear.com/7.x/avataaars/png?seed=${peerId ?? conv.id}`);

          return {
            id: conv.id,
            name: resolvedName,
            avatar: resolvedAvatar,
            preview: conv.lastMessageAt ? "Đang tải..." : SYSTEM_GREETING,
            time: conv.lastMessageAt ? formatTime(conv.lastMessageAt) : "",
            lastMessageAt: conv.lastMessageAt ?? null,
            online: Boolean(conv.online),
            type: conv.type ?? "direct",
            peerId,
            unread: 0,
          };
        });

        setConversations((prev) => {
          const onlineByPeerId = new Map(
            prev
              .filter((item) => item.type === "direct" && item.peerId)
              .map((item) => [item.peerId as string, item.online]),
          );
          const onlineByConversationId = new Map(
            prev.map((item) => [item.id, item.online]),
          );

          const merged = mapped.map((item) => {
            const preservedOnline =
              item.type === "direct" && item.peerId
                ? onlineByPeerId.get(item.peerId) ??
                  onlineByConversationId.get(item.id)
                : onlineByConversationId.get(item.id);
            return {
              ...item,
              online: preservedOnline ?? item.online,
            };
          });

          conversationsRef.current = merged;
          void hydrateConversationPreviews(merged);
          return merged;
        });

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
    },
    [currentUserId, openConversationId, userCache],
  );

  const hydrateConversationPreviews = useCallback(
    async (items: Conversation[]) => {
      const targets = items.filter((conv) => conv.lastMessageAt);
      if (targets.length === 0) return;

      const results = await Promise.allSettled(
        targets.map(async (conv) => {
          const response = await authFetch(`/api/messages/${conv.id}?limit=1`);
          const latest = Array.isArray(response.data)
            ? (response.data[0] as Message | undefined)
            : undefined;
          if (!latest) return null;

          return {
            id: conv.id,
            preview: getMessagePreview(latest.content, latest.recalled_at),
            time: formatTime(latest.created_at),
          };
        }),
      );

      const updates = results
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<{
            id: string;
            preview: string;
            time: string;
          } | null> => result.status === "fulfilled",
        )
        .map((result) => result.value)
        .filter(
          (value): value is { id: string; preview: string; time: string } =>
            value !== null,
        );

      if (updates.length === 0) return;

      setConversations((prev) =>
        prev.map((conv) => {
          const update = updates.find((item) => item.id === conv.id);
          return update
            ? { ...conv, preview: update.preview, time: update.time }
            : conv;
        }),
      );
    },
    [],
  );

  useEffect(() => {
    if (!currentUserId) return;
    // Load user cache first, then conversations (so names resolve on first render)
    loadUserCache().then((cache) => loadConversations(undefined, cache));
  }, [currentUserId]);

  // When openConversationId param arrives (from Friends tab navigation)
  useEffect(() => {
    if (!openConversationId) return;
    const conv = conversationsRef.current.find(
      (c) => c.id === openConversationId,
    );
    if (conv && openChatRef.current) {
      pendingAutoOpenConversationIdRef.current = null;
      forceOpenConversationIdRef.current = conv.id;
      void openChatRef.current(conv);
    } else if (currentUserId) {
      loadConversations(openConversationId);
    }
  }, [
    openConversationId,
    openConversationNonce,
    currentUserId,
    loadConversations,
  ]);

  useEffect(() => {
    const pendingConversationId = pendingAutoOpenConversationIdRef.current;
    if (!pendingConversationId || !openChatRef.current) {
      return;
    }

    const target = conversationsRef.current.find(
      (c) => c.id === pendingConversationId,
    );
    if (!target) {
      return;
    }

    pendingAutoOpenConversationIdRef.current = null;
    forceOpenConversationIdRef.current = target.id;
    void openChatRef.current(target);
  }, [conversations]);

  // ── Open a chat ───────────────────────────────────────────────────────────
  const openChat = useCallback(
    async (conv: Conversation) => {
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
        prev.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c)),
      );

      try {
        let msgs: Message[] = [];

        try {
          const res = await authFetch(`/api/messages/${conv.id}?limit=200`);
          msgs = (res.data ?? []) as Message[];
        } catch {
          // Fallback for environments where message routes are exposed through conversation endpoints.
          const fallback = await authFetch(
            `/api/conversations/${conv.id}/messages?limit=200`,
          );
          msgs = (fallback.data ?? []) as Message[];
        }

        setMessages(msgs.reverse());
      } catch {
        setMessages([]);
      } finally {
        setLoadingMsgs(false);
        setTimeout(
          () => scrollRef.current?.scrollToEnd({ animated: false }),
          100,
        );
      }
    },
    [activeChatId, join, leave],
  );

  useEffect(() => {
    openChatRef.current = openChat;
  }, [openChat]);

  const closeActiveChat = useCallback(() => {
    if (activeChatId) {
      leave(activeChatId);
    }
    if (localTypingStopTimerRef.current) {
      clearTimeout(localTypingStopTimerRef.current);
      localTypingStopTimerRef.current = null;
    }

    if (localTypingActiveRef.current && activeChatId) {
      emit("message:typing", {
        conversation_id: activeChatId,
        is_typing: false,
      });
      localTypingActiveRef.current = false;
    }

    clearTypingUsers();
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
  }, [activeChatId, clearTypingUsers, emit, leave, router]);

  const loadGroupManagementDetail = useCallback(async () => {
    if (!activeChatId || activeConv?.type !== "group") return;

    setGroupLoading(true);
    setGroupError("");
    try {
      const detailRes = await authFetch(`/api/conversations/${activeChatId}`);
      const members = (detailRes.data?.members ?? []) as GroupMember[];
      setGroupMembers(members);

      const memberIds = new Set(members.map((m) => m.userId));
      const friendsRes = await authFetch("/api/users/friends");
      const candidates = (
        (friendsRes.data ?? []) as Array<{ id: string; fullName: string }>
      ).filter((friend) => !memberIds.has(friend.id));
      setGroupCandidates(candidates);
    } catch {
      setGroupError("Không thể tải dữ liệu quản lý nhóm.");
    } finally {
      setGroupLoading(false);
    }
  }, [activeChatId, activeConv?.type]);

  const openChatDetails = useCallback(async () => {
    setShowChatDetails(true);
    setSelectedAddMemberIds([]);
    if (activeConv?.type === "group") {
      await loadGroupManagementDetail();
    }
  }, [loadGroupManagementDetail, activeConv?.type]);

  const openVideoCall = useCallback(() => {
    if (!activeChatId || !activeConv) return;
    const callId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    emit("call:initiate", {
      call_id: callId,
      conversation_id: activeChatId,
      call_type: activeConv.type === "group" ? "group" : "direct",
    });

    router.push({
      pathname: "/webcall",
      params: {
        callId,
        incoming: "0",
        conversationId: activeChatId,
        conversationName: activeConv.name,
        callType: activeConv.type,
      },
    });
  }, [activeChatId, activeConv, emit, router]);

  useEffect(() => {
    const handleIncomingCall = (payload: unknown) => {
      const data = payload as {
        call_id?: unknown;
        conversation_id?: unknown;
        call_type?: unknown;
        conversation_name?: unknown;
        initiator_id?: unknown;
      };

      const callId = typeof data.call_id === "string" ? data.call_id : "";
      const conversationId =
        typeof data.conversation_id === "string" ? data.conversation_id : "";
      const initiatorId =
        typeof data.initiator_id === "string" ? data.initiator_id : "";
      const callType = data.call_type === "group" ? "group" : "direct";
      const conversationName =
        typeof data.conversation_name === "string" && data.conversation_name.trim()
          ? data.conversation_name
          : "Cuộc gọi";

      if (!callId || !conversationId || initiatorId === currentUserId) {
        return;
      }

      Alert.alert(
        "Cuộc gọi đến",
        `${conversationName} đang gọi cho bạn`,
        [
          {
            text: "Từ chối",
            style: "destructive",
            onPress: () => {
              emit("call:decline", {
                call_id: callId,
                conversation_id: conversationId,
                reason: "declined_by_user",
              });
            },
          },
          {
            text: "Nhận",
            onPress: () => {
              emit("call:accept", {
                call_id: callId,
                conversation_id: conversationId,
              });

              router.push({
                pathname: "/webcall",
                params: {
                  callId,
                  incoming: "1",
                  conversationId,
                  conversationName,
                  callType,
                },
              });
            },
          },
        ],
        { cancelable: false },
      );
    };

    on("call:initiate", handleIncomingCall);
    return () => {
      off("call:initiate", handleIncomingCall);
    };
  }, [currentUserId, emit, off, on, router]);

  const handleAddMembersToGroup = useCallback(async () => {
    if (!activeChatId || selectedAddMemberIds.length === 0) return;
    setGroupBusyAction("add");
    setGroupError("");
    try {
      await authFetch(`/api/conversations/${activeChatId}/members`, {
        method: "POST",
        body: JSON.stringify({ memberIds: selectedAddMemberIds }),
      });
      setSelectedAddMemberIds([]);
      await loadGroupManagementDetail();
      await loadConversations(activeChatId);
    } catch {
      setGroupError("Không thể thêm thành viên.");
    } finally {
      setGroupBusyAction("");
    }
  }, [
    activeChatId,
    selectedAddMemberIds,
    loadGroupManagementDetail,
    loadConversations,
  ]);

  const handleRemoveMemberFromGroup = useCallback(
    async (targetUserId: string) => {
      if (!activeChatId) return;
      setGroupBusyAction(`remove-${targetUserId}`);
      setGroupError("");
      try {
        await authFetch(
          `/api/conversations/${activeChatId}/members/${targetUserId}`,
          {
            method: "DELETE",
          },
        );
        await loadGroupManagementDetail();
        await loadConversations(activeChatId);
      } catch {
        setGroupError("Không thể xóa thành viên khỏi nhóm.");
      } finally {
        setGroupBusyAction("");
      }
    },
    [activeChatId, loadGroupManagementDetail, loadConversations],
  );

  const handleUpdateMemberRole = useCallback(
    async (targetUserId: string, role: "member" | "admin" | "owner") => {
      if (!activeChatId) return;
      setGroupBusyAction(`role-${targetUserId}-${role}`);
      setGroupError("");
      try {
        await authFetch(
          `/api/conversations/${activeChatId}/members/${targetUserId}/role`,
          {
            method: "PATCH",
            body: JSON.stringify({ role }),
          },
        );
        await loadGroupManagementDetail();
        await loadConversations(activeChatId);
      } catch {
        setGroupError("Không thể cập nhật quyền thành viên.");
      } finally {
        setGroupBusyAction("");
      }
    },
    [activeChatId, loadGroupManagementDetail, loadConversations],
  );

  const handleLeaveGroup = useCallback(async () => {
    if (!activeChatId) return;
    setGroupBusyAction("leave");
    setGroupError("");
    try {
      await authFetch(`/api/conversations/${activeChatId}/leave`, {
        method: "POST",
      });
      setShowChatDetails(false);
      closeActiveChat();
      await loadConversations();
    } catch {
      setGroupError("Không thể rời nhóm.");
    } finally {
      setGroupBusyAction("");
    }
  }, [activeChatId, closeActiveChat, loadConversations]);

  const handleDeleteGroup = useCallback(async () => {
    if (!activeChatId) return;
    setGroupBusyAction("delete");
    setGroupError("");
    try {
      await authFetch(`/api/conversations/${activeChatId}`, {
        method: "DELETE",
      });
      setShowChatDetails(false);
      closeActiveChat();
      await loadConversations();
    } catch {
      setGroupError("Không thể giải tán nhóm.");
    } finally {
      setGroupBusyAction("");
    }
  }, [activeChatId, closeActiveChat, loadConversations]);

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
          return (
            activeChatId !== null &&
            gestureState.x0 <= 28 &&
            gestureState.y0 > 72
          );
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
          const shouldClose =
            gestureState.dx > 70 && Math.abs(gestureState.dy) < 60;
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

    if (localTypingStopTimerRef.current) {
      clearTimeout(localTypingStopTimerRef.current);
      localTypingStopTimerRef.current = null;
    }

    if (localTypingActiveRef.current) {
      emit("message:typing", {
        conversation_id: activeChatId,
        is_typing: false,
      });
      localTypingActiveRef.current = false;
    }

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
        body: JSON.stringify({
          conversation_id: activeChatId,
          content: text,
          type: "text",
        }),
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert("Lỗi", "Không thể gửi tin nhắn. Vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  }, [activeChatId, currentUserId, emit, inputText, sending]);

  useEffect(() => {
    if (!activeChatId || !isConnected) {
      if (localTypingStopTimerRef.current) {
        clearTimeout(localTypingStopTimerRef.current);
        localTypingStopTimerRef.current = null;
      }

      if (localTypingActiveRef.current) {
        localTypingActiveRef.current = false;
      }

      return;
    }

    const hasText = inputText.trim().length > 0;

    if (hasText && !localTypingActiveRef.current) {
      emit("message:typing", {
        conversation_id: activeChatId,
        is_typing: true,
      });
      localTypingActiveRef.current = true;
    }

    if (localTypingStopTimerRef.current) {
      clearTimeout(localTypingStopTimerRef.current);
      localTypingStopTimerRef.current = null;
    }

    if (hasText) {
      localTypingStopTimerRef.current = setTimeout(() => {
        if (!localTypingActiveRef.current) {
          return;
        }

        emit("message:typing", {
          conversation_id: activeChatId,
          is_typing: false,
        });
        localTypingActiveRef.current = false;
      }, 3000);
      return;
    }

    if (localTypingActiveRef.current) {
      emit("message:typing", {
        conversation_id: activeChatId,
        is_typing: false,
      });
      localTypingActiveRef.current = false;
    }
  }, [activeChatId, emit, inputText, isConnected]);

  useEffect(() => {
    clearTypingUsers();
  }, [activeChatId, clearTypingUsers]);

  useEffect(() => {
    const handleTyping = (payload: unknown) => {
      const data = payload as {
        conversation_id?: unknown;
        conversationId?: unknown;
        user_id?: unknown;
        userId?: unknown;
        is_typing?: unknown;
      };

      const conversationIdRaw = data.conversation_id ?? data.conversationId;
      const conversationId =
        typeof conversationIdRaw === "string" ? conversationIdRaw.trim() : "";
      const senderIdRaw = data.user_id ?? data.userId;
      const senderId =
        typeof senderIdRaw === "string" ? senderIdRaw.trim() : "";
      const isTyping = data.is_typing !== false;

      if (!conversationId || !activeChatId || conversationId !== activeChatId) {
        return;
      }

      if (!senderId || senderId === currentUserId) {
        return;
      }

      const existingTimer = typingUserTimeoutsRef.current[senderId];
      if (existingTimer) {
        clearTimeout(existingTimer);
        delete typingUserTimeoutsRef.current[senderId];
      }

      if (!isTyping) {
        setTypingUserIds((prev) => prev.filter((id) => id !== senderId));
        return;
      }

      setTypingUserIds((prev) =>
        prev.includes(senderId) ? prev : [...prev, senderId],
      );

      typingUserTimeoutsRef.current[senderId] = setTimeout(() => {
        delete typingUserTimeoutsRef.current[senderId];
        setTypingUserIds((prev) => prev.filter((id) => id !== senderId));
      }, 6000);
    };

    on("message:typing", handleTyping);
    return () => {
      off("message:typing", handleTyping);
    };
  }, [activeChatId, currentUserId, off, on]);

  useEffect(() => {
    return () => {
      if (localTypingStopTimerRef.current) {
        clearTimeout(localTypingStopTimerRef.current);
      }
      clearTypingUsers();
    };
  }, [clearTypingUsers]);

  const setMessageReactions = useCallback(
    (messageId: string, reactions: MessageReaction[]) => {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === messageId ? { ...item, reactions } : item,
        ),
      );
    },
    [],
  );

  const markMessageRecalled = useCallback(
    (messageId: string, recalledAt?: string, recalledBy?: string) => {
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
      setActiveActionMessageId((current) =>
        current === messageId ? null : current,
      );
    },
    [activeChatId, currentUserId, updateConversationPreviewFromMessages],
  );

  const removeMessageForCurrentUser = useCallback(
    (messageId: string) => {
      if (!activeChatId) return;

      setMessages((prev) => {
        const next = prev.filter((item) => item.id !== messageId);
        updateConversationPreviewFromMessages(activeChatId, next);
        return next;
      });
      setActiveActionMessageId((current) =>
        current === messageId ? null : current,
      );
    },
    [activeChatId, updateConversationPreviewFromMessages],
  );

  const handleRecallMessage = useCallback(
    async (message: Message) => {
      if (message.sender_id !== currentUserId) {
        Alert.alert(
          "Không thể thu hồi",
          "Bạn chỉ có thể thu hồi tin nhắn của chính mình.",
        );
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
    },
    [currentUserId, emit, markMessageRecalled],
  );

  const handleDeleteMessage = useCallback(
    async (message: Message) => {
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
    },
    [emit, removeMessageForCurrentUser],
  );

  const handleReactMessage = useCallback(
    async (message: Message, reaction?: MessageReaction["reaction"]) => {
      try {
        const response = await authFetch(
          `/api/messages/${message.id}/reaction`,
          {
            method: "PUT",
            body: JSON.stringify({ reaction }),
          },
        );
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
    },
    [currentUserId, emit, setMessageReactions],
  );

  // ── Real-time messages ────────────────────────────────────────────────────
  useEffect(() => {
    const handleUserOnline = (payload: unknown) => {
      const raw = payload as {
        user_id?: unknown;
        userId?: unknown;
        id?: unknown;
        online?: unknown;
        isOnline?: unknown;
        status?: unknown;
      };
      const userId =
        typeof raw.user_id === "string"
          ? raw.user_id
          : typeof raw.userId === "string"
            ? raw.userId
            : typeof raw.id === "string"
              ? raw.id
              : "";
      if (!userId) return;

      const online =
        typeof raw.online === "boolean"
          ? raw.online
          : typeof raw.isOnline === "boolean"
            ? raw.isOnline
            : typeof raw.status === "string"
              ? raw.status.toLowerCase() === "online"
              : true;

      setConversations((prev) =>
        prev.map((c) =>
          c.type === "direct" && c.peerId === userId ? { ...c, online } : c,
        ),
      );
    };

    on("user:online", handleUserOnline);
    return () => off("user:online", handleUserOnline);
  }, [on, off]);

  useEffect(() => {
    const handler = (payload: unknown) => {
      const data = payload as any;
      const convId: string = Array.isArray(data.conversation_id)
        ? data.conversation_id[0]
        : data.conversation_id;
      if (!convId) return;

      const rawContent =
        typeof data.content === "object"
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
            prev.map((c) =>
              c.id === convId ? { ...c, unread: c.unread + 1 } : c,
            ),
          );
        }
      }

      // Build preview text (avoid showing JSON)
      const { text, file } = parseMessageContent(rawContent);
      const previewText = file
        ? file.mimetype?.startsWith("image/")
          ? "🖼 Hình ảnh"
          : `📎 ${file.originalName ?? file.filename}`
        : text;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                preview: previewText || c.preview,
                time: formatTime(newMsg.created_at),
              }
            : c,
        ),
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
  }, [
    currentUserId,
    markMessageRecalled,
    off,
    on,
    removeMessageForCurrentUser,
    setMessageReactions,
  ]);

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  // ── Message renderer ─────────────────────────────────────────────────────
  function renderMessageContent(msg: Message, isMe: boolean) {
    const isRecalled = Boolean(msg.recalled_at);
    if (isRecalled) {
      return (
        <Text style={{ fontSize: 14, fontStyle: "italic", color: "#94a3b8" }}>
          Tin nhắn đã được thu hồi
        </Text>
      );
    }

    const { text, file } = parseMessageContent(msg.content);

    return (
      <View style={{ gap: 6 }}>
        {file && <FileMessage file={file} isMe={isMe} token={authToken} />}
        {text ? (
          <Text
            style={{
              fontSize: 14,
              color: isMe ? "#fff" : "#1e293b",
              lineHeight: 20,
            }}
          >
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

    const myReaction = (msg.reactions ?? []).find(
      (item) => item.user_id === currentUserId,
    )?.reaction;

    return (
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}
      >
        {(Object.keys(counts) as MessageReaction["reaction"][]).map(
          (reactionKey) => (
            <View
              key={`${msg.id}-${reactionKey}`}
              style={{
                borderWidth: 1,
                borderColor: myReaction === reactionKey ? "#60a5fa" : "#cbd5e1",
                backgroundColor:
                  myReaction === reactionKey ? "#eff6ff" : "#ffffff",
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: myReaction === reactionKey ? "#1d4ed8" : "#475569",
                }}
              >
                {REACTION_EMOJI[reactionKey]} {counts[reactionKey]}
              </Text>
            </View>
          ),
        )}
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-zalo-bg">
      {activeChatId && activeConv ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* Chat header */}
          <View
            className="flex-row items-center px-3 py-2.5 bg-zalo-blue shadow-sm"
            style={{ paddingTop: insets.top + 8 }}
          >
            <TouchableOpacity
              onPress={closeActiveChat}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="flex-row items-center px-2 py-2 mr-2"
            >
              <Text className="text-white text-base font-semibold">
                ←
              </Text>
            </TouchableOpacity>
            <Image
              source={{ uri: activeConv.avatar }}
              className="w-10 h-10 rounded-full bg-slate-200 mr-3"
            />
            <View className="flex-1">
              <Text className="font-semibold text-white" numberOfLines={1}>
                {activeConv.name}
              </Text>
              <Text className="text-xs text-blue-100">
                {typingIndicatorText ??
                  (activeConv.type === "group"
                    ? "Nhóm"
                    : activeConv.online
                      ? "● Trực tuyến"
                      : "● Ngoại tuyến")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={openVideoCall}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="px-2 py-2 rounded-full active:bg-blue-600 mr-1"
            >
              <Feather name="video" size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void openChatDetails()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="px-3 py-1.5 rounded-xl active:bg-blue-600"
            >
              <Text style={{ fontSize: 22, color: "#ffffff" }}>≡</Text>
            </TouchableOpacity>
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
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              }
              {...chatSwipeResponder.panHandlers}
            >
              {/* System greeting when no messages yet */}
              {messages.length === 0 && (
                <View className="items-center mt-8 mb-4">
                  <Image
                    source={{ uri: activeConv.avatar }}
                    className="w-20 h-20 rounded-full bg-slate-200 mb-3"
                  />
                  <Text className="font-bold text-slate-800 text-base">
                    {activeConv.name}
                  </Text>
                  <View className="mt-4 bg-slate-100 rounded-2xl px-5 py-3 mx-8">
                    <Text className="text-slate-500 text-sm text-center">
                      {SYSTEM_GREETING}
                    </Text>
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
                        <Text className="text-slate-500 text-xs">
                          {msg.content}
                        </Text>
                      </View>
                    </View>
                  );
                }

                const myReaction = (msg.reactions ?? []).find(
                  (item) => item.user_id === currentUserId,
                )?.reaction;

                return (
                  <View
                    key={msg.id}
                    className={`flex-row items-end mb-3 ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    {!isMe && (
                      <Image
                        source={{
                          uri:
                            userCache[msg.sender_id]?.avatarUrl ||
                            `https://api.dicebear.com/7.x/avataaars/png?seed=${msg.sender_id}`,
                        }}
                        className="w-8 h-8 rounded-full bg-slate-200 mr-2"
                      />
                    )}
                    <View
                      style={{
                        maxWidth: "75%",
                        alignItems: isMe ? "flex-end" : "flex-start",
                      }}
                    >
                      {!isMe && (
                        <Text className="text-[10px] text-slate-400 mb-0.5 ml-1">
                          {userCache[msg.sender_id]?.fullName ||
                            msg.sender_name ||
                            ""}
                        </Text>
                      )}
                      <Pressable
                        onLongPress={() =>
                          setActiveActionMessageId((current) =>
                            current === msg.id ? null : msg.id,
                          )
                        }
                        delayLongPress={250}
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-end",
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 18,
                            borderBottomRightRadius: isMe ? 4 : 18,
                            borderBottomLeftRadius: isMe ? 18 : 4,
                            backgroundColor: isMe ? "#0068FF" : "#ffffff",
                            borderWidth: isMe ? 0 : 1,
                            borderColor: "#e2e8f0",
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
                          {(
                            Object.keys(
                              REACTION_EMOJI,
                            ) as MessageReaction["reaction"][]
                          ).map((reactionKey) => (
                            <TouchableOpacity
                              key={`${msg.id}-react-${reactionKey}`}
                              onPress={() =>
                                void handleReactMessage(
                                  msg,
                                  myReaction === reactionKey
                                    ? undefined
                                    : reactionKey,
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
                              <Text style={{ fontSize: 12 }}>
                                {REACTION_EMOJI[reactionKey]}
                              </Text>
                            </TouchableOpacity>
                          ))}

                          {isMe && (
                            <TouchableOpacity
                              onPress={() => void handleRecallMessage(msg)}
                            >
                              <Text className="text-[11px] text-rose-500 font-medium">
                                Thu hồi
                              </Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            onPress={() => void handleDeleteMessage(msg)}
                          >
                            <Text className="text-[11px] text-rose-500 font-medium">
                              Xóa
                            </Text>
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
              {["👋 Xin chào!", "Hi bạn 😊", "Chào mừng bạn bè mới!"].map(
                (greeting) => (
                  <TouchableOpacity
                    key={greeting}
                    onPress={() => setInputText(greeting)}
                    className="bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5"
                  >
                    <Text className="text-blue-600 text-sm font-medium">
                      {greeting}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
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
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  className={`font-semibold text-sm ${inputText.trim() ? "text-white" : "text-slate-400"}`}
                >
                  Gửi
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Modal
            visible={showChatDetails}
            animationType="slide"
            onRequestClose={() => setShowChatDetails(false)}
          >
            <SafeAreaView className="flex-1 bg-slate-50">
              <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-200">
                <TouchableOpacity onPress={() => setShowChatDetails(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text className="text-xl font-bold text-slate-600">{"←"}</Text>
                </TouchableOpacity>
                <Text className="flex-1 text-center font-bold text-lg text-slate-800">Tùy chọn</Text>
                <View style={{ width: 20 }} />
              </View>
              <ScrollView className="flex-1">
                {/* Header Info */}
                <View className="bg-white items-center pt-6 pb-4 border-b border-slate-100">
                  <Image source={{ uri: activeConv.avatar }} className="w-20 h-20 rounded-full mb-3" />
                  <Text className="text-xl font-bold text-slate-800">{activeConv.name}</Text>
                  <Text className="text-sm text-slate-500 mt-1">{activeConv.type === "group" ? `${groupMembers.length} thành viên` : "Thông tin hội thoại"}</Text>
                </View>

                {/* Toggles */}
                <View className="bg-white mt-3 border-y border-slate-100">
                  <TouchableOpacity onPress={() => setIsMuted(!isMuted)} className="flex-row items-center justify-between p-4 border-b border-slate-50">
                    <Text className="text-base text-slate-700">{isMuted ? "Đang tắt thông báo" : "Tắt thông báo"}</Text>
                    <Text className="text-xl">{isMuted ? "🔕" : "🔔"}</Text>
                  </TouchableOpacity>
                  {activeConv.type === "direct" && (
                    <TouchableOpacity onPress={() => void handleBlockToggle()} className="flex-row items-center justify-between p-4">
                      <Text className={`text-base ${(isBlocked && blockedByCurrentUser) ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {(isBlocked && blockedByCurrentUser) ? "Mở chặn người này" : (isBlocked ? "Bạn đang bị chặn" : "Chặn tin nhắn")}
                      </Text>
                      <Text className="text-xl">{(isBlocked && blockedByCurrentUser) ? "🟢" : "🚫"}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Media */}
                <View className="bg-white mt-3 border-y border-slate-100 pt-3 pb-4">
                  <Text className="px-4 text-sm font-bold text-slate-800 mb-3">Thư viện ảnh ({imageItems.length})</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3">
                    {imageItems.length === 0 ? (
                      <Text className="text-slate-400 text-sm ml-1 mb-2">Không có ảnh nào</Text>
                    ) : (
                      imageItems.map((img) => (
                        <TouchableOpacity key={img.id} activeOpacity={0.9} className="mr-2">
                          <Image source={{ uri: img.url, headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined }} className="w-20 h-20 rounded-lg bg-slate-200" />
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>

                {/* Files */}
                <View className="bg-white mt-3 border-y border-slate-100 py-3">
                  <Text className="px-4 text-sm font-bold text-slate-800 mb-3">Tài liệu, files ({fileItems.length})</Text>
                  {fileItems.length === 0 ? (
                    <Text className="text-slate-400 text-sm px-4 mb-2">Không có file nào</Text>
                  ) : (
                    fileItems.map((f) => (
                      <View key={f.id} className="flex-row items-center px-4 py-2 border-b border-slate-50">
                        <Text className="text-2xl mr-3">📎</Text>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-slate-800" numberOfLines={1}>{f.fileName}</Text>
                          <Text className="text-xs text-slate-500">{f.mimetype} · {Math.round(f.size / 1024)}KB</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                {/* Group Config (Only for groups) */}
                {activeConv.type === "group" && (
                  <View className="bg-white mt-3 border-y border-slate-100 pt-3 pb-6">
                    <View className="px-4">
                      {groupError ? (
                        <Text className="text-xs text-rose-600 mb-3">
                          {groupError}
                        </Text>
                      ) : null}

                      <Text className="text-sm font-semibold text-slate-700 mb-2 mt-4 text-center">
                        --- Quản lý Thành viên ---
                      </Text>
                      {groupMembers.map((member) => {
                        const memberName =
                          member.profile?.fullName ||
                          userCache[member.userId]?.fullName ||
                          `Người dùng ${member.userId.slice(0, 6)}`;
                        const isSelf = member.userId === currentUserId;
                        const canOwnerChangeRole =
                          isGroupOwner && !isSelf && member.role !== "owner";

                        return (
                          <View
                            key={member.userId}
                            style={{
                              borderWidth: 1,
                              borderColor: "#e2e8f0",
                              borderRadius: 12,
                              padding: 10,
                              marginBottom: 8,
                            }}
                          >
                            <Text className="text-sm font-medium text-slate-800">
                              {memberName}
                            </Text>
                            <Text className="text-xs text-slate-500 mt-0.5">
                              {member.role === "owner"
                                ? "Chủ nhóm"
                                : member.role === "admin"
                                  ? "Phó nhóm"
                                  : "Thành viên"}
                              {isSelf ? " (Bạn)" : ""}
                            </Text>

                            {canOwnerChangeRole && (
                              <View className="flex-row flex-wrap gap-2 mt-2">
                                {member.role === "member" ? (
                                  <TouchableOpacity
                                    onPress={() =>
                                      void handleUpdateMemberRole(
                                        member.userId,
                                        "admin",
                                      )
                                    }
                                    disabled={
                                      groupBusyAction ===
                                      `role-${member.userId}-admin`
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-blue-50"
                                  >
                                    <Text className="text-[11px] font-semibold text-blue-700">
                                      Gán phó nhóm
                                    </Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity
                                    onPress={() =>
                                      void handleUpdateMemberRole(
                                        member.userId,
                                        "member",
                                      )
                                    }
                                    disabled={
                                      groupBusyAction ===
                                      `role-${member.userId}-member`
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-slate-100"
                                  >
                                    <Text className="text-[11px] font-semibold text-slate-700">
                                      Hạ thành viên
                                    </Text>
                                  </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                  onPress={() =>
                                    void handleUpdateMemberRole(
                                      member.userId,
                                      "owner",
                                    )
                                  }
                                  disabled={
                                    groupBusyAction ===
                                    `role-${member.userId}-owner`
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-amber-50"
                                >
                                  <Text className="text-[11px] font-semibold text-amber-700">
                                    Chuyển chủ nhóm
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}

                            {canManageGroupMembers && !isSelf && (
                              <TouchableOpacity
                                onPress={() =>
                                  void handleRemoveMemberFromGroup(member.userId)
                                }
                                disabled={
                                  groupBusyAction === `remove-${member.userId}`
                                }
                                className="mt-2 px-2.5 py-1 rounded-lg bg-rose-50 self-start"
                              >
                                <Text className="text-[11px] font-semibold text-rose-700">
                                  Xóa khỏi nhóm
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}

                      {canManageGroupMembers && (
                        <>
                          <Text className="text-sm font-semibold text-slate-700 mt-2 mb-2">
                            Thêm thành viên
                          </Text>
                          {groupCandidates.length === 0 ? (
                            <Text className="text-xs text-slate-500 mb-3">
                              Không còn bạn bè để thêm.
                            </Text>
                          ) : (
                            <>
                              {groupCandidates.map((friend) => {
                                const selected = selectedAddMemberIds.includes(
                                  friend.id,
                                );
                                return (
                                  <TouchableOpacity
                                    key={friend.id}
                                    onPress={() => {
                                      setSelectedAddMemberIds((prev) =>
                                        prev.includes(friend.id)
                                          ? prev.filter((id) => id !== friend.id)
                                          : [...prev, friend.id],
                                      );
                                    }}
                                    style={{
                                      borderWidth: 1,
                                      borderColor: selected
                                        ? "#3b82f6"
                                        : "#e2e8f0",
                                      backgroundColor: selected
                                        ? "#eff6ff"
                                        : "#ffffff",
                                      borderRadius: 10,
                                      paddingVertical: 8,
                                      paddingHorizontal: 10,
                                      marginBottom: 6,
                                    }}
                                  >
                                    <Text className="text-sm text-slate-700">
                                      {friend.fullName}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}

                              <TouchableOpacity
                                onPress={() => void handleAddMembersToGroup()}
                                disabled={
                                  selectedAddMemberIds.length === 0 ||
                                  groupBusyAction === "add"
                                }
                                className={`mt-2 px-3 py-2 rounded-xl ${selectedAddMemberIds.length > 0 ? "bg-blue-600" : "bg-slate-300"}`}
                              >
                                <Text className="text-center text-white text-xs font-semibold">
                                  {groupBusyAction === "add"
                                    ? "Đang thêm..."
                                    : `Thêm ${selectedAddMemberIds.length} thành viên`}
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </>
                      )}

                      <View className="mt-8 mb-2">
                        <TouchableOpacity
                          onPress={() => void handleLeaveGroup()}
                          disabled={groupBusyAction === "leave"}
                          className="px-3 py-3 rounded-xl bg-orange-50 mb-3"
                        >
                          <Text className="text-center text-orange-700 font-semibold text-base">
                            {groupBusyAction === "leave"
                              ? "Đang rời nhóm..."
                              : "Rời nhóm"}
                          </Text>
                        </TouchableOpacity>

                        {isGroupOwner && (
                          <TouchableOpacity
                            onPress={() => void handleDeleteGroup()}
                            disabled={groupBusyAction === "delete"}
                            className="px-3 py-3 rounded-xl bg-rose-50"
                          >
                            <Text className="text-center text-rose-700 font-semibold text-base">
                              {groupBusyAction === "delete"
                                ? "Đang giải tán..."
                                : "Giải tán nhóm"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </KeyboardAvoidingView>
      ) : (
        <>
          <View
            className="flex-row items-center justify-between px-4 py-3 bg-zalo-blue"
            style={{ paddingTop: insets.top + 8 }}
          >
            <View className="flex-row items-center gap-3">
              <Image
                source={{
                  uri:
                    user?.avatarUrl ||
                    `https://api.dicebear.com/7.x/avataaars/png?seed=${currentUserId}`,
                }}
                className="w-10 h-10 rounded-full bg-slate-200"
              />
              <View>
                <Text className="text-base font-bold text-white">
                  Tin nhắn
                </Text>
                <Text className="text-xs text-blue-100">
                  {isConnected ? "● Trực tuyến" : "○ Ngoại tuyến..."}
                </Text>
              </View>
            </View>
            {totalUnread > 0 && (
              <View className="bg-red-500 rounded-full min-w-[22px] h-[22px] items-center justify-center px-1.5">
                <Text className="text-white text-xs font-bold">
                  {totalUnread}
                </Text>
              </View>
            )}
          </View>

          <View className="px-4 pb-3 bg-zalo-blue">
            <View className="bg-white/20 rounded-lg px-4 py-2 flex-row items-center gap-2">
              <Text className="text-white">🔍</Text>
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Tìm kiếm..."
                placeholderTextColor="#bae6fd"
                className="flex-1 text-sm text-white"
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
              <Text className="text-slate-600 font-medium">
                Chưa có cuộc trò chuyện
              </Text>
              <Text className="text-slate-400 text-xs mt-1">
                Kết bạn để bắt đầu nhắn tin
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredConversations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const { text: previewText, file: previewFile } =
                  parseMessageContent(item.preview);
                const displayPreview = previewFile
                  ? previewFile.mimetype?.startsWith("image/")
                    ? "🖼 Hình ảnh"
                    : `📎 ${previewFile.originalName}`
                  : previewText || item.preview;

                return (
                  <TouchableOpacity
                    onPress={() => openChat(item)}
                    className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100"
                  >
                    <View className="relative">
                      <Image
                        source={{ uri: item.avatar }}
                        className="w-14 h-14 rounded-full bg-slate-200"
                      />
                      <View
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                          item.online ? "bg-green-500" : "bg-slate-400"
                        }`}
                      />
                    </View>
                    <View className="flex-1 ml-4">
                      <View className="flex-row justify-between items-center mb-0.5">
                        <Text
                          className="text-base font-medium text-zalo-text"
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text className="text-xs text-zalo-gray">
                          {item.time}
                        </Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <View className="flex-1 mr-3">
                          <Text
                            className={`text-[11px] ${item.online ? "text-emerald-600" : "text-slate-400"}`}
                            numberOfLines={1}
                          >
                            {item.online ? "Trực tuyến" : "Ngoại tuyến"}
                          </Text>
                          <Text
                            className={`text-sm ${item.unread > 0 ? "text-zalo-text font-semibold" : "text-zalo-gray"}`}
                            numberOfLines={1}
                          >
                            {displayPreview}
                          </Text>
                        </View>
                        {item.unread > 0 && (
                          <View className="bg-red-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1">
                            <Text className="text-white text-xs font-bold">
                              {item.unread}
                            </Text>
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
