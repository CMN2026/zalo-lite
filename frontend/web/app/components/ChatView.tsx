"use client";
/* eslint-disable @next/next/no-img-element */
/* eslint-disable sonarjs/no-nested-functions */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bell,
  BellOff,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import MessageList, { Message, type MessageReaction } from "./MessageList";
import MessageInput from "./MessageInput";
import CreateGroupModal from "./CreateGroupModal";
import StartConversationModal from "./StartConversationModal";
import GroupDetailPanel from "./GroupDetailPanel";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../contexts/auth";
import { getAuthToken } from "../lib/auth";

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  preview: string;
  time: string;
  online: boolean;
  messages: Message[];
  createdBy?: string;
  type?: "direct" | "group";
  peerId?: string;
}

interface UserSummary {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
}

interface ConversationApi {
  id: string;
  name?: string;
  memberIds: string[];
  createdAt: string;
  createdBy?: string;
  type?: "direct" | "group";
  lastMessageAt?: string | null;
}

type ConversationCacheEntry = {
  id: string;
  name: string;
  avatar: string;
  preview: string;
  time: string;
  online: boolean;
  createdBy?: string;
  type?: "direct" | "group";
  peerId?: string;
};

type SendAckPayload = {
  ok: boolean;
  message_id?: string;
  client_temp_id?: string;
  error?: string;
  conversation_id?: string;
};

interface ChatViewProps {
  onFocusedConversationChange?: (conversationId: string | null) => void;
  unreadByConversation?: Record<string, number>;
  onUnreadByConversationChange?: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;
  mutedByConversation?: Record<string, boolean>;
  onMutedByConversationChange?: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  pendingJump?: {
    conversationId: string;
    messageId?: string;
  } | null;
  onPendingJumpHandled?: () => void;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3004";
const CHAT_SERVICE_BASE_URL =
  process.env.NEXT_PUBLIC_CHAT_SERVICE_URL ?? "http://127.0.0.1:3002";
const USER_SERVICE_BASE_URL =
  process.env.NEXT_PUBLIC_USER_SERVICE_URL ?? "http://127.0.0.1:3001";
const DEFAULT_SYSTEM_PREVIEW = "Hai bạn đã trở thành bạn bè. Hãy gửi lời chào.";
const USER_SUMMARY_CACHE_KEY_PREFIX = "zalo-lite:web:user-summaries:";
const CONVERSATION_CACHE_KEY_PREFIX = "zalo-lite:web:conversations:";

function normalizeConversationId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim().replace(/,+$/, "");
  return normalized.length > 0 ? normalized : null;
}

function toIsoReadTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) {
      return null;
    }

    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      const parsedNumeric = new Date(numeric);
      return Number.isNaN(parsedNumeric.getTime())
        ? null
        : parsedNumeric.toISOString();
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function getConversationPreviewFromMessage(
  message: Message | undefined,
  currentUserId: string,
) {
  if (!message) {
    return DEFAULT_SYSTEM_PREVIEW;
  }

  const basePreview =
    message.type === "file" ? "Tệp đính kèm" : message.content;
  return message.sender_id === currentUserId
    ? `Bạn: ${basePreview}`
    : basePreview;
}

function isResolvedFullName(value: string | undefined, userId: string) {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return normalized !== userId;
}

function mergeUserSummary(
  current: UserSummary | undefined,
  incoming: UserSummary,
): UserSummary {
  if (!current) {
    return incoming;
  }

  const prefersIncomingName =
    !isResolvedFullName(current.fullName, current.id) &&
    isResolvedFullName(incoming.fullName, incoming.id);

  return {
    id: current.id,
    fullName: prefersIncomingName ? incoming.fullName : current.fullName,
    email: current.email || incoming.email,
    phone: current.phone || incoming.phone,
    avatarUrl: current.avatarUrl || incoming.avatarUrl,
  };
}

