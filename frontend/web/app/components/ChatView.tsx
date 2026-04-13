"use client";
/* eslint-disable @next/next/no-img-element */
/* eslint-disable sonarjs/no-nested-functions */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, MoreVertical, Search, Users } from "lucide-react";
import MessageList, { Message } from "./MessageList";
import MessageInput from "./MessageInput";
import CreateGroupModal from "./CreateGroupModal";
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
  email?: string;
  messages: Message[];
  createdBy?: string;
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

interface ConversationApiRaw {
  id: string;
  name?: string;
  member_ids?: string[];
  created_at: string;
  created_by?: string;
  type?: "direct" | "group";
  last_message_at?: string | null;
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

type SendAckPayload = {
  ok: boolean;
  message_id?: string;
  conversation_id?: string;
  client_temp_id?: string;
  error?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3004";

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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`http_${response.status}`);
  }

  return (await response.json()) as T;
}

export default function ChatView() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [unreadByConversation, setUnreadByConversation] = useState<
    Record<string, number>
  >({});

  const { isConnected, on, off, emit, join, leave } = useSocket();
  const currentUserId = user?.id ?? "";
  const activeChat = conversations.find((c) => c.id === activeChatId);
  const conversationsRef = useRef<Conversation[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resolveSenderName = useCallback(
    (senderId: string) => {
      if (senderId === currentUserId) {
        return user?.fullName || "You";
      }
      const sender = allUsers.find((u) => u.id === senderId);
      return sender?.fullName || sender?.email || "Unknown";
    },
    [allUsers, currentUserId, user?.fullName],
  );

  const enrichMessage = useCallback(
    (message: Message): Message => {
      const senderName = resolveSenderName(message.sender_id);
      return {
        ...message,
        sender_name: senderName,
      };
    },
    [resolveSenderName],
  );

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const normalizeUsers = (payload: unknown): UserSummary[] => {
    let list: unknown[] = [];
    if (Array.isArray(payload)) {
      list = payload;
    } else if (payload && typeof payload === "object") {
      const items = (payload as { items?: unknown[] }).items;
      if (Array.isArray(items)) {
        list = items;
      }
    }

    return list.reduce<UserSummary[]>((acc, item) => {
      if (!item || typeof item !== "object") return acc;

      const raw = item as {
        id?: unknown;
        fullName?: unknown;
        full_name?: unknown;
        email?: unknown;
        phone?: unknown;
        avatarUrl?: unknown;
        avatar_url?: unknown;
        role?: unknown;
      };

      if (typeof raw.id !== "string") return acc;

      let fullName = raw.id;
      if (typeof raw.fullName === "string") {
        fullName = raw.fullName;
      } else if (typeof raw.full_name === "string") {
        fullName = raw.full_name;
      }

      let avatarUrl: string | null = null;
      if (typeof raw.avatarUrl === "string") {
        avatarUrl = raw.avatarUrl;
      } else if (typeof raw.avatar_url === "string") {
        avatarUrl = raw.avatar_url;
      }

      const normalized: UserSummary = {
        id: raw.id,
        fullName,
        email: typeof raw.email === "string" ? raw.email : undefined,
        phone: typeof raw.phone === "string" ? raw.phone : undefined,
        avatarUrl,
        role:
          raw.role === "USER" || raw.role === "ADMIN" ? raw.role : undefined,
      };

      acc.push(normalized);
      return acc;
    }, []);
  };

  const normalizeConversations = (
    payload: ConversationApiRaw[],
  ): ConversationApi[] => {
    return payload.map((item) => ({
      id: item.id,
      name: item.name,
      memberIds: item.member_ids ?? [],
      createdAt: item.created_at,
      createdBy: item.created_by,
      type: item.type,
      lastMessageAt: item.last_message_at,
    }));
  };

  const fetchUsers = useCallback(async () => {
    if (!currentUserId) {
      setAllUsers([]);
      return;
    }
    if (!getAuthToken()) return;

    const candidates = ["/api/users/chat-peers", "/api/users/friends"];

    const mergedById = new Map<string, UserSummary>();

    for (const path of candidates) {
      try {
        const response = await authJsonRequest<{ data?: unknown }>(path);
        const users = normalizeUsers(response.data);
        users.forEach((candidate) => {
          const current = mergedById.get(candidate.id);
          // Keep the richest user snapshot across sources.
          mergedById.set(candidate.id, {
            ...current,
            ...candidate,
          });
        });
      } catch {
        // Try next source.
      }
    }

    setAllUsers(Array.from(mergedById.values()));
  }, [currentUserId]);

  useEffect(() => {
    setConversations((prev) =>
      prev.map((conv) => ({
        ...conv,
        messages: conv.messages.map((message) => enrichMessage(message)),
      })),
    );
  }, [enrichMessage]);

  const loadConversations = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await authJsonRequest<{ data?: unknown }>(
        "/api/conversations",
      );

      const rawData = (response.data ?? []) as ConversationApiRaw[];
      const data = normalizeConversations(rawData);
      const currentRole = user?.role ?? "USER";

      const mapped = data.reduce<Conversation[]>((acc, conv) => {
        if (conv.type === "group") {
          acc.push({
            id: conv.id,
            name: conv.name || "Nhóm",
            avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=group",
            preview: "Nhóm chat",
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

        const otherUser = allUsers.find((u) => u.id === otherUserId);
        const otherRole = otherUser?.role;
        const isSupportPair =
          currentRole === "ADMIN"
            ? otherRole === "USER"
            : otherRole === "ADMIN";
        if (!isSupportPair) return acc;

        acc.push({
          id: conv.id,
          name: conv.name || otherUser?.fullName || "Direct message",
          avatar:
            otherUser?.avatarUrl ||
            "https://api.dicebear.com/7.x/avataaars/svg?seed=1",
          preview: "Start a conversation...",
          time: new Date(conv.createdAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          online: true,
          email: otherUser?.email,
          messages: [],
          createdBy: conv.createdBy,
          type: conv.type,
          targetUserId: otherUserId,
        });
        return acc;
      }, []);

      setConversations((prev) => {
        const msgMap = new Map(prev.map((c) => [c.id, c.messages]));
        return mapped.map((c) => ({ ...c, messages: msgMap.get(c.id) ?? [] }));
      });

      if (!activeChatId && mapped.length > 0) {
        setActiveChatId(mapped[0].id);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [activeChatId, allUsers, currentUserId, user?.role]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeChatId) return;
    const token = getAuthToken();
    if (!token) return;

    const fetchMessages = async () => {
      try {
        const response = await authJsonRequest<{ data?: Message[] }>(
          `/api/messages/${activeChatId}?limit=100`,
        );

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeChatId
              ? {
                  ...conv,
                  messages: (response.data ?? []).map((message) =>
                    enrichMessage(message),
                  ),
                }
              : conv,
          ),
        );
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    void fetchMessages();
  }, [activeChatId, enrichMessage]);

  useEffect(() => {
    if (!activeChatId || !isConnected) return;
    join(activeChatId);
    return () => leave(activeChatId);
  }, [activeChatId, isConnected, join, leave]);

  useEffect(() => {
    const handleSendAck = (payload: unknown) => {
      const ack = payload as SendAckPayload;
      if (!ack.client_temp_id) return;

      setConversations((prev) =>
        prev.map((conv) => {
          const tempIndex = conv.messages.findIndex(
            (message) => message.id === ack.client_temp_id,
          );

          if (tempIndex < 0) return conv;

          if (!ack.ok || !ack.message_id) {
            return {
              ...conv,
              messages: conv.messages.filter(
                (message) => message.id !== ack.client_temp_id,
              ),
            };
          }

          // If server message already exists, drop optimistic duplicate.
          if (conv.messages.some((message) => message.id === ack.message_id)) {
            return {
              ...conv,
              messages: conv.messages.filter(
                (message) => message.id !== ack.client_temp_id,
              ),
            };
          }

          const nextMessages = [...conv.messages];
          nextMessages[tempIndex] = {
            ...nextMessages[tempIndex],
            id: ack.message_id,
          };

          return {
            ...conv,
            messages: nextMessages,
          };
        }),
      );
    };

    const handleMessageReceive = (payload: unknown) => {
      const incomingMessage = enrichMessage(payload as Message);

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== incomingMessage.conversation_id) return conv;

          if (
            conv.messages.some((message) => message.id === incomingMessage.id)
          ) {
            return conv;
          }

          // Collapse optimistic message when server message arrives before ACK.
          const optimisticIndex = conv.messages.findIndex(
            (message) =>
              message.id.startsWith("tmp-") &&
              message.content === incomingMessage.content,
          );

          if (optimisticIndex >= 0) {
            const nextMessages = [...conv.messages];
            nextMessages[optimisticIndex] = {
              ...incomingMessage,
            };

            return {
              ...conv,
              messages: nextMessages,
              preview:
                incomingMessage.type === "file"
                  ? "📎 Attachment"
                  : incomingMessage.content,
              time: new Date(incomingMessage.created_at).toLocaleTimeString(
                "vi-VN",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                },
              ),
            };
          }

          return {
            ...conv,
            messages: [...conv.messages, incomingMessage],
            preview:
              incomingMessage.type === "file"
                ? "📎 Attachment"
                : incomingMessage.content,
            time: new Date(incomingMessage.created_at).toLocaleTimeString(
              "vi-VN",
              {
                hour: "2-digit",
                minute: "2-digit",
              },
            ),
          };
        }),
      );

      if (
        incomingMessage.sender_id !== currentUserId &&
        incomingMessage.conversation_id !== activeChatId
      ) {
        setUnreadByConversation((prev) => ({
          ...prev,
          [incomingMessage.conversation_id]:
            (prev[incomingMessage.conversation_id] ?? 0) + 1,
        }));
      }
    };

    const handleTyping = (payload: unknown) => {
      const data = payload as { conversation_id: string; user_id: string };
      if (data.conversation_id !== activeChatId) return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {}, 3000);
    };

    on("message:send_ack", handleSendAck);
    on("message:receive", handleMessageReceive);
    on("message:typing", handleTyping);

    return () => {
      off("message:send_ack", handleSendAck);
      off("message:receive", handleMessageReceive);
      off("message:typing", handleTyping);
    };
  }, [activeChatId, currentUserId, enrichMessage, off, on]);

  const handleSendMessage = (message: string) => {
    if (!message.trim() || !activeChatId || !isConnected) return;
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: activeChatId,
      sender_id: currentUserId,
      type: "text",
      content: message,
      created_at: new Date().toISOString(),
      read_by: [currentUserId],
      sender_name: user?.fullName || "You",
    };

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === activeChatId
          ? {
              ...conv,
              messages: [...conv.messages, optimistic],
              preview: message,
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
      content: message,
      client_temp_id: tempId,
    });
  };

  const handleSendFile = async (file: File, caption?: string) => {
    if (!activeChatId || !isConnected) return;
    const token = getAuthToken();
    if (!token) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (caption) formData.append("content", caption);

      const response = await fetch(
        `${API_BASE_URL}/api/messages/${activeChatId}/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`http_${response.status}`);
      }

      const payload = (await response.json()) as { data?: Message };
      const newMessage = payload.data as Message;
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeChatId
            ? {
                ...conv,
                messages: [...conv.messages, enrichMessage(newMessage)],
                preview: "📎 Attachment",
              }
            : conv,
        ),
      );
    } catch (error) {
      console.error("File upload error:", error);
    }
  };

  const handleCreateDirectConversation = async (selectedUserId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await authJsonRequest<{ data?: { id?: string } }>(
        "/api/conversations/direct",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: selectedUserId }),
        },
      );

      setActiveChatId(response.data?.id ?? null);
      setShowUserSelection(false);
      await loadConversations();
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveChatId(conversationId);
    setUnreadByConversation((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredConversations = conversations.filter((chat) => {
    if (!normalizedSearch) return true;
    return [chat.name, chat.email ?? ""].some((value) =>
      value.toLowerCase().includes(normalizedSearch),
    );
  });

  const isAdmin = user?.role === "ADMIN";
  const supportUsers = allUsers.filter(
    (u) =>
      u.id !== currentUserId &&
      (isAdmin ? u.role === "USER" : u.role === "ADMIN"),
  );

  const isActiveGroup = activeChat?.type === "group";

  let conversationsContent: React.ReactNode;
  if (loading) {
    conversationsContent = (
      <div className="p-4 text-center text-slate-500">
        Loading conversations...
      </div>
    );
  } else if (filteredConversations.length === 0) {
    conversationsContent = (
      <div className="p-4 text-center text-slate-500">No conversations yet</div>
    );
  } else {
    conversationsContent = filteredConversations.map((chat) => (
      <button
        key={chat.id}
        onClick={() => handleSelectConversation(chat.id)}
        className={`w-full p-3 mb-2 rounded-xl flex gap-3 text-left transition-colors ${
          activeChatId === chat.id ? "bg-[#ebeff5]" : "hover:bg-[#eef2f8]"
        }`}
      >
        <img
          src={chat.avatar}
          alt={chat.name}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <p className="text-[11px] font-bold text-blue-600 tracking-wide truncate">
              {chat.type === "group" ? "GROUP" : "TICKET"}
            </p>
            <span className="text-[11px] text-slate-400 whitespace-nowrap">
              {chat.time}
            </span>
          </div>
          <h3 className="text-[16px] leading-tight font-semibold text-slate-800 truncate mb-1">
            {chat.name}
          </h3>
          <p className="text-xs text-slate-500 truncate">{chat.preview}</p>
          {unreadByConversation[chat.id] > 0 && (
            <span className="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-semibold mt-1">
              {unreadByConversation[chat.id]}
            </span>
          )}
        </div>
      </button>
    ));
  }

  return (
    <div className="flex w-full h-full bg-[#dfe3e9] font-sans text-slate-800">
      <div className="w-[320px] border-r border-slate-200/80 flex flex-col bg-[#f5f7fb]">
        <div className="p-5 flex items-center justify-between">
          <h1 className="text-[34px] leading-none font-bold tracking-tight">
            OTT Care
          </h1>
          <Bell className="w-5 h-5 text-slate-500" />
        </div>

        <div className="px-4 pb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full bg-[#eef1f6] text-sm rounded-full py-2.5 pl-9 pr-4 outline-none"
            />
          </div>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
            title="Tạo nhóm chat"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {conversationsContent}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-slate-200/70">
          <button
            onClick={() => {
              if (isAdmin) {
                setShowUserSelection(true);
                return;
              }
              const firstAdmin = supportUsers[0];
              if (!firstAdmin) return;
              void handleCreateDirectConversation(firstAdmin.id);
            }}
            className="w-full bg-blue-600 text-white text-sm font-semibold px-3 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            + New Ticket
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[#dde1e7] relative">
        {activeChat ? (
          <>
            <div className="h-16 bg-[#f5f7fa] border-b border-slate-200 px-6 flex items-center justify-between z-10">
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
                    {activeChat.online ? "Online" : "Offline"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700 transition-colors"
                aria-label="More actions"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            <MessageList
              messages={activeChat.messages}
              currentUserId={currentUserId}
              conversationName={activeChat.name}
              isLoading={loading}
              isAdminView
              showSenderAvatar
            />

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

      {activeChat && isActiveGroup ? (
        <GroupDetailPanel
          conversationId={activeChat.id}
          onConversationUpdated={() => void loadConversations()}
          onConversationDeleted={() => {
            setActiveChatId(null);
            void loadConversations();
          }}
        />
      ) : (
        <div className="w-80 border-l border-slate-200 bg-[#f5f7fb] flex flex-col overflow-y-auto">
          <div className="p-6">
            <p className="text-sm text-slate-500">
              Chọn nhóm để xem chi tiết nhóm, hoặc chọn ticket để chat realtime.
            </p>
          </div>
        </div>
      )}

      {isAdmin && showUserSelection && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold">Chọn khách hàng cần hỗ trợ</h2>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {supportUsers.map((supportUser) => (
                <button
                  key={supportUser.id}
                  onClick={() =>
                    void handleCreateDirectConversation(supportUser.id)
                  }
                  className="w-full px-6 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <img
                    src={
                      supportUser.avatarUrl ||
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=1"
                    }
                    alt={supportUser.fullName}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">
                      {supportUser.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {supportUser.email || supportUser.phone || supportUser.id}
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

      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={() => void loadConversations()}
      />
    </div>
  );
}
