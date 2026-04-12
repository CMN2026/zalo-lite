"use client";
/* eslint-disable @next/next/no-img-element */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Bell, MoreVertical, Search } from "lucide-react";
import MessageList, { Message } from "./MessageList";
import MessageInput from "./MessageInput";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../contexts/auth";
import { getAuthToken } from "../lib/auth";
import axios from "axios";

interface ChatViewProps {
  onUnreadCountChange?: (count: number) => void;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  preview: string;
  time: string;
  online: boolean;
  email?: string;
  messages: Message[];
  created_by?: string;
  type?: "direct" | "group";
  targetUserId?: string;
}

interface UserSummary {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  role?: "USER" | "ADMIN";
}

interface ConversationApi {
  id: string;
  name?: string;
  member_ids?: string[];
  created_at: string;
  created_by?: string;
  type?: "direct" | "group";
}

interface SocketSendAck {
  ok: boolean;
  message_id?: string;
  conversation_id?: string;
  client_temp_id?: string;
  error?: string;
}

interface SocketTypingPayload {
  conversation_id: string;
  user_id: string;
}

interface SocketReadReceiptPayload {
  conversation_id?: string;
  user_id?: string;
  conversationId?: string;
  userId?: string;
}

interface SocketMessageDeletedPayload {
  conversation_id: string;
  message_id: string;
}

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

const rawChatServiceUrl = process.env.NEXT_PUBLIC_CHAT_SERVICE_URL;
const rawUserServiceUrl = process.env.NEXT_PUBLIC_USER_SERVICE_URL;
const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

const CHAT_SERVICE_URL =
  rawChatServiceUrl && /^https?:\/\//i.test(rawChatServiceUrl)
    ? rawChatServiceUrl
    : "http://localhost:3002";

const USER_SERVICE_URL =
  rawUserServiceUrl && /^https?:\/\//i.test(rawUserServiceUrl)
    ? rawUserServiceUrl
    : rawApiBaseUrl && /^https?:\/\//i.test(rawApiBaseUrl)
      ? rawApiBaseUrl
      : "http://localhost:3001";

const getUnreadStorageKey = (userId: string) => `chat-unread:${userId}`;

