"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./contexts/auth";
import { useSocket } from "./hooks/useSocket";
import { getAuthToken } from "./lib/auth";

import Sidebar from "../app/components/Sidebar";
import ChatView from "../app/components/ChatView";
import ChatbotView from "../app/components/ChatbotView";
import FriendsView from "../app/components/FriendsView";
import HistoryView from "../app/components/HistoryView";
import ProfileView from "../app/components/ProfileView";
import StatsView from "../app/components/StatsView";

type TopupNotification = {
  id: string;
  conversationId: string;
  messageId?: string;
  title: string;
  body: string;
};

function normalizeRealtimeId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim().replace(/,+$/, "");
  return normalized.length > 0 ? normalized : null;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3004";
const USER_SERVICE_BASE_URL =
  process.env.NEXT_PUBLIC_USER_SERVICE_URL ?? "http://127.0.0.1:3001";
const unreadStorageKeyPrefix = "zalo-lite:web:unread:";
const mutedStorageKeyPrefix = "zalo-lite:web:muted:";

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function DashboardLayout() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const currentUserId = user?.id ?? "";
  const { on, off } = useSocket();
  const [currentView, setCurrentView] = useState("chat");
  const [focusedConversationId, setFocusedConversationId] = useState<
    string | null
  >(null);
  const [unreadByConversation, setUnreadByConversation] = useState<
    Record<string, number>
  >({});
  const [mutedByConversation, setMutedByConversation] = useState<
    Record<string, boolean>
  >({});
  const [friendNames, setFriendNames] = useState<Record<string, string>>({});
  const [topups, setTopups] = useState<TopupNotification[]>([]);
  const [pendingJump, setPendingJump] = useState<{
    conversationId: string;
    messageId?: string;
  } | null>(null);
  const seenRealtimeMessages = useRef<Set<string>>(new Set());

  const unreadCount = useMemo(
    () =>
      Object.values(unreadByConversation).reduce(
        (sum, count) => sum + count,
        0,
      ),
    [unreadByConversation],
  );

  const pushTopup = useCallback(
    (conversationId: string, body: string, messageId?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setTopups((prev) =>
        [
          {
            id,
            conversationId,
            messageId,
            title: "Tin nhắn mới",
            body,
          },
          ...prev,
        ].slice(0, 4),
      );

      window.setTimeout(() => {
        setTopups((prev) => prev.filter((item) => item.id !== id));
      }, 4000);
    },
    [],
  );

  const handleTopupClick = useCallback((topup: TopupNotification) => {
    const conversationId = normalizeRealtimeId(topup.conversationId);
    if (!conversationId) {
      setTopups((prev) => prev.filter((item) => item.id !== topup.id));
      return;
    }

    setCurrentView("chat");
    setPendingJump({
      conversationId,
      messageId: normalizeRealtimeId(topup.messageId) ?? undefined,
    });
    setTopups((prev) => prev.filter((item) => item.id !== topup.id));
  }, []);

  const handleFocusedConversationChange = useCallback(
    (conversationId: string | null) => {
      setFocusedConversationId(conversationId);
    },
    [],
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user?.id) {
      setUnreadByConversation({});
      setMutedByConversation({});
      return;
    }

    try {
      const storageKey = `${unreadStorageKeyPrefix}${user.id}`;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setUnreadByConversation({});
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setUnreadByConversation({});
        return;
      }

      const next = Object.entries(parsed as Record<string, unknown>).reduce<
        Record<string, number>
      >((acc, [conversationId, count]) => {
        if (typeof count !== "number" || !Number.isFinite(count)) {
          return acc;
        }

        const normalized = Math.max(0, Math.floor(count));
        if (normalized > 0) {
          acc[conversationId] = normalized;
        }
        return acc;
      }, {});

      setUnreadByConversation(next);
    } catch {
      setUnreadByConversation({});
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setMutedByConversation({});
      return;
    }

    try {
      const storageKey = `${mutedStorageKeyPrefix}${user.id}`;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setMutedByConversation({});
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setMutedByConversation({});
        return;
      }

      const next = Object.entries(parsed as Record<string, unknown>).reduce<
        Record<string, boolean>
      >((acc, [conversationId, muted]) => {
        if (muted === true) {
          acc[conversationId] = true;
        }
        return acc;
      }, {});

      setMutedByConversation(next);
    } catch {
      setMutedByConversation({});
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    try {
      const storageKey = `${unreadStorageKeyPrefix}${user.id}`;
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(unreadByConversation),
      );
    } catch {
      // Ignore storage failures (private mode/quota).
    }
  }, [unreadByConversation, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    try {
      const storageKey = `${mutedStorageKeyPrefix}${user.id}`;
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(mutedByConversation),
      );
    } catch {
      // Ignore storage failures (private mode/quota).
    }
  }, [mutedByConversation, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setFriendNames({});
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setFriendNames({});
      return;
    }

    const loadFriendNames = async () => {
      try {
        const requestInit: RequestInit = {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        };

        const response = await fetchWithTimeout(
          `${API_BASE_URL}/api/users/chat-peers`,
          requestInit,
        );

        const resolvedResponse =
          response.ok
            ? response
            : await fetchWithTimeout(
                `${USER_SERVICE_BASE_URL}/users/chat-peers`,
                requestInit,
              );

        if (!resolvedResponse.ok) {
          const fallbackResponse = await fetchWithTimeout(
            `${USER_SERVICE_BASE_URL}/users/friends`,
            requestInit,
          );

          if (!fallbackResponse.ok) {
            return;
          }

          const fallbackPayload = (await fallbackResponse.json()) as {
            data?: unknown;
          };
          if (!Array.isArray(fallbackPayload.data)) {
            return;
          }

          const fallbackMap: Record<string, string> = {};
          fallbackPayload.data.forEach((item) => {
            if (!item || typeof item !== "object") {
              return;
            }
            const raw = item as {
              id?: unknown;
              fullName?: unknown;
              email?: unknown;
            };
            if (typeof raw.id !== "string") {
              return;
            }
            fallbackMap[raw.id] =
              (typeof raw.fullName === "string" && raw.fullName.trim()) ||
              (typeof raw.email === "string" && raw.email.trim()) ||
              raw.id;
          });

          setFriendNames(fallbackMap);
          return;
        }

        const payload = (await resolvedResponse.json()) as { data?: unknown };
        if (!Array.isArray(payload.data)) {
          return;
        }

        const map: Record<string, string> = {};
        payload.data.forEach((item) => {
          if (!item || typeof item !== "object") {
            return;
          }
          const raw = item as {
            id?: unknown;
            fullName?: unknown;
            email?: unknown;
          };
          if (typeof raw.id !== "string") {
            return;
          }
          map[raw.id] =
            (typeof raw.fullName === "string" && raw.fullName.trim()) ||
            (typeof raw.email === "string" && raw.email.trim()) ||
            raw.id;
        });

        setFriendNames(map);
      } catch {
        setFriendNames({});
      }
    };

    void loadFriendNames();
  }, [user?.id]);

  useEffect(() => {
    if (currentView !== "chat") {
      setFocusedConversationId(null);
    }
  }, [currentView]);

  useEffect(() => {
    const handleRealtimeNotification = (payload: unknown) => {
      const data = payload as {
        conversation_id?: unknown;
        message_id?: unknown;
        id?: unknown;
        sender_id?: string;
        sender_name?: string;
        type?: "text" | "file";
        content?: string;
      };

      const conversationId = normalizeRealtimeId(data.conversation_id);
      if (!conversationId) {
        return;
      }

      if (data.sender_id && data.sender_id === currentUserId) {
        return;
      }

      const messageId =
        normalizeRealtimeId(data.message_id) ?? normalizeRealtimeId(data.id);
      if (messageId) {
        const key = `${conversationId}:${messageId}`;
        if (seenRealtimeMessages.current.has(key)) {
          return;
        }

        seenRealtimeMessages.current.add(key);
        if (seenRealtimeMessages.current.size > 300) {
          seenRealtimeMessages.current.clear();
        }
      }

      const isViewingConversation =
        currentView === "chat" && focusedConversationId === conversationId;

      if (isViewingConversation) {
        return;
      }

      setUnreadByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? 0) + 1,
      }));

      const senderName =
        (typeof data.sender_name === "string" && data.sender_name.trim()) ||
        (data.sender_id ? friendNames[data.sender_id] : undefined) ||
        "một người dùng";

      const body = `Bạn có tin nhắn mới từ ${senderName}`;

      if (!mutedByConversation[conversationId]) {
        pushTopup(conversationId, body, messageId ?? undefined);
      }
    };

    on("message:receive", handleRealtimeNotification);
    on("notification:new_message", handleRealtimeNotification);
    on("notification:reply", handleRealtimeNotification);

    return () => {
      off("message:receive", handleRealtimeNotification);
      off("notification:new_message", handleRealtimeNotification);
      off("notification:reply", handleRealtimeNotification);
    };
  }, [
    currentUserId,
    currentView,
    focusedConversationId,
    friendNames,
    mutedByConversation,
    off,
    on,
    pushTopup,
  ]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Zalo Lite</h1>
          <p className="text-slate-500 mt-2">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden bg-slate-50">
      {topups.length > 0 && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-200 flex w-[320px] flex-col gap-2">
          {topups.map((topup) => (
            <div
              key={topup.id}
              role="button"
              tabIndex={0}
              onClick={() => handleTopupClick(topup)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleTopupClick(topup);
                }
              }}
              className="pointer-events-auto rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-lg transition-colors hover:bg-blue-50"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                {topup.title}
              </p>
              <p className="mt-1 text-sm text-slate-700">{topup.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Gọi Component Sidebar và truyền prop */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        unreadCount={unreadCount}
      />

      {/* Hiển thị Component động dựa vào State */}
      <div className="flex-1 flex overflow-hidden">
        {currentView === "chat" && (
          <ChatView
            onFocusedConversationChange={handleFocusedConversationChange}
            unreadByConversation={unreadByConversation}
            onUnreadByConversationChange={setUnreadByConversation}
            mutedByConversation={mutedByConversation}
            onMutedByConversationChange={setMutedByConversation}
            pendingJump={pendingJump}
            onPendingJumpHandled={() => setPendingJump(null)}
          />
        )}
        {currentView === "chatbot" && <ChatbotView />}
        {currentView === "history" && <HistoryView />}
        {currentView === "stats" && <StatsView />}
        {currentView === "friends" && <FriendsView />}
        {currentView === "profile" && <ProfileView />}
      </div>
    </div>
  );
}