async function authJsonRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("missing_local_session");
  }

  const extraHeaders = init.headers as Record<string, string> | undefined;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  const method = (init.method ?? "GET").toUpperCase();
  const suffix =
    method === "GET"
      ? `${path.includes("?") ? "&" : "?"}_ts=${Date.now()}`
      : "";

  const fallbackPath = path.startsWith("/api/")
    ? path.slice(4)
    : path;

  const targets = [
    { baseUrl: API_BASE_URL, requestPath: path, tag: "gateway" as const },
    {
      baseUrl: CHAT_SERVICE_BASE_URL,
      requestPath:
        path.startsWith("/api/conversations") ||
        path.startsWith("/api/messages") ||
        path.startsWith("/api/friends")
          ? fallbackPath
          : null,
      tag: "chat-service" as const,
    },
    {
      baseUrl: USER_SERVICE_BASE_URL,
      requestPath: path.startsWith("/api/users") ? fallbackPath : null,
      tag: "user-service" as const,
    },
  ] as const;

  let lastError: Error | null = null;

  for (const target of targets) {
    if (!target.requestPath) {
      continue;
    }

    const timeoutMs = method === "GET" ? 6000 : 10000;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(
        `${target.baseUrl}${target.requestPath}${suffix}`,
        {
          ...init,
          method,
          cache: method === "GET" ? "no-store" : "default",
          headers,
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`http_${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));

      if (typedError.name === "AbortError") {
        lastError = new Error("http_timeout");
      } else {
        lastError = typedError;
      }

      const isConnectivityError =
        typedError.message === "http_timeout" ||
        typedError.message === "Failed to fetch" ||
        typedError.message === "Network request failed";
      const shouldTryNextTarget =
        target.tag === "gateway" &&
        (isConnectivityError || typedError.message.startsWith("http_5"));

      if (!shouldTryNextTarget) {
        throw typedError;
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw (lastError ?? new Error("request_failed"));
}

export default function ChatView({
  onFocusedConversationChange,
  unreadByConversation: externalUnreadByConversation,
  onUnreadByConversationChange,
  mutedByConversation: externalMutedByConversation,
  onMutedByConversationChange,
  pendingJump,
  onPendingJumpHandled,
}: Readonly<ChatViewProps>) {
  const { user } = useAuth();
  const { isConnected, on, off, emit, join, leave } = useSocket();
  const currentUserId = user?.id ?? "";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showStartConversation, setShowStartConversation] = useState(false);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [hasHydratedUserCache, setHasHydratedUserCache] = useState(false);
  const [hasHydratedConversationCache, setHasHydratedConversationCache] =
    useState(false);
  const [localUnreadByConversation, setLocalUnreadByConversation] = useState<
    Record<string, number>
  >({});
  const [localMutedByConversation, setLocalMutedByConversation] = useState<
    Record<string, boolean>
  >({});
  const [blockedByConversation, setBlockedByConversation] = useState<
    Record<
      string,
      {
        isBlocked: boolean;
        blockedByCurrentUser: boolean;
      }
    >
  >({});
  const [chatNotice, setChatNotice] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeConversationActionId, setActiveConversationActionId] = useState<
    string | null
  >(null);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(
    null,
  );
  const [lastReadAtByConversation, setLastReadAtByConversation] = useState<
    Record<string, string>
  >({});

  const unreadByConversation =
    externalUnreadByConversation ?? localUnreadByConversation;
  const setUnreadByConversation =
    onUnreadByConversationChange ?? setLocalUnreadByConversation;
  const shouldTrackUnreadLocally = !onUnreadByConversationChange;
  const mutedByConversation =
    externalMutedByConversation ?? localMutedByConversation;
  const setMutedByConversation =
    onMutedByConversationChange ?? setLocalMutedByConversation;

  const activeChat = conversations.find((item) => item.id === activeChatId);
  const activeBlockState = activeChatId
    ? blockedByConversation[activeChatId]
    : undefined;
  const isComposerBlocked = Boolean(activeBlockState?.isBlocked);
  const composerBlockedMessage = activeBlockState?.blockedByCurrentUser
    ? "Bạn đã chặn người này. Mở chặn để tiếp tục nhắn tin."
    : "Bạn đã bị chặn. Chỉ có thể nhắn lại khi đối phương mở chặn.";
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const isLoadingConversationsRef = useRef(false);
  const conversationsRetryAfterRef = useRef(0);
  const lastReadSyncByConversationRef = useRef<Record<string, string>>({});
  const userSummaryCacheKey = useMemo(
    () =>
      currentUserId
        ? `${USER_SUMMARY_CACHE_KEY_PREFIX}${currentUserId}`
        : USER_SUMMARY_CACHE_KEY_PREFIX,
    [currentUserId],
  );
  const conversationCacheKey = useMemo(
    () =>
      currentUserId
        ? `${CONVERSATION_CACHE_KEY_PREFIX}${currentUserId}`
        : CONVERSATION_CACHE_KEY_PREFIX,
    [currentUserId],
  );

  const markMessageRecalled = useCallback(
    (
      conversationId: string,
      messageId: string,
      recalledAt?: string,
      recalledBy?: string,
    ) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== conversationId) return conv;
          const nextMessages = conv.messages.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  type: "text" as const,
                  content: "Tin nhắn đã được thu hồi",
                  recalled_at: recalledAt,
                  recalled_by: recalledBy,
                  reactions: [] as MessageReaction[],
                  reply_to_message_id: undefined,
                }
              : item,
          );
          const lastMessage = nextMessages[nextMessages.length - 1];

          return {
            ...conv,
            messages: nextMessages,
            preview: getConversationPreviewFromMessage(
              lastMessage,
              currentUserId,
            ),
            time: lastMessage
              ? new Date(lastMessage.created_at).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : conv.time,
          };
        }),
      );
    },
    [currentUserId],
  );

  const setMessageReactions = useCallback(
    (
      conversationId: string,
      messageId: string,
      reactions: MessageReaction[],
    ) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== conversationId) return conv;

          return {
            ...conv,
            messages: conv.messages.map((item) =>
              item.id === messageId ? { ...item, reactions } : item,
            ),
          };
        }),
      );
    },
    [],
  );

  const removeMessageForCurrentUser = useCallback(
    (conversationId: string, messageId: string) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== conversationId) return conv;

          const nextMessages = conv.messages.filter(
            (item) => item.id !== messageId,
          );
          const nextPreview =
            nextMessages.length > 0
              ? getConversationPreviewFromMessage(
                  nextMessages[nextMessages.length - 1],
                  currentUserId,
                )
              : DEFAULT_SYSTEM_PREVIEW;

          return {
            ...conv,
            messages: nextMessages,
            preview: nextPreview,
          };
        }),
      );

      setReplyingTo((current) => (current?.id === messageId ? null : current));
    },
    [currentUserId],
  );

  const resolveSenderName = useCallback(
    (senderId: string) => {
      if (senderId === currentUserId) return user?.fullName || "Bạn";
      const sender = allUsers.find((entry) => entry.id === senderId);
      return sender?.fullName || sender?.email || "Không rõ";
    },
    [allUsers, currentUserId, user?.fullName],
  );

  const enrichMessage = useCallback(
    (message: Message): Message => ({
      ...message,
      sender_name: resolveSenderName(message.sender_id),
    }),
    [resolveSenderName],
  );

  const normalizeFriendUsers = (payload: unknown): UserSummary[] => {
    if (!Array.isArray(payload)) return [];

    return payload.reduce<UserSummary[]>((acc, item) => {
      if (!item || typeof item !== "object") return acc;

      const raw = item as {
        id?: unknown;
        fullName?: unknown;
        email?: unknown;
        phone?: unknown;
        avatarUrl?: unknown;
      };

      if (typeof raw.id !== "string") return acc;
      acc.push({
        id: raw.id,
        fullName: typeof raw.fullName === "string" ? raw.fullName : raw.id,
        email: typeof raw.email === "string" ? raw.email : undefined,
        phone: typeof raw.phone === "string" ? raw.phone : undefined,
        avatarUrl: typeof raw.avatarUrl === "string" ? raw.avatarUrl : null,
      });
      return acc;
    }, []);
  };

  const fetchUsers = useCallback(async () => {
    if (!currentUserId || !getAuthToken()) {
      setAllUsers([]);
      return;
    }

    const merged = new Map<string, UserSummary>();
    const applyUsers = (payload: unknown) => {
      const users = normalizeFriendUsers(payload);
      users.forEach((entry) => {
        merged.set(entry.id, mergeUserSummary(merged.get(entry.id), entry));
      });

      if (merged.size === 0) {
        return;
      }

      setAllUsers((prev) => {
        const next = new Map<string, UserSummary>(
          prev.map((entry) => [entry.id, entry]),
        );

        merged.forEach((entry) => {
          next.set(entry.id, mergeUserSummary(next.get(entry.id), entry));
        });

        return Array.from(next.values());
      });
    };

    try {
      const peerTask = authJsonRequest<{ data?: unknown }>(
        "/api/users/chat-peers",
      )
        .then((response) => {
          applyUsers(response.data);
        })
        .catch(() => {
          // ignore
        });

      const friendTask = authJsonRequest<{ data?: unknown }>(
        "/api/users/friends",
      )
        .then((response) => {
          applyUsers(response.data);
        })
        .catch(() => {
          // ignore
        });

      await Promise.allSettled([peerTask, friendTask]);
      if (merged.size === 0) {
        // Keep previous users to avoid UI flicker when API is temporarily throttled.
        return;
      }
    } catch {
      // Keep previous users to avoid UI flicker when API is temporarily throttled.
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setAllUsers([]);
      setHasHydratedUserCache(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(userSummaryCacheKey);
      if (!raw) {
        setHasHydratedUserCache(true);
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      const cachedUsers = normalizeFriendUsers(parsed);
      if (cachedUsers.length > 0) {
        setAllUsers(cachedUsers);
      }
    } catch {
      // Ignore corrupted cache and continue with network hydration.
    } finally {
      setHasHydratedUserCache(true);
    }
  }, [currentUserId, userSummaryCacheKey]);

  useEffect(() => {
    if (!currentUserId) {
      setConversations([]);
      setHasHydratedConversationCache(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(conversationCacheKey);
      if (!raw) {
        setHasHydratedConversationCache(true);
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setHasHydratedConversationCache(true);
        return;
      }

      const cachedConversations = parsed.reduce<Conversation[]>((acc, item) => {
        if (!item || typeof item !== "object") {
          return acc;
        }

        const rawItem = item as ConversationCacheEntry;
        if (
          typeof rawItem.id !== "string" ||
          typeof rawItem.name !== "string"
        ) {
          return acc;
        }

        acc.push({
          id: rawItem.id,
          name: rawItem.name,
          avatar:
            typeof rawItem.avatar === "string"
              ? rawItem.avatar
              : "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
          preview:
            typeof rawItem.preview === "string"
              ? rawItem.preview
              : DEFAULT_SYSTEM_PREVIEW,
          time: typeof rawItem.time === "string" ? rawItem.time : "",
          online: Boolean(rawItem.online),
          messages: [],
          createdBy: rawItem.createdBy,
          type: rawItem.type,
          peerId: rawItem.peerId,
        });

        return acc;
      }, []);

      if (cachedConversations.length > 0) {
        setConversations(cachedConversations);
        setActiveChatId((prev) => prev ?? cachedConversations[0].id);
        setLoading(false);
      }
    } catch {
      // Ignore broken cache payload.
    } finally {
      setHasHydratedConversationCache(true);
    }
  }, [conversationCacheKey, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const payload: ConversationCacheEntry[] = conversations.map((item) => ({
      id: item.id,
      name: item.name,
      avatar: item.avatar,
      preview: item.preview,
      time: item.time,
      online: item.online,
      createdBy: item.createdBy,
      type: item.type,
      peerId: item.peerId,
    }));

    try {
      window.localStorage.setItem(
        conversationCacheKey,
        JSON.stringify(payload),
      );
    } catch {
      // Ignore cache write failures (private mode/quota).
    }
  }, [conversationCacheKey, conversations, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    try {
      window.localStorage.setItem(
        userSummaryCacheKey,
        JSON.stringify(allUsers),
      );
    } catch {
      // Ignore cache write failures (private mode/quota).
    }
  }, [allUsers, currentUserId, userSummaryCacheKey]);

  const userLookup = useMemo(() => {
    return allUsers.reduce<
      Record<
        string,
        {
          fullName: string;
          email?: string;
          phone?: string;
          avatarUrl?: string | null;
        }
      >
    >((acc, userEntry) => {
      acc[userEntry.id] = {
        fullName: userEntry.fullName,
        email: userEntry.email,
        phone: userEntry.phone,
        avatarUrl: userEntry.avatarUrl,
      };
      return acc;
    }, {});
  }, [allUsers]);

  const fetchLatestMessagesByConversation = useCallback(
    async (conversationIds: string[]) => {
      const entries = await Promise.all(
        conversationIds.map(async (conversationId) => {
          try {
            const response = await authJsonRequest<{ data?: Message[] }>(
              `/api/messages/${conversationId}?limit=1`,
            );
            const latest = (response.data ?? [])[0];
            return [
              conversationId,
              latest ? enrichMessage(latest) : undefined,
            ] as const;
          } catch {
            return [conversationId, undefined] as const;
          }
        }),
      );

      return new Map<string, Message | undefined>(entries);
    },
    [enrichMessage],
  );

  const loadConversations = useCallback(async () => {
    if (!getAuthToken()) {
      setLoading(false);
      return;
    }

    if (isLoadingConversationsRef.current) {
      return;
    }

    if (Date.now() < conversationsRetryAfterRef.current) {
      return;
    }

    isLoadingConversationsRef.current = true;

    try {
      const response = await authJsonRequest<{ data?: unknown }>(
        "/api/conversations",
      );
      const data = (response.data ?? []) as ConversationApi[];

      const mapped = data.reduce<Conversation[]>((acc, conv) => {
        if (conv.type === "group") {
          acc.push({
            id: conv.id,
            name: conv.name || "Nhóm",
            avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=group",
            preview: "Trò chuyện nhóm",
            time: conv.lastMessageAt
              ? new Date(conv.lastMessageAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "",
            online: true,
            messages: [],
            createdBy: conv.createdBy,
            type: "group",
          });
          return acc;
        }

        const otherUserId = conv.memberIds.find((id) => id !== currentUserId);
        if (!otherUserId) return acc;

        const other = allUsers.find((entry) => entry.id === otherUserId);
        const directName =
          other?.fullName ||
          other?.email ||
          (conv.name && conv.name !== "Trò chuyện trực tiếp"
            ? conv.name
            : `Người dùng ${otherUserId.slice(0, 6)}`);
        acc.push({
          id: conv.id,
          name: directName,
          avatar:
            other?.avatarUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`,
          preview: "Hai bạn đã trở thành bạn bè. Hãy gửi lời chào.",
          time: conv.lastMessageAt
            ? new Date(conv.lastMessageAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : new Date(conv.createdAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              }),
          online: true,
          messages: [],
          createdBy: conv.createdBy,
          type: "direct",
          peerId: otherUserId,
        });
        return acc;
      }, []);

      const cachedMessagesByConversation = new Map(
        conversationsRef.current.map((item) => [item.id, item.messages]),
      );

      setConversations((prev) => {
        const currentMessages = new Map(
          prev.map((item) => [item.id, item.messages]),
        );
        return mapped.map((item) => {
          const preservedMessages = currentMessages.get(item.id) ?? [];
          const lastMessage = preservedMessages[preservedMessages.length - 1];

          if (!lastMessage) {
            return {
              ...item,
              messages: preservedMessages,
              preview:
                item.type === "direct" ? DEFAULT_SYSTEM_PREVIEW : item.preview,
            };
          }

          return {
            ...item,
            messages: preservedMessages,
            preview: getConversationPreviewFromMessage(
              lastMessage,
              currentUserId,
            ),
            time: new Date(lastMessage.created_at).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
        });
      });

      if (mapped.length > 0) {
        const availableConversationIds = new Set(mapped.map((item) => item.id));
        const pendingConversationId = pendingJump?.conversationId;

        setActiveChatId((current) => {
          if (current && availableConversationIds.has(current)) {
            return current;
          }

          if (
            pendingConversationId &&
            availableConversationIds.has(pendingConversationId)
          ) {
            return pendingConversationId;
          }

          return mapped[0]?.id ?? null;
        });
      }

      setLoading(false);

      const conversationIdsNeedLatest = mapped
        .filter(
          (item) =>
            (cachedMessagesByConversation.get(item.id)?.length ?? 0) === 0,
        )
        .map((item) => item.id);

      if (conversationIdsNeedLatest.length > 0) {
        void (async () => {
          const latestMessages = await fetchLatestMessagesByConversation(
            conversationIdsNeedLatest,
          );

          setConversations((prev) =>
            prev.map((conv) => {
              if ((conv.messages?.length ?? 0) > 0) {
                return conv;
              }

              const latest = latestMessages.get(conv.id);
              if (!latest) {
                return conv;
              }

              return {
                ...conv,
                messages: [latest],
                preview: getConversationPreviewFromMessage(
                  latest,
                  currentUserId,
                ),
                time: new Date(latest.created_at).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              };
            }),
          );
        })();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "http_429") {
        conversationsRetryAfterRef.current = Date.now() + 15_000;
        return;
      }

      console.error("Failed to load conversations", error);
    } finally {
      isLoadingConversationsRef.current = false;
      setLoading(false);
    }
  }, [
    allUsers,
    currentUserId,
    fetchLatestMessagesByConversation,
    pendingJump?.conversationId,
  ]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const syncConversationReadState = useCallback(
    (conversationId: string, readerUserId: string) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== conversationId) {
            return conv;
          }

          return {
            ...conv,
            messages: conv.messages.map((message) => {
              const readBy = Array.isArray(message.read_by)
                ? message.read_by
                : [];

              if (readBy.includes(readerUserId)) {
                return message;
              }

              return {
                ...message,
                read_by: [...readBy, readerUserId],
              };
            }),
          };
        }),
      );
    },
    [],
  );

  const markConversationAsRead = useCallback(
    async (conversationId: string, force = false) => {
      if (!conversationId || !currentUserId || !getAuthToken()) {
        return;
      }

      const currentConversation = conversationsRef.current.find(
        (conv) => conv.id === conversationId,
      );
      const marker =
        currentConversation?.messages[currentConversation.messages.length - 1]
          ?.id ?? "__empty__";
      const dedupeKey = `${conversationId}:${marker}`;

      if (
        !force &&
        lastReadSyncByConversationRef.current[conversationId] === dedupeKey
      ) {
        return;
      }

      lastReadSyncByConversationRef.current[conversationId] = dedupeKey;

      setUnreadByConversation((prev) => {
        if (!(conversationId in prev)) {
          return prev;
        }

        const next = { ...prev };
        delete next[conversationId];
        return next;
      });

      syncConversationReadState(conversationId, currentUserId);

      emit("message:read", {
        conversation_id: conversationId,
      });

      try {
        await authJsonRequest<{ message?: string }>(
          `/api/messages/${conversationId}/read`,
          {
            method: "PUT",
          },
        );
      } catch {
        // Socket event still carries read receipt when HTTP fallback fails.
      }
    },
    [currentUserId, emit, setUnreadByConversation, syncConversationReadState],
  );

  useEffect(() => {
    if (!hasHydratedUserCache) {
      return;
    }

    void fetchUsers();
  }, [fetchUsers, hasHydratedUserCache]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      void fetchUsers();
    }, 15000);

    return () => {
      clearInterval(timer);
    };
  }, [fetchUsers]);

  useEffect(() => {
    if (!hasHydratedConversationCache) {
      return;
    }

    void loadConversations();
  }, [hasHydratedConversationCache, loadConversations]);

  useEffect(() => {
    if (!hasHydratedConversationCache) {
      return;
    }

    const timer = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      void loadConversations();
    }, 15000);

    return () => {
      clearInterval(timer);
    };
  }, [hasHydratedConversationCache, loadConversations]);

  useEffect(() => {
    if (!hasHydratedConversationCache) {
      return;
    }

    if (!loading) {
      return;
    }

    // Fail-safe: never keep the whole chat shell blocked forever.
    const timer = window.setTimeout(() => {
      setLoading(false);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hasHydratedConversationCache, loading]);

  useEffect(() => {
    setConversations((prev) =>
      prev.map((conv) => ({
        ...conv,
        messages: conv.messages.map((message) => enrichMessage(message)),
      })),
    );
  }, [enrichMessage]);

  useEffect(() => {
    if (allUsers.length === 0) {
      return;
    }

    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.type !== "direct" || !conv.peerId) {
          return conv;
        }

        const peer = allUsers.find((item) => item.id === conv.peerId);
        if (!peer) {
          return conv;
        }

        const nextName =
          peer.fullName ||
          peer.email ||
          peer.phone ||
          `Người dùng ${conv.peerId.slice(0, 6)}`;
        const nextAvatar =
          peer.avatarUrl ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.peerId}`;

        if (conv.name === nextName && conv.avatar === nextAvatar) {
          return conv;
        }

        return {
          ...conv,
          name: nextName,
          avatar: nextAvatar,
        };
      }),
    );
  }, [allUsers]);

  useEffect(() => {
    if (!currentUserId || !getAuthToken()) {
      return;
    }

    const needsNameHydration = conversations.some(
      (conv) =>
        conv.type === "direct" &&
        conv.peerId &&
        conv.name.startsWith("Người dùng "),
    );

    if (!needsNameHydration) {
      return;
    }

    const timer = setTimeout(() => {
      void fetchUsers();
    }, 800);

    return () => {
      clearTimeout(timer);
    };
  }, [conversations, currentUserId, fetchUsers]);

  useEffect(() => {
    if (!activeChatId || !getAuthToken()) return;

    const fetchMessages = async () => {
      const normalizedActiveChatId = normalizeConversationId(activeChatId);
      if (!normalizedActiveChatId) {
        return;
      }

      if (normalizedActiveChatId !== activeChatId) {
        setActiveChatId(normalizedActiveChatId);
        return;
      }

      try {
        const response = await authJsonRequest<{ data?: Message[] }>(
          `/api/messages/${activeChatId}?limit=100`,
        );

        const fetchedMessages = (response.data ?? []).map((item) =>
          enrichMessage(item),
        );
        const lastFetchedMessage = fetchedMessages[fetchedMessages.length - 1];

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeChatId
              ? {
                  ...conv,
                  messages: fetchedMessages,
                  preview: getConversationPreviewFromMessage(
                    lastFetchedMessage,
                    currentUserId,
                  ),
                }
              : conv,
          ),
        );
      } catch (error) {
        console.error("Failed to fetch messages", error);
      }
    };

    void fetchMessages();
  }, [activeChatId, currentUserId, enrichMessage]);

  useEffect(() => {
    if (!activeChatId || !isConnected) return;
    join(activeChatId);
    return () => leave(activeChatId);
  }, [activeChatId, isConnected, join, leave]);

  useEffect(() => {
    if (!activeChatId) {
      return;
    }

    void markConversationAsRead(activeChatId, true);
  }, [activeChatId, markConversationAsRead]);

  useEffect(() => {
    if (!activeChatId || !currentUserId) {
      return;
    }

    const activeConversation = conversations.find(
      (item) => item.id === activeChatId,
    );
    if (!activeConversation) {
      return;
    }

    const hasUnreadFromOthers = activeConversation.messages.some((message) => {
      if (message.sender_id === currentUserId) {
        return false;
      }

      const readBy = Array.isArray(message.read_by) ? message.read_by : [];
      return !readBy.includes(currentUserId);
    });

    if (!hasUnreadFromOthers) {
      return;
    }

    void markConversationAsRead(activeChatId);
  }, [activeChatId, conversations, currentUserId, markConversationAsRead]);

  useEffect(() => {
    if (!pendingJump) {
      return;
    }

    const targetConversationId = normalizeConversationId(
      pendingJump.conversationId,
    );
    if (!targetConversationId) {
      onPendingJumpHandled?.();
      return;
    }

    if (activeChatId !== targetConversationId) {
      setActiveChatId(targetConversationId);
      setReplyingTo(null);
      setActiveConversationActionId(null);
      setUnreadByConversation((prev) => {
        const next = { ...prev };
        delete next[targetConversationId];
        return next;
      });
      return;
    }

    if (pendingJump.messageId) {
      setScrollToMessageId(pendingJump.messageId);
    }

    onPendingJumpHandled?.();
  }, [
    activeChatId,
    onPendingJumpHandled,
    pendingJump,
    setUnreadByConversation,
  ]);

  useEffect(() => {
    onFocusedConversationChange?.(activeChatId);
  }, [activeChatId, onFocusedConversationChange]);

  useEffect(() => {
    const handleSendAck = (payload: unknown) => {
      const ack = payload as SendAckPayload;
      if (!ack.client_temp_id) return;

      setConversations((prev) =>
        prev.map((conv) => {
          const tempIndex = conv.messages.findIndex(
            (item) => item.id === ack.client_temp_id,
          );
          if (tempIndex < 0) return conv;

          if (!ack.ok || !ack.message_id) {
            if (ack.error && ack.conversation_id) {
              if (ack.error.includes("you_blocked_this_user")) {
                setBlockedByConversation((prev) => ({
                  ...prev,
                  [ack.conversation_id as string]: {
                    isBlocked: true,
                    blockedByCurrentUser: true,
                  },
                }));
                setChatNotice(
                  "Bạn đã chặn người này. Mở chặn để tiếp tục nhắn tin.",
                );
              } else if (ack.error.includes("you_are_blocked_by_user")) {
                setBlockedByConversation((prev) => ({
                  ...prev,
                  [ack.conversation_id as string]: {
                    isBlocked: true,
                    blockedByCurrentUser: false,
                  },
                }));
                setChatNotice(
                  "Bạn đã bị chặn. Chỉ có thể nhắn lại khi đối phương mở chặn.",
                );
              }
            }

            return {
              ...conv,
              messages: conv.messages.filter(
                (item) => item.id !== ack.client_temp_id,
              ),
            };
          }

          if (conv.messages.some((item) => item.id === ack.message_id)) {
            return {
              ...conv,
              messages: conv.messages.filter(
                (item) => item.id !== ack.client_temp_id,
              ),
            };
          }

          const nextMessages = [...conv.messages];
          nextMessages[tempIndex] = {
            ...nextMessages[tempIndex],
            id: ack.message_id,
          };

          return { ...conv, messages: nextMessages };
        }),
      );
    };

    const handleMessageReceive = (payload: unknown) => {
      const incoming = enrichMessage(payload as Message);

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== incoming.conversation_id) return conv;
          if (conv.messages.some((item) => item.id === incoming.id)) {
            return conv;
          }

          return {
            ...conv,
            messages: [...conv.messages, incoming],
            preview: getConversationPreviewFromMessage(incoming, currentUserId),
            time: new Date(incoming.created_at).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
        }),
      );

      if (
        incoming.sender_id !== currentUserId &&
        incoming.conversation_id !== activeChatId &&
        shouldTrackUnreadLocally
      ) {
        setUnreadByConversation((prev) => ({
          ...prev,
          [incoming.conversation_id]: (prev[incoming.conversation_id] ?? 0) + 1,
        }));
      }

      if (
        incoming.sender_id !== currentUserId &&
        incoming.conversation_id === activeChatId
      ) {
        void markConversationAsRead(incoming.conversation_id);
      }
    };

    const handleReadReceipt = (payload: unknown) => {
      const data = payload as {
        conversation_id?: unknown;
        conversationId?: unknown;
        user_id?: unknown;
        userId?: unknown;
        timestamp?: unknown;
        read_at?: unknown;
        readAt?: unknown;
      };

      const conversationId = normalizeConversationId(
        data.conversation_id ?? data.conversationId,
      );
      if (!conversationId) {
        return;
      }

      const readerIdRaw = data.user_id ?? data.userId;
      const readerId =
        typeof readerIdRaw === "string" ? readerIdRaw.trim() : "";
      if (!readerId) {
        return;
      }

      syncConversationReadState(conversationId, readerId);

      const readAt = toIsoReadTimestamp(
        data.timestamp ?? data.read_at ?? data.readAt,
      );
      if (readerId !== currentUserId && readAt) {
        setLastReadAtByConversation((prev) => {
          if (prev[conversationId] === readAt) {
            return prev;
          }

          return {
            ...prev,
            [conversationId]: readAt,
          };
        });
      }

      if (readerId === currentUserId) {
        setUnreadByConversation((prev) => {
          if (!(conversationId in prev)) {
            return prev;
          }

          const next = { ...prev };
          delete next[conversationId];
          return next;
        });
      }
    };

    const handleRecalled = (payload: unknown) => {
      const data = payload as {
        message_id: string;
        conversation_id: string;
        recalled_at?: string;
        recalled_by?: string;
      };
      markMessageRecalled(
        data.conversation_id,
        data.message_id,
        data.recalled_at,
        data.recalled_by,
      );
    };

    const handleRecallAck = (payload: unknown) => {
      const data = payload as {
        ok?: boolean;
        message_id?: string;
        conversation_id?: string;
      };

      if (!data.ok || !data.message_id || !data.conversation_id) {
        return;
      }

      markMessageRecalled(data.conversation_id, data.message_id);
    };

    const handleReactionUpdated = (payload: unknown) => {
      const data = payload as {
        message_id: string;
        conversation_id: string;
        reactions: MessageReaction[];
      };

      setMessageReactions(
        data.conversation_id,
        data.message_id,
        data.reactions,
      );
    };

    const handleReactionAck = (payload: unknown) => {
      const data = payload as {
        ok?: boolean;
        message_id?: string;
        conversation_id?: string;
      };

      if (!data.ok || !data.message_id || !data.conversation_id) {
        return;
      }

      void loadConversations();
    };

    const handleDeleteAck = (payload: unknown) => {
      const data = payload as {
        ok?: boolean;
        message_id?: string;
        conversation_id?: string;
      };

      if (!data.ok || !data.message_id || !data.conversation_id) {
        return;
      }

      removeMessageForCurrentUser(data.conversation_id, data.message_id);
    };

    const handleActionError = (payload: unknown) => {
      console.error("Message action error", payload);
      void loadConversations();
    };

    const handleTyping = (payload: unknown) => {
      const data = payload as { conversation_id: string };
      if (data.conversation_id !== activeChatId) return;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {}, 3000);
    };

    const handleMessageDeleted = (payload: unknown) => {
      const data = payload as {
        message_id?: string;
        conversation_id?: string;
      };

      if (!data.message_id || !data.conversation_id) {
        return;
      }

      removeMessageForCurrentUser(data.conversation_id, data.message_id);
    };

    const handleReplyNotification = (payload: unknown) => {
      const data = payload as {
        conversation_id?: string;
      };

      const conversationId = data.conversation_id;
      if (!conversationId) {
        return;
      }

      void loadConversations();
    };

    on("message:send_ack", handleSendAck);
    on("message:receive", handleMessageReceive);
    on("message:typing", handleTyping);
    on("message:read_receipt", handleReadReceipt);
    on("message:deleted", handleMessageDeleted);
    on("message:recalled", handleRecalled);
    on("message:recall_ack", handleRecallAck);
    on("message:reaction_updated", handleReactionUpdated);
    on("message:reaction_ack", handleReactionAck);
    on("message:delete_ack", handleDeleteAck);
    on("message:delete_error", handleActionError);
    on("message:recall_error", handleActionError);
    on("message:reaction_error", handleActionError);
    on("notification:reply", handleReplyNotification);

    return () => {
      off("message:send_ack", handleSendAck);
      off("message:receive", handleMessageReceive);
      off("message:typing", handleTyping);
      off("message:read_receipt", handleReadReceipt);
      off("message:deleted", handleMessageDeleted);
      off("message:recalled", handleRecalled);
      off("message:recall_ack", handleRecallAck);
      off("message:reaction_updated", handleReactionUpdated);
      off("message:reaction_ack", handleReactionAck);
      off("message:delete_ack", handleDeleteAck);
      off("message:delete_error", handleActionError);
      off("message:recall_error", handleActionError);
      off("message:reaction_error", handleActionError);
      off("notification:reply", handleReplyNotification);
    };
  }, [
    activeChatId,
    currentUserId,
    emit,
    enrichMessage,
    loadConversations,
    markMessageRecalled,
    off,
    on,
    removeMessageForCurrentUser,
    markConversationAsRead,
    setMessageReactions,
    setUnreadByConversation,
    syncConversationReadState,
    shouldTrackUnreadLocally,
  ]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !activeChatId || isComposerBlocked) return;

    const replyTarget = replyingTo;
    setReplyingTo(null);

    try {
      const response = await authJsonRequest<{ data?: Message }>(
        "/api/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: activeChatId,
            type: "text",
            content,
            reply_to_message_id: replyTarget?.id,
          }),
        },
      );

      const serverMessage = response.data ? enrichMessage(response.data) : null;
      if (!serverMessage) {
        return;
      }

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== activeChatId) {
            return conv;
          }

          if (conv.messages.some((item) => item.id === serverMessage.id)) {
            return conv;
          }

          const nextMessages = [...conv.messages, serverMessage];
          const lastMessage = nextMessages[nextMessages.length - 1];

          return {
            ...conv,
            messages: nextMessages,
            preview: getConversationPreviewFromMessage(
              lastMessage,
              currentUserId,
            ),
            time: new Date(lastMessage.created_at).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
        }),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage !== "http_404") {
        console.error("Failed to send message", error);
        if (errorMessage === "http_403") {
          setChatNotice("Không thể gửi tin nhắn trong cuộc trò chuyện này.");
        }
        setReplyingTo(replyTarget ?? null);
        return;
      }

      const tempId = `tmp-${Date.now()}`;
      const optimistic: Message = {
        id: tempId,
        conversation_id: activeChatId,
        sender_id: currentUserId,
        type: "text",
        content,
        created_at: new Date().toISOString(),
        read_by: [currentUserId],
        sender_name: user?.fullName || "You",
        reply_to_message_id: replyTarget?.id,
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeChatId
            ? {
                ...conv,
                messages: [...conv.messages, optimistic],
                preview: `Bạn: ${content}`,
                time: new Date().toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }
            : conv,
        ),
      );

      emit("message:send", {
        conversation_id: activeChatId,
        type: "text",
        content,
        client_temp_id: tempId,
        reply_to_message_id: replyTarget?.id,
      });
    }
  };

  const handleSendFile = async (file: File, caption?: string) => {
    if (!activeChatId || isComposerBlocked) return;
    const token = getAuthToken();
    if (!token) return;

    const normalizedConversationId = normalizeConversationId(activeChatId);
    if (!normalizedConversationId) {
      setChatNotice("Không xác định được cuộc trò chuyện để gửi file.");
      return;
    }

    try {
      const sendUpload = async (baseUrl: string) => {
        const formData = new FormData();
        formData.append("file", file);
        if (caption) {
          formData.append("content", caption);
        }

        return fetch(
          `${baseUrl}/api/messages/${encodeURIComponent(normalizedConversationId)}/upload`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );
      };

      let lastUploadError: unknown;
      const attemptUpload = async (baseUrl: string) => {
        try {
          return await sendUpload(baseUrl);
        } catch (error) {
          lastUploadError = error;
          return null;
        }
      };

      let response = await attemptUpload(API_BASE_URL);
      if (response?.status && response.status >= 500) {
        // Retry once for transient gateway/service hiccups.
        const retry = await attemptUpload(API_BASE_URL);
        if (retry) {
          response = retry;
        }
      }

      if (
        (!response || (!response.ok && response.status >= 500)) &&
        CHAT_SERVICE_BASE_URL !== API_BASE_URL
      ) {
        // Gateway can fail multipart with connection aborts; fallback to chat-service directly.
        let directResponse = await attemptUpload(CHAT_SERVICE_BASE_URL);
        if (directResponse?.status && directResponse.status >= 500) {
          const retryDirect = await attemptUpload(CHAT_SERVICE_BASE_URL);
          if (retryDirect) {
            directResponse = retryDirect;
          }
        }

        if (directResponse) {
          response = directResponse;
        }
      }

      if (!response) {
        throw lastUploadError ?? new Error("upload_network_error");
      }

      if (!response.ok) {
        let backendMessage = "";
        try {
          const body = (await response.json()) as { message?: string };
          backendMessage = typeof body.message === "string" ? body.message : "";
        } catch {
          backendMessage = "";
        }

        throw new Error(
          backendMessage
            ? `http_${response.status}:${backendMessage}`
            : `http_${response.status}`,
        );
      }

      const payload = (await response.json()) as { data?: Message };
      const newMessage = payload.data as Message;
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== normalizedConversationId) {
            return conv;
          }

          if (conv.messages.some((item) => item.id === newMessage.id)) {
            return conv;
          }

          const enrichedMessage = enrichMessage(newMessage);
          const nextMessages = [...conv.messages, enrichedMessage];
          const lastMessage = nextMessages[nextMessages.length - 1];

          return {
            ...conv,
            messages: nextMessages,
            preview: getConversationPreviewFromMessage(
              lastMessage,
              currentUserId,
            ),
            time: new Date(lastMessage.created_at).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
        }),
      );
      setReplyingTo(null);
    } catch (error) {
      console.error("File upload error", error);
      const errorMessage = error instanceof Error ? error.message : "";
      if (
        errorMessage === "http_403" ||
        errorMessage.includes(":you_blocked_this_user") ||
        errorMessage.includes(":you_are_blocked_by_user")
      ) {
        setChatNotice("Không thể gửi tệp trong cuộc trò chuyện này.");
      } else if (errorMessage.includes(":file_type_not_supported")) {
        setChatNotice("Định dạng file chưa được hỗ trợ.");
      } else if (errorMessage.includes(":file_too_large")) {
        setChatNotice("File vượt quá dung lượng cho phép (tối đa 50MB).");
      } else if (errorMessage.startsWith("http_415")) {
        setChatNotice("Định dạng file chưa được hỗ trợ.");
      } else if (errorMessage.startsWith("http_413")) {
        setChatNotice("File vượt quá dung lượng cho phép (tối đa 50MB).");
      } else if (errorMessage.includes(":file_upload_invalid_form")) {
        setChatNotice("Lỗi dữ liệu tải lên. Vui lòng thử lại.");
      } else if (
        errorMessage === "upload_network_error" ||
        errorMessage.includes("Failed to fetch")
      ) {
        setChatNotice("Không thể kết nối dịch vụ upload. Vui lòng thử lại.");
      } else {
        setChatNotice("Không thể gửi file lúc này. Vui lòng thử lại.");
      }
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveChatId(conversationId);
    setScrollToMessageId(null);
    setReplyingTo(null);
    setActiveConversationActionId(null);
    setUnreadByConversation((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
    setChatNotice("");
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  const handleRecall = async (message: Message) => {
    try {
      const response = await authJsonRequest<{ data?: Message }>(
        `/api/messages/${message.id}/recall`,
        {
          method: "PATCH",
        },
      );

      markMessageRecalled(
        message.conversation_id,
        message.id,
        response.data?.recalled_at,
        response.data?.recalled_by,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage !== "http_404") {
        console.error("Failed to recall message", error);
        return;
      }

      emit("message:recall", {
        message_id: message.id,
        conversation_id: message.conversation_id,
      });

      markMessageRecalled(message.conversation_id, message.id);
    }
  };

  const handleReact = (
    message: Message,
    reaction?: MessageReaction["reaction"],
  ) => {
    void (async () => {
      try {
        const response = await authJsonRequest<{ data?: Message }>(
          `/api/messages/${message.id}/reaction`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ reaction }),
          },
        );

        setMessageReactions(
          message.conversation_id,
          message.id,
          response.data?.reactions ?? [],
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage !== "http_404") {
          console.error("Failed to react message", error);
          return;
        }

        emit("message:react", {
          message_id: message.id,
          conversation_id: message.conversation_id,
          reaction,
        });

        const currentReactions = message.reactions ?? [];
        const withoutMine = currentReactions.filter(
          (item) => item.user_id !== currentUserId,
        );
        const nextReactions: MessageReaction[] = reaction
          ? [
              ...withoutMine,
              {
                user_id: currentUserId,
                reaction,
                created_at: new Date().toISOString(),
              },
            ]
          : withoutMine;
        setMessageReactions(message.conversation_id, message.id, nextReactions);
      }
    })();
  };

  const handleDeleteMessage = (message: Message) => {
    void (async () => {
      try {
        await authJsonRequest<{ message?: string }>(
          `/api/messages/${message.id}`,
          {
            method: "DELETE",
          },
        );

        removeMessageForCurrentUser(message.conversation_id, message.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage !== "http_404") {
          console.error("Failed to delete message for current user", error);
          return;
        }

        emit("message:delete", {
          message_id: message.id,
          conversation_id: message.conversation_id,
        });

        removeMessageForCurrentUser(message.conversation_id, message.id);
      }
    })();
  };

  const handleDeleteConversationForMe = async (conversationId: string) => {
    try {
      await authJsonRequest<{ message?: string }>(
        `/api/conversations/${conversationId}/hide`,
        {
          method: "POST",
        },
      );

      setConversations((prev) =>
        prev.filter((item) => item.id !== conversationId),
      );
      setMutedByConversation((prev) => {
        if (!(conversationId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });

      if (activeChatId === conversationId) {
        const next = conversations.find((item) => item.id !== conversationId);
        setActiveChatId(next?.id ?? null);
        setReplyingTo(null);
      }
    } catch (error) {
      console.error("Failed to hide conversation", error);
    } finally {
      setActiveConversationActionId(null);
    }
  };

  const handleStartDirectConversation = useCallback(
    async (friend: {
      id: string;
      fullName: string;
      email?: string;
      phone?: string | null;
      avatarUrl?: string | null;
    }) => {
      const response = await authJsonRequest<{
        data?: {
          id?: string;
        };
      }>("/api/conversations/direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: friend.id }),
      });

      setAllUsers((prev) => {
        const existing = prev.find((item) => item.id === friend.id);
        const nextFriend: UserSummary = {
          id: friend.id,
          fullName: friend.fullName,
          email: friend.email,
          phone: friend.phone ?? undefined,
          avatarUrl: friend.avatarUrl ?? null,
        };

        if (!existing) {
          return [...prev, nextFriend];
        }

        return prev.map((item) =>
          item.id === friend.id ? mergeUserSummary(item, nextFriend) : item,
        );
      });

      const createdConversationId = normalizeConversationId(response.data?.id);
      if (createdConversationId) {
        setActiveChatId(createdConversationId);
      }

      await loadConversations();
    },
    [loadConversations],
  );

  const handleBlockStateChange = useCallback(
    (state: { isBlocked: boolean; blockedByCurrentUser: boolean }) => {
      if (!activeChatId) {
        return;
      }

      setBlockedByConversation((prev) => ({
        ...prev,
        [activeChatId]: state,
      }));

      if (state.isBlocked) {
        setChatNotice(
          state.blockedByCurrentUser
            ? "Bạn đã chặn người này. Mở chặn để tiếp tục nhắn tin."
            : "Bạn đã bị chặn. Chỉ có thể nhắn lại khi đối phương mở chặn.",
        );
        return;
      }

      setChatNotice("");
    },
    [activeChatId],
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredConversations = conversations.filter((chat) =>
    normalizedSearch
      ? chat.name.toLowerCase().includes(normalizedSearch)
      : true,
  );
  return (
    <div className="flex h-full w-full bg-[#dfe3e9] font-sans text-slate-800">
      <div className="w-[320px] border-r border-slate-200/80 bg-[#f5f7fb]">
        <div className="p-5 flex items-center justify-between">
          <h1 className="text-[34px] leading-none font-bold tracking-tight">
            Chats
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowStartConversation(true)}
              className="p-1.5 rounded-full text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
              title="Mở cuộc trò chuyện mới"
              aria-label="Mở cuộc trò chuyện mới"
            >
              <Plus className="w-5 h-5" />
            </button>
            <Bell className="w-5 h-5 text-slate-500" />
          </div>
        </div>

        <div className="px-4 pb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm cuộc trò chuyện"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full bg-[#eef1f6] text-sm rounded-full py-2.5 pl-9 pr-4 outline-none"
            />
          </div>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            title="Tạo nhóm"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>

        <div className="h-[calc(100%-180px)] overflow-y-auto px-3 pb-4">
          {loading ? (
            <div className="p-4 text-center text-slate-500">Đang tải...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              Chưa có cuộc trò chuyện nào
            </div>
          ) : (
            filteredConversations.map((chat) => (
              <div
                key={chat.id}
                className={`w-full p-3 mb-2 rounded-xl flex gap-3 text-left transition-colors ${
                  activeChatId === chat.id
                    ? "bg-[#ebeff5]"
                    : "hover:bg-[#eef2f8]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectConversation(chat.id)}
                  className="flex flex-1 min-w-0 gap-3 text-left"
                >
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[11px] font-bold text-blue-600 tracking-wide truncate">
                        {chat.type === "group" ? "NHÓM" : "CÁ NHÂN"}
                      </p>
                      <div className="flex items-center gap-1">
                        {mutedByConversation[chat.id] && (
                          <BellOff className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        {unreadByConversation[chat.id] > 0 && (
                          <span
                            className={`inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full text-[10px] font-semibold ${
                              mutedByConversation[chat.id]
                                ? "bg-slate-300 text-slate-600"
                                : "bg-rose-500 text-white"
                            }`}
                          >
                            {unreadByConversation[chat.id]}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {chat.time}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-[16px] leading-tight font-semibold text-slate-800 truncate mb-1">
                      {chat.name}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">
                      {chat.preview}
                    </p>
                  </div>
                </button>

                <div className="relative self-start">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveConversationActionId((current) =>
                        current === chat.id ? null : chat.id,
                      );
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Mở thao tác cuộc trò chuyện"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeConversationActionId === chat.id && (
                    <div className="absolute right-0 z-20 mt-1 min-w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteConversationForMe(chat.id);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa cuộc trò chuyện
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-slate-200/70 text-xs text-slate-500">
          Bạn bè đã kết bạn sẽ tự động hiện trong danh sách chat.
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[#dde1e7]">
        {activeChat ? (
          <>
            <div className="h-16 bg-[#f5f7fa] border-b border-slate-200 px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={activeChat.avatar}
                  alt={activeChat.name}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <h2 className="text-[16px] leading-none font-semibold">
                    {activeChat.name}
                  </h2>
                  <div className="text-xs text-slate-500">
                    {activeChat.online ? "Trực tuyến" : "Ngoại tuyến"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700 transition-colors"
                aria-label="Thao tác khác"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <MessageList
              messages={activeChat.messages}
              currentUserId={currentUserId}
              conversationName={activeChat.name}
              readAt={lastReadAtByConversation[activeChat.id] ?? null}
              isLoading={loading}
              showSenderAvatar
              scrollToMessageId={scrollToMessageId}
              onScrolledToMessage={() => setScrollToMessageId(null)}
              onReply={handleReply}
              onRecall={handleRecall}
              onReact={handleReact}
              onDelete={handleDeleteMessage}
            />

            <MessageInput
              onSendMessage={handleSendMessage}
              onSendFile={handleSendFile}
              isLoading={loading}
              isConnected={Boolean(getAuthToken())}
              disabled={isComposerBlocked}
              disabledMessage={composerBlockedMessage}
              replyToMessagePreview={
                replyingTo
                  ? replyingTo.type === "file"
                    ? "Tệp đính kèm"
                    : replyingTo.content
                  : undefined
              }
              onCancelReply={() => setReplyingTo(null)}
            />
            {chatNotice && (
              <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                {chatNotice}
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col">
            <div className="h-16 bg-[#f5f7fa] border-b border-slate-200 px-6 flex items-center">
              <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse" />
              <div className="ml-3 space-y-1">
                <div className="h-3 w-28 rounded bg-slate-200 animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-slate-200 animate-pulse" />
              </div>
            </div>
            <div className="flex-1 p-6 text-slate-500">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-10 w-2/3 rounded-2xl bg-slate-200 animate-pulse" />
                  <div className="h-10 w-1/2 rounded-2xl bg-slate-200 animate-pulse ml-auto" />
                  <div className="h-10 w-3/5 rounded-2xl bg-slate-200 animate-pulse" />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  Chọn một cuộc trò chuyện để bắt đầu nhắn tin
                </div>
              )}
            </div>
            <div className="h-[72px] border-t border-slate-200 bg-white px-4 flex items-center">
              <div className="h-10 w-full rounded-full bg-slate-100" />
            </div>
          </div>
        )}
      </div>

      {activeChat ? (
        <GroupDetailPanel
          conversationId={activeChat.id}
          conversationType={activeChat.type ?? "direct"}
          messages={activeChat.messages}
          userLookup={userLookup}
          isMuted={Boolean(mutedByConversation[activeChat.id])}
          onToggleMute={(muted: boolean) => {
            setMutedByConversation((prev) => {
              if (!muted) {
                const next = { ...prev };
                delete next[activeChat.id];
                return next;
              }

              return {
                ...prev,
                [activeChat.id]: true,
              };
            });
          }}
          onBlockStateChange={handleBlockStateChange}
          onConversationUpdated={() => void loadConversations()}
          onConversationDeleted={() => {
            setActiveChatId(null);
            void loadConversations();
          }}
        />
      ) : (
        <div className="w-80 border-l border-slate-200 bg-[#f5f7fb] flex flex-col">
          <div className="p-6 border-b border-slate-200/70">
            <div className="mx-auto h-16 w-16 rounded-full bg-slate-200 animate-pulse" />
            <div className="mt-3 h-3 w-32 mx-auto rounded bg-slate-200 animate-pulse" />
            <div className="mt-2 h-2.5 w-24 mx-auto rounded bg-slate-200 animate-pulse" />
          </div>

          <div className="p-4 border-b border-slate-200/70">
            <div className="h-3 w-28 rounded bg-slate-200 animate-pulse mb-3" />
            <div className="h-9 w-full rounded-lg bg-slate-100" />
            <div className="mt-2 h-9 w-full rounded-lg bg-slate-100" />
          </div>

          <div className="p-4 border-b border-slate-200/70">
            <div className="h-3 w-20 rounded bg-slate-200 animate-pulse mb-3" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 rounded bg-slate-100" />
              <div className="h-16 rounded bg-slate-100" />
              <div className="h-16 rounded bg-slate-100" />
            </div>
          </div>

          <div className="p-4 text-xs text-slate-500">
            Chọn hội thoại để xem thông tin chi tiết ở đây.
          </div>
        </div>
      )}

      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={(conversationId) => {
          setActiveChatId(conversationId);
          void loadConversations();
        }}
      />
      <StartConversationModal
        open={showStartConversation}
        onClose={() => setShowStartConversation(false)}
        onSelectFriend={handleStartDirectConversation}
      />
    </div>
  );
}