export default function ChatView({ onUnreadCountChange }: ChatViewProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      message: string;
      sender: string;
      avatar: string;
      conversationId: string;
    }>
  >([]);
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [unreadByConversation, setUnreadByConversation] = useState<
    Record<string, number>
  >({});
  const safeSearchTerm = typeof searchTerm === "string" ? searchTerm : "";
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { isConnected, on, off, emit, join, leave } = useSocket();

  const currentUserId = user?.id || "";
  const currentUserIdRef = useRef(currentUserId);
  const conversationsRef = useRef<Conversation[]>([]);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const activeChat =
    conversations.find((c) => c.id === activeChatId) ||
    (conversations.length > 0 ? conversations[0] : undefined);

  const loadUnreadCountsFromServer = useCallback(
    async (conversationIds: string[], token: string) => {
      if (!currentUserId || conversationIds.length === 0) {
        return;
      }

      const allowedConversationIds = new Set(conversationIds);

      const unreadEntries = await Promise.all(
        conversationIds.map(async (conversationId) => {
          try {
            const response = await axios.get(
              `${CHAT_SERVICE_URL}/messages/${conversationId}?limit=100`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            const messages = (response.data?.data ?? []) as Message[];
            const unreadCount = messages.reduce((count, msg) => {
              const readBy = Array.isArray(msg.read_by) ? msg.read_by : [];
              const isUnreadForCurrentUser =
                msg.sender_id !== currentUserId &&
                !readBy.includes(currentUserId);

              return isUnreadForCurrentUser ? count + 1 : count;
            }, 0);

            return [conversationId, unreadCount] as const;
          } catch {
            return [conversationId, 0] as const;
          }
        }),
      );

      const unreadFromServer = unreadEntries.reduce<Record<string, number>>(
        (acc, [conversationId, count]) => {
          if (count > 0) {
            acc[conversationId] = count;
          }
          return acc;
        },
        {},
      );

      setUnreadByConversation((prev) => {
        const next: Record<string, number> = {};

        // Keep local unread for known conversations and never decrease it
        // unless user explicitly opens that conversation.
        for (const conversationId of conversationIds) {
          const localCount = prev[conversationId] ?? 0;
          const serverCount = unreadFromServer[conversationId] ?? 0;
          const merged = Math.max(localCount, serverCount);

          if (merged > 0) {
            next[conversationId] = merged;
          }
        }

        // Preserve any local unread entries that may not be in the freshly
        // loaded list yet (temporary race during conversation refresh).
        for (const [conversationId, count] of Object.entries(prev)) {
          if (!allowedConversationIds.has(conversationId) && count > 0) {
            next[conversationId] = count;
          }
        }

        return next;
      });
    },
    [currentUserId],
  );

  const normalizeUsers = (payload: unknown): UserSummary[] => {
    const source = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === "object" &&
          Array.isArray((payload as { items?: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : [];

    return source.reduce<UserSummary[]>((acc, item) => {
      if (!item || typeof item !== "object") {
        return acc;
      }

      const candidate = item as {
        id?: unknown;
        fullName?: unknown;
        email?: unknown;
        phone?: unknown;
        avatarUrl?: unknown;
        role?: unknown;
      };

      if (
        typeof candidate.id !== "string" ||
        typeof candidate.fullName !== "string"
      ) {
        return acc;
      }

      acc.push({
        id: candidate.id,
        fullName: candidate.fullName,
        email:
          typeof candidate.email === "string" ? candidate.email : undefined,
        phone:
          typeof candidate.phone === "string" ? candidate.phone : undefined,
        avatarUrl:
          typeof candidate.avatarUrl === "string"
            ? candidate.avatarUrl
            : undefined,
        role:
          candidate.role === "ADMIN" || candidate.role === "USER"
            ? candidate.role
            : undefined,
      });

      return acc;
    }, []);
  };

  const getMessagePreview = useCallback((message: Message) => {
    if (message.type !== "file") {
      return message.content.substring(0, 50);
    }

    try {
      const parsed = JSON.parse(message.content) as {
        text?: string;
        file?: { originalName?: string; filename?: string };
        file_name?: string;
      };

      if (parsed.text && parsed.text.trim().length > 0) {
        return parsed.text.substring(0, 50);
      }

      const name =
        parsed.file?.originalName || parsed.file_name || parsed.file?.filename;
      return name ? `📎 ${name}` : "📎 Attachment";
    } catch {
      return "📎 Attachment";
    }
  }, []);

  const loadConversationSummariesFromServer = useCallback(
    async (conversationIds: string[], token: string) => {
      if (conversationIds.length === 0) {
        return {} as Record<string, { preview: string; time: string }>;
      }

      const summaryEntries = await Promise.all(
        conversationIds.map(async (conversationId) => {
          try {
            const response = await axios.get(
              `${CHAT_SERVICE_URL}/messages/${conversationId}?limit=1`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            const latestMessage = (
              response.data?.data as Message[] | undefined
            )?.[0];
            if (!latestMessage) {
              return [conversationId, null] as const;
            }

            return [
              conversationId,
              {
                preview: getMessagePreview(latestMessage),
                time: new Date(latestMessage.created_at).toLocaleTimeString(
                  "vi-VN",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                ),
              },
            ] as const;
          } catch {
            return [conversationId, null] as const;
          }
        }),
      );

      return summaryEntries.reduce<
        Record<string, { preview: string; time: string }>
      >((acc, [conversationId, summary]) => {
        if (summary) {
          acc[conversationId] = summary;
        }
        return acc;
      }, {});
    },
    [getMessagePreview],
  );

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setUnreadByConversation({});
      return;
    }

    try {
      const saved = localStorage.getItem(getUnreadStorageKey(currentUserId));
      if (!saved) {
        setUnreadByConversation({});
        return;
      }

      const parsed = JSON.parse(saved) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setUnreadByConversation({});
        return;
      }

      const normalized = Object.entries(
        parsed as Record<string, unknown>,
      ).reduce<Record<string, number>>((acc, [conversationId, count]) => {
        if (typeof count === "number" && Number.isFinite(count) && count > 0) {
          acc[conversationId] = Math.floor(count);
        }
        return acc;
      }, {});

      setUnreadByConversation(normalized);
    } catch {
      setUnreadByConversation({});
    }
  }, [currentUserId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    try {
      localStorage.setItem(
        getUnreadStorageKey(currentUserId),
        JSON.stringify(unreadByConversation),
      );
    } catch {
      // Ignore quota/private mode errors for unread cache.
    }
  }, [currentUserId, unreadByConversation]);

  useEffect(() => {
    const totalUnread = Object.values(unreadByConversation).reduce(
      (sum, count) => sum + count,
      0,
    );
    onUnreadCountChange?.(totalUnread);
  }, [unreadByConversation, onUnreadCountChange]);

  // Fetch all users from backend
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.id) {
        setAllUsers([]);
        return;
      }

      try {
        const token = getAuthToken();
        if (!token) {
          setAllUsers([]);
          return;
        }

        const baseUrls = Array.from(
          new Set(
            [USER_SERVICE_URL, rawApiBaseUrl]
              .filter((item): item is string => Boolean(item))
              .map((item) => item.replace(/\/$/, "")),
          ),
        );

        const candidates: Array<{ path: string; optional: boolean }> = [
          { path: "/users/chat-peers", optional: false },
          { path: "/api/users/chat-peers", optional: false },
          { path: "/users/friends", optional: false },
          { path: "/api/users/friends", optional: false },
          { path: "/users/dev/list-all", optional: true },
          { path: "/api/users/dev/list-all", optional: true },
        ];

        let fallbackUsers: UserSummary[] = [];

        for (const base of baseUrls) {
          for (const candidate of candidates) {
            try {
              const response = await axios.get(`${base}${candidate.path}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              const users = normalizeUsers(response.data?.data);
              if (users.length > 0) {
                const hasRoleData = users.some(
                  (candidateUser) =>
                    candidateUser.role === "ADMIN" ||
                    candidateUser.role === "USER",
                );

                console.log(
                  "👥 Users fetched from",
                  `${base}${candidate.path}`,
                );

                if (hasRoleData) {
                  setAllUsers(users);
                  return;
                }

                if (fallbackUsers.length === 0) {
                  fallbackUsers = users;
                }
              }
            } catch (error: unknown) {
              if (axios.isAxiosError(error)) {
                const status = error.response?.status;
                if (
                  status === 404 ||
                  status === 401 ||
                  (candidate.optional && status === 403)
                ) {
                  continue;
                }
              }
            }
          }
        }

        setAllUsers(fallbackUsers);
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          // The dev endpoint may be disabled in some environments.
          setAllUsers([]);
          return;
        }
        console.error("Error fetching users:", error);

        setAllUsers([]);
      }
    };

    fetchUsers();
  }, [user?.id, currentUserId]);

  // Fetch conversations from backend
  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await axios.get(`${CHAT_SERVICE_URL}/conversations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log("📋 Conversations loaded:", response.data.data);

        // Deduplicate conversations - only keep one per other user
        const seen = new Set<string>();
        const conversationData = (response.data.data ??
          []) as ConversationApi[];
        const uniqueConversations = conversationData.filter((conv) => {
          const key = `${conv.type}-${[...(conv.member_ids || [])].sort().join("-")}`;
          if (seen.has(key)) {
            console.log("🔄 Skipping duplicate conversation:", key);
            return false;
          }
          seen.add(key);
          return true;
        });

        // Format conversations with enriched data
        const currentRole = user?.role ?? "USER";

        const formattedConversations = uniqueConversations.reduce<
          Conversation[]
        >((acc, conv) => {
          // Find the other user in the conversation (not current user)
          const otherUserId = conv.member_ids?.find(
            (id: string) => id !== currentUserId,
          );

          if (!otherUserId) {
            return acc;
          }

          const otherUser = allUsers.find((u) => u.id === otherUserId);
          const otherRole = otherUser?.role;

          const isSupportPair =
            currentRole === "ADMIN"
              ? otherRole === "USER"
              : otherRole === "ADMIN";

          if (!isSupportPair) {
            return acc;
          }

          const conversationName =
            conv.name || otherUser?.fullName || "Direct message";

          acc.push({
            id: conv.id,
            name: conversationName,
            avatar:
              otherUser?.avatarUrl ||
              "https://api.dicebear.com/7.x/avataaars/svg?seed=1",
            preview: "Start a conversation...",
            time: new Date(conv.created_at).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            online: true,
            email: otherUser?.email,
            messages: [],
            created_by: conv.created_by,
            type: conv.type,
            targetUserId: otherUserId,
          });

          return acc;
        }, []);

        const summaries = await loadConversationSummariesFromServer(
          formattedConversations.map((item) => item.id),
          token,
        );

        setConversations((prevConversations) => {
          const messageMap = new Map(
            prevConversations.map((conversation) => [
              conversation.id,
              conversation.messages,
            ]),
          );

          return formattedConversations.map((conversation) => ({
            ...conversation,
            messages: messageMap.get(conversation.id) ?? conversation.messages,
            preview:
              summaries[conversation.id]?.preview ?? conversation.preview,
            time: summaries[conversation.id]?.time ?? conversation.time,
          }));
        });

        await loadUnreadCountsFromServer(
          formattedConversations.map((item) => item.id),
          token,
        );

        // Always keep active conversation valid after refresh/login.
        if (formattedConversations.length > 0) {
          setActiveChatId((prev) => {
            if (
              prev &&
              formattedConversations.some((item) => item.id === prev)
            ) {
              return prev;
            }
            return formattedConversations[0].id;
          });
        } else {
          setActiveChatId(null);
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [
    user,
    currentUserId,
    allUsers,
    loadUnreadCountsFromServer,
    loadConversationSummariesFromServer,
  ]);

  // Fetch messages for the active conversation
  useEffect(() => {
    if (!activeChatId || !user) return;

    const fetchMessages = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          return;
        }

        const response = await axios.get(
          `${CHAT_SERVICE_URL}/messages/${activeChatId}?limit=100`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        console.log("📦 Messages loaded:", response.data.data);

        setConversations((prevConversations) =>
          prevConversations.map((conv) => {
            if (conv.id === activeChatId) {
              return {
                ...conv,
                messages: response.data.data || [],
              };
            }
            return conv;
          }),
        );
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages();
  }, [activeChatId, user]);

  // Join/leave active conversation room
  useEffect(() => {
    if (activeChatId && isConnected) {
      join(activeChatId);

      return () => {
        leave(activeChatId);
      };
    }
  }, [activeChatId, isConnected, join, leave]);

  // Setup Socket.io listeners
  useEffect(() => {
    const handleSendAck = (payload: unknown) => {
      const data = payload as SocketSendAck;
      if (data.ok) {
        console.log("✅ Message sent:", data.message_id);

        if (data.message_id && data.conversation_id && data.client_temp_id) {
          const realMessageId = data.message_id;
          const conversationId = data.conversation_id;
          const clientTempId = data.client_temp_id;

          setConversations((prevConversations) =>
            prevConversations.map((conv) => {
              if (conv.id !== conversationId) {
                return conv;
              }

              const tempIndex = conv.messages.findIndex(
                (msg) => msg.id === clientTempId,
              );

              if (tempIndex === -1) {
                return conv;
              }

              const realExists = conv.messages.some(
                (msg) => msg.id === realMessageId,
              );

              if (realExists) {
                return {
                  ...conv,
                  messages: conv.messages.filter(
                    (msg) => msg.id !== clientTempId,
                  ),
                };
              }

              const nextMessages = [...conv.messages];
              nextMessages[tempIndex] = {
                ...nextMessages[tempIndex],
                id: realMessageId,
              };

              return {
                ...conv,
                messages: nextMessages,
              };
            }),
          );
        }
      } else {
        console.error("❌ Message failed:", data.error);
      }
    };

    const handleMessageReceive = (payload: unknown) => {
      const message = payload as Message;
      if (processedMessageIdsRef.current.has(message.id)) {
        return;
      }
      processedMessageIdsRef.current.add(message.id);
      setTimeout(() => {
        processedMessageIdsRef.current.delete(message.id);
      }, 30000);

      console.log("📨 Message received:", message);

      const currentUserIdValue = currentUserIdRef.current;
      join(message.conversation_id);

      // Show notification ONLY if message is from another user AND from a different conversation (not currently viewing)
      if (
        message.sender_id !== currentUserIdValue &&
        message.conversation_id !== activeChatId
      ) {
        const sender =
          conversationsRef.current.find((c) => c.id === message.conversation_id)
            ?.name || "Someone";
        const notifId = `notif-${Date.now()}`;
        const conversation = conversationsRef.current.find(
          (c) => c.id === message.conversation_id,
        );

        setNotifications((prev) => [
          ...prev,
          {
            id: notifId,
            message: getMessagePreview(message),
            sender,
            avatar:
              conversation?.avatar ||
              "https://api.dicebear.com/7.x/avataaars/svg?seed=1",
            conversationId: message.conversation_id,
          },
        ]);

        // Auto-remove notification after 4 seconds
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== notifId));
        }, 4000);

        setUnreadByConversation((prev) => ({
          ...prev,
          [message.conversation_id]: (prev[message.conversation_id] ?? 0) + 1,
        }));
      }

      setConversations((prevConversations) =>
        (() => {
          const conversationIndex = prevConversations.findIndex(
            (conv) => conv.id === message.conversation_id,
          );

          if (conversationIndex === -1) {
            const sender = allUsers.find(
              (candidate) => candidate.id === message.sender_id,
            );
            const senderRole = sender?.role;
            const isSupportPairForIncoming =
              message.sender_id === currentUserIdValue ||
              ((user?.role ?? "USER") === "ADMIN"
                ? senderRole === "USER"
                : senderRole === "ADMIN");

            if (!isSupportPairForIncoming) {
              return prevConversations;
            }

            const fallbackName =
              sender?.fullName ||
              (message.sender_id === currentUserIdValue
                ? "Direct message"
                : `User ${message.sender_id.slice(0, 6)}`);

            const createdConversation: Conversation = {
              id: message.conversation_id,
              name: fallbackName,
              avatar:
                sender?.avatarUrl ||
                "https://api.dicebear.com/7.x/avataaars/svg?seed=1",
              preview: getMessagePreview(message),
              time: new Date(message.created_at).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              online: true,
              email: sender?.email,
              messages: [message],
              type: "direct",
              targetUserId: sender?.id,
            };

            return [createdConversation, ...prevConversations];
          }

          return prevConversations.map((conv) => {
            if (conv.id !== message.conversation_id) {
              return conv;
            }

            const existingIndex = conv.messages.findIndex(
              (msg) => msg.id === message.id,
            );

            if (existingIndex !== -1) {
              const newMessages = [...conv.messages];
              newMessages[existingIndex] = message;
              return {
                ...conv,
                messages: newMessages,
                preview: getMessagePreview(message),
                time: new Date(message.created_at).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              };
            }

            return {
              ...conv,
              messages: [...conv.messages, message],
              preview: getMessagePreview(message),
              time: new Date(message.created_at).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              }),
            };
          });
        })(),
      );

      if (!activeChatId && message.sender_id !== currentUserIdValue) {
        setActiveChatId(message.conversation_id);
      }
    };

    const handleTyping = (payload: unknown) => {
      const data = payload as SocketTypingPayload;
      if (data.conversation_id === activeChatId) {
        setTypingUsers((prev) => new Set(prev).add(data.user_id));

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(data.user_id);
            return next;
          });
        }, 3000);
      }
    };

    const handleReadReceipt = (payload: unknown) => {
      const data = payload as SocketReadReceiptPayload;
      const conversationId = data.conversation_id ?? data.conversationId;
      const readerId = data.user_id ?? data.userId;

      if (!conversationId || !readerId) {
        return;
      }

      console.log("✅ Read receipt:", readerId);

      setConversations((prevConversations) =>
        prevConversations.map((conv) => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              messages: conv.messages.map((msg) => {
                if (!msg.read_by.includes(readerId)) {
                  return {
                    ...msg,
                    read_by: [...msg.read_by, readerId],
                  };
                }
                return msg;
              }),
            };
          }
          return conv;
        }),
      );
    };

    const handleMessageDeleted = (payload: unknown) => {
      const data = payload as SocketMessageDeletedPayload;
      console.log("🗑️ Deleted:", data.message_id);

      setConversations((prevConversations) =>
        prevConversations.map((conv) => {
          if (conv.id === data.conversation_id) {
            return {
              ...conv,
              messages: conv.messages.filter(
                (msg) => msg.id !== data.message_id,
              ),
            };
          }
          return conv;
        }),
      );
    };

    on("message:send_ack", handleSendAck);
    on("message:receive", handleMessageReceive);
    on("message:typing", handleTyping);
    on("message:read_receipt", handleReadReceipt);
    on("message:deleted", handleMessageDeleted);

    return () => {
      off("message:send_ack", handleSendAck);
      off("message:receive", handleMessageReceive);
      off("message:typing", handleTyping);
      off("message:read_receipt", handleReadReceipt);
      off("message:deleted", handleMessageDeleted);
    };
  }, [activeChatId, on, off, allUsers, join, getMessagePreview, user?.role]);

  const handleSendMessage = (message: string) => {
    if (!message.trim() || !isConnected || !activeChatId) return;

    const tempId = `msg-${Date.now()}`;
    const newMessage: Message = {
      id: tempId,
      conversation_id: activeChatId,
      sender_id: currentUserId,
      type: "text",
      content: message,
      created_at: new Date().toISOString(),
      read_by: [currentUserId],
    };

    setConversations((prevConversations) =>
      prevConversations.map((conv) => {
        if (conv.id === activeChatId) {
          return {
            ...conv,
            messages: [...conv.messages, newMessage],
            preview: message,
            time: new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
        }
        return conv;
      }),
    );

    emit("message:send", {
      conversation_id: activeChatId,
      type: "text",
      content: message,
      client_temp_id: tempId,
    });
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveChatId(conversationId);

    emit("message:read", {
      conversation_id: conversationId,
      user_id: currentUserId,
    });

    setUnreadByConversation((prev) => {
      if (!prev[conversationId]) {
        return prev;
      }

      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  };

  const handleSendFile = async (file: File, caption?: string) => {
    if (!isConnected || !activeChatId) return;

    try {
      const token = getAuthToken();
      if (!token) {
        alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      if (caption) {
        formData.append("content", caption);
      }

      const response = await axios.post(
        `${CHAT_SERVICE_URL}/messages/${activeChatId}/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const newMessage = response.data.data as Message;

      setConversations((prevConversations) =>
        prevConversations.map((conv) => {
          if (conv.id === activeChatId) {
            const exists = conv.messages.some(
              (msg) => msg.id === newMessage.id,
            );
            return {
              ...conv,
              messages: exists ? conv.messages : [...conv.messages, newMessage],
              preview: getMessagePreview(newMessage),
              time: new Date(newMessage.created_at).toLocaleTimeString(
                "vi-VN",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              ),
            };
          }
          return conv;
        }),
      );
    } catch (error) {
      console.error("File upload error:", error);
      alert("Lỗi khi gửi file");
    }
  };

  const handleCreateDirectConversation = async (selectedUserId: string) => {
    try {
      const token = getAuthToken();
      if (!token) {
        alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        return;
      }

      const selectedUser = allUsers.find(
        (candidate) => candidate.id === selectedUserId,
      );
      const currentRole = user?.role ?? "USER";
      const canCreateSupportConversation =
        currentRole === "ADMIN"
          ? selectedUser?.role === "USER"
          : selectedUser?.role === "ADMIN";

      if (!canCreateSupportConversation) {
        alert("Chỉ hỗ trợ chat giữa khách hàng và admin.");
        return;
      }

      const response = await axios.post(
        `${CHAT_SERVICE_URL}/conversations/direct`,
        { user_id: selectedUserId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      console.log("✅ Conversation created/found:", response.data.data);

      // Reload conversations
      const convResponse = await axios.get(
        `${CHAT_SERVICE_URL}/conversations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const formattedConversations = (
        convResponse.data.data as Array<{
          id: string;
          name?: string;
          member_ids?: string[];
          created_by?: string;
          type?: "direct" | "group";
        }>
      ).reduce<Conversation[]>((acc, conv) => {
        // Find the other user in the conversation (not current user)
        const otherUserId = conv.member_ids?.find(
          (id: string) => id !== currentUserId,
        );

        if (!otherUserId) {
          return acc;
        }

        const userData = allUsers.find((u) => u.id === otherUserId);
        const otherRole = userData?.role;
        const isSupportPair =
          currentRole === "ADMIN"
            ? otherRole === "USER"
            : otherRole === "ADMIN";

        if (!isSupportPair) {
          return acc;
        }

        const conversationName =
          conv.name || userData?.fullName || "Direct message";

        acc.push({
          id: conv.id,
          name: conversationName,
          avatar:
            userData?.avatarUrl ||
            "https://api.dicebear.com/7.x/avataaars/svg?seed=1",
          preview: "Start a conversation...",
          time: "",
          online: true,
          email: userData?.email,
          messages: [],
          created_by: conv.created_by,
          type: conv.type,
          targetUserId: otherUserId,
        });

        return acc;
      }, []);

      const summaries = await loadConversationSummariesFromServer(
        formattedConversations.map((item) => item.id),
        token,
      );

      setConversations(
        formattedConversations.map((conversation) => ({
          ...conversation,
          preview: summaries[conversation.id]?.preview ?? conversation.preview,
          time: summaries[conversation.id]?.time ?? conversation.time,
        })),
      );
      setActiveChatId(response.data.data.id);
      setShowUserSelection(false);
    } catch (error) {
      console.error("Error creating conversation:", error);
      alert("Không thể tạo cuộc trò chuyện");
    }
  };

  const normalizedSearch = safeSearchTerm.trim().toLowerCase();
  const isAdmin = (user as { role?: string } | null)?.role === "ADMIN";
  const adminUsers = allUsers.filter(
    (u) => u.id !== currentUserId && u.role === "ADMIN",
  );
  const supportUsers = allUsers.filter(
    (u) =>
      u.id !== currentUserId &&
      (isAdmin ? u.role === "USER" : u.role === "ADMIN"),
  );

  const filteredConversations = conversations.filter((chat) => {
    if (!normalizedSearch) {
      return true;
    }

    return [chat.name, chat.email ?? ""].some((value) =>
      value.toLowerCase().includes(normalizedSearch),
    );
  });

  const visibleUsers = supportUsers.filter((u) => {
    if (!normalizedSearch) {
      return true;
    }

    return [u.fullName, u.email ?? "", u.phone ?? "", u.id].some((value) =>
      value.toLowerCase().includes(normalizedSearch),
    );
  });

  const authToken = getAuthToken();

  const recentSharedItems = useMemo(() => {
    if (!activeChat || !authToken) {
      return {
        media: [] as Array<{
          id: string;
          name: string;
          mimeType: string;
          previewUrl: string;
          downloadUrl: string;
          createdAt: string;
        }>,
        files: [] as Array<{
          id: string;
          name: string;
          mimeType: string;
          size: number;
          downloadUrl: string;
          createdAt: string;
        }>,
      };
    }

    const sortedFileMessages = [...activeChat.messages]
      .filter((msg) => msg.type === "file" && !msg.deleted_at)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

    const items = sortedFileMessages
      .map((message) => {
        let parsed: ParsedFilePayload = {};
        try {
          parsed = JSON.parse(message.content) as ParsedFilePayload;
        } catch {
          parsed = {};
        }

        const embedded = parsed.file;
        const filePath = embedded?.path;
        if (!filePath) {
          return null;
        }

        const name =
          embedded?.originalName ||
          parsed.file_name ||
          embedded?.filename ||
          "attachment";
        const mimeType = embedded?.mimetype || parsed.file_type || "";
        const size = embedded?.size || parsed.file_size || 0;
        const previewUrl = `${CHAT_SERVICE_URL}${filePath}?token=${encodeURIComponent(authToken)}`;
        const downloadUrl = `${previewUrl}&download=1&name=${encodeURIComponent(name)}`;

        return {
          id: message.id,
          name,
          mimeType,
          size,
          createdAt: message.created_at,
          previewUrl,
          downloadUrl,
        };
      })
      .filter(
        (
          item,
        ): item is {
          id: string;
          name: string;
          mimeType: string;
          size: number;
          createdAt: string;
          previewUrl: string;
          downloadUrl: string;
        } => Boolean(item),
      );

    return {
      media: items
        .filter((item) => /^image\/|^video\//.test(item.mimeType))
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          previewUrl: item.previewUrl,
          downloadUrl: item.downloadUrl,
          createdAt: item.createdAt,
        })),
      files: items
        .filter((item) => !/^image\/|^video\//.test(item.mimeType))
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          size: item.size,
          downloadUrl: item.downloadUrl,
          createdAt: item.createdAt,
        })),
    };
  }, [activeChat, authToken]);

  const formatFileSize = (bytes: number) => {
    if (!bytes || Number.isNaN(bytes)) {
      return "Unknown size";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatShortDateTime = (value: string) => {
    try {
      return new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const getTicketCode = (conversationId: string) => {
    const compact = conversationId.replace(/-/g, "").toUpperCase();
    return `#TK-${compact.slice(0, 4)}`;
  };

  const getTicketStatus = (conversationId: string) => {
    const unread = unreadByConversation[conversationId] ?? 0;
    return unread > 0 ? "OPEN" : "RESOLVED";
  };

  return (
    <div className="flex w-full h-full bg-[#dfe3e9] font-sans text-slate-800 relative">
      {/* Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            onClick={() => {
              handleSelectConversation(notif.conversationId);
              setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
            }}
            className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 max-w-xs cursor-pointer hover:shadow-xl transition-shadow animate-in slide-in-from-bottom-2 duration-300"
          >
            <div className="flex items-start gap-3">
              <img
                src={notif.avatar}
                alt={notif.sender}
                className="w-10 h-10 rounded-full shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {notif.sender}
                </p>
                <p className="text-sm text-slate-600 truncate">
                  {notif.message}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNotifications((prev) =>
                    prev.filter((n) => n.id !== notif.id),
                  );
                }}
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* User Selection Modal */}
      {isAdmin && showUserSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold">Chọn khách hàng cần hỗ trợ</h2>
              <p className="text-sm text-slate-500 mt-1">
                Admin chỉ tạo ticket với user.
              </p>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {visibleUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleCreateDirectConversation(user.id)}
                  className="w-full px-6 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <img
                    src={
                      user.avatarUrl ||
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=1"
                    }
                    alt={user.fullName}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">
                      {user.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {user.email || user.phone || user.id}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowUserSelection(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Column: Conversation List */}
      <div className="w-[320px] border-r border-slate-200/80 flex flex-col bg-[#f5f7fb]">
        <div className="p-5 flex items-center justify-between">
          <h1 className="text-[34px] leading-none font-bold tracking-tight">
            OTT Care
          </h1>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-500 cursor-pointer" />
          </div>
        </div>

        <div className="px-4 pb-3 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={safeSearchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full bg-[#eef1f6] text-sm rounded-full py-2.5 pl-9 pr-4 outline-none border border-transparent"
            />
          </div>
        </div>

        {isAdmin && (
          <div className="px-4 py-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${
                isConnected
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-600" : "bg-red-600"
                }`}
              />
              {isConnected ? "Connected" : "Reconnecting..."}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {loading ? (
            <div className="p-4 text-center text-slate-500">
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              No conversations yet
            </div>
          ) : (
            filteredConversations.map((chat) => (
              <div
                key={chat.id}
                onClick={() => {
                  handleSelectConversation(chat.id);
                }}
                className={`p-3 mb-2 rounded-xl flex ${isAdmin ? "gap-3" : "gap-2"} cursor-pointer transition-colors ${
                  activeChatId === chat.id
                    ? "bg-[#ebeff5]"
                    : "hover:bg-[#eef2f8]"
                }`}
              >
                {isAdmin && (
                  <div className="relative">
                    <img
                      src={chat.avatar}
                      alt={chat.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    {chat.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[11px] font-bold text-blue-600 tracking-wide truncate">
                      {getTicketCode(chat.id)}
                    </p>
                    {chat.time && (
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        {chat.time}
                      </span>
                    )}
                  </div>

                  <h3 className="text-[16px] leading-tight font-semibold text-slate-800 truncate mb-1">
                    {chat.name}
                  </h3>

                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        getTicketStatus(chat.id) === "OPEN"
                          ? "bg-emerald-500"
                          : "bg-slate-400"
                      }`}
                    />
                    <p
                      className={`text-[11px] font-bold tracking-wide ${
                        getTicketStatus(chat.id) === "OPEN"
                          ? "text-emerald-600"
                          : "text-slate-500"
                      }`}
                    >
                      {getTicketStatus(chat.id)}
                    </p>
                    {unreadByConversation[chat.id] > 0 && (
                      <span className="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-semibold ml-auto">
                        {unreadByConversation[chat.id] > 99
                          ? "99+"
                          : unreadByConversation[chat.id]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-slate-200/70">
          <button
            onClick={() => {
              if (isAdmin) {
                setShowUserSelection(true);
                return;
              }

              const firstAdmin = adminUsers[0];
              if (!firstAdmin) {
                alert("Hiện chưa có admin khả dụng để tạo ticket.");
                return;
              }

              void handleCreateDirectConversation(firstAdmin.id);
            }}
            className="w-full bg-blue-600 text-white text-sm font-semibold px-3 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            + New Ticket
          </button>
        </div>
      </div>

      {/* Middle Column: Chat Area */}
      <div className="flex-1 flex flex-col bg-[#dde1e7] relative">
        {activeChat ? (
          <>
            <div className="h-16 bg-[#f5f7fa] border-b border-slate-200 px-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <img
                    src={activeChat.avatar}
                    alt={activeChat.name}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                )}
                <div>
                  <h2 className="text-[16px] leading-none font-semibold">
                    {activeChat.name}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        activeChat.online ? "bg-green-500" : "bg-slate-300"
                      }`}
                    ></span>
                    {activeChat.online ? "Online" : "Offline"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="bg-blue-600 text-white text-sm font-semibold px-5 py-1.5 rounded-full hover:bg-blue-700 transition-colors">
                  {(user as { role?: string } | null)?.role === "ADMIN"
                    ? "Resolve"
                    : "Actions"}
                </button>
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-700 transition-colors"
                  aria-label="More actions"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            <MessageList
              messages={activeChat.messages}
              currentUserId={currentUserId}
              conversationName={activeChat.name}
              isLoading={loading}
              isAdminView
              showSenderAvatar={isAdmin}
            />

            {typingUsers.size > 0 && (
              <div className="px-6 py-2 text-sm text-slate-500 italic">
                {activeChat.name} đang nhập...
              </div>
            )}

            <MessageInput
              onSendMessage={handleSendMessage}
              onSendFile={handleSendFile}
              isLoading={loading}
              isConnected={isConnected}
              isAdminView
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Select a conversation to start messaging
          </div>
        )}
      </div>

      {/* Right Column: Info */}
      <div className="w-80 border-l border-slate-200 bg-[#f5f7fb] flex flex-col overflow-y-auto">
        {activeChat && (
          <>
            <div className="flex flex-col items-center py-8 border-b border-slate-100">
              {isAdmin && (
                <img
                  src={activeChat.avatar}
                  alt={activeChat.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm mb-3"
                />
              )}
              <h2 className="text-[24px] leading-none font-bold tracking-tight text-slate-800">
                {activeChat.name}
              </h2>
              {isAdmin && (
                <p className="text-sm text-slate-500 mt-1">
                  {activeChat.email}
                </p>
              )}
            </div>

            <div className="p-6 border-b border-slate-100 space-y-3">
              {isAdmin && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subject:</span>
                    <span className="font-medium text-right">
                      API Token Revocation
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Category:</span>
                    <span className="font-medium text-right">Technical</span>
                  </div>
                </>
              )}
              {!isAdmin && (
                <p className="text-sm text-slate-500">
                  Ảnh và file gần đây trong cuộc trò chuyện này.
                </p>
              )}
            </div>

            {isAdmin && (
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-500 tracking-wider">
                    PREVIOUS TICKETS
                  </p>
                  <span className="text-slate-400">⌄</span>
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl bg-white border border-slate-200 p-3">
                    <p className="text-xs font-bold text-blue-600">#TK-8821</p>
                    <p className="text-sm font-semibold text-slate-800">
                      API Token Revocation
                    </p>
                    <p className="text-xs text-emerald-600 font-semibold">
                      Resolved
                    </p>
                  </div>
                  <div className="rounded-xl bg-white border border-slate-200 p-3">
                    <p className="text-xs font-bold text-blue-600">#TK-7440</p>
                    <p className="text-sm font-semibold text-slate-800">
                      Dashboard Latency Issue
                    </p>
                    <p className="text-xs text-emerald-600 font-semibold">
                      Resolved
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 tracking-wider">
                  SHARED PHOTOS/VIDEOS
                </p>
                <button className="text-[11px] text-blue-600 font-semibold">
                  View All
                </button>
              </div>
              {recentSharedItems.media.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Chưa có ảnh hoặc video nào.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {recentSharedItems.media.map((media) => {
                    const isVideo = media.mimeType.startsWith("video/");

                    return (
                      <a
                        key={media.id}
                        href={media.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={media.name}
                        className="h-16 rounded-lg bg-white border border-slate-200 overflow-hidden block"
                      >
                        {isVideo ? (
                          <div className="h-full w-full flex items-center justify-center bg-slate-100 text-[10px] font-semibold text-slate-600 px-1 text-center">
                            VIDEO
                          </div>
                        ) : (
                          <img
                            src={media.previewUrl}
                            alt={media.name}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 tracking-wider">
                  SHARED FILES
                </p>
                <span className="text-slate-400">⌄</span>
              </div>
              {recentSharedItems.files.length === 0 ? (
                <p className="text-xs text-slate-400">Chưa có file nào.</p>
              ) : (
                <div className="space-y-2">
                  {recentSharedItems.files.map((file) => (
                    <a
                      key={file.id}
                      href={file.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-white border border-slate-200 p-3 block hover:border-slate-300 transition-colors"
                    >
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatFileSize(file.size)} •{" "}
                        {formatShortDateTime(file.createdAt)}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
