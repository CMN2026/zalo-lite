"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Search,
  Send,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  discoverUsers,
  getMe,
  listFriends,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  type FriendRequest,
  type ProfileUser,
} from "../lib/users";
import UserProfileModal from "./UserProfileModal";
import type { AppLanguage } from "./SettingsView";

type TabId = "friends" | "search" | "requests" | "sent";
const AUTO_REFRESH_INTERVAL_MS = 30_000;

type SocketListener = (event: string, callback: (data: unknown) => void) => void;

type FriendNotification = {
  id: string;
  title: string;
  body: string;
};

interface FriendsViewProps {
  language?: AppLanguage;
  onStartChat?: (friend: ProfileUser) => Promise<void>;
  onRealtimeEvent?: SocketListener;
  offRealtimeEvent?: SocketListener;
}

export default function FriendsView({
  language = "vi",
  onStartChat,
  onRealtimeEvent,
  offRealtimeEvent,
}: Readonly<FriendsViewProps>) {
  const t =
    language === "en"
      ? {
          friends: "Friends",
          subtitle:
            "Search by phone number, manage requests, and keep your contacts updated.",
          currentPhone: "Current phone number:",
          tabFriends: "Friends",
          tabSearch: "Search",
          tabRequests: "Requests",
          tabSent: "Sent",
          searchFriends: "Search friends...",
          refresh: "Refresh",
          loadingFriends: "Loading friends list...",
          noFriends: "No friends found.",
          chat: "Message",
          opening: "Opening...",
          removing: "Removing...",
          unfriend: "Unfriend",
          searchByPhone: "Search by phone number",
          phoneHint: "Enter a phone number or partial number.",
          phone: "Phone number",
          optionalMessage: "Optional message",
          searching: "Searching...",
          searchBtn: "Search",
          searchResult: "Search results",
          sendReqHint: "Send a friend request to active users.",
          noSearchResult: "Search results will appear here.",
          sending: "Sending...",
          addFriend: "Add friend",
          incomingTitle: "Incoming requests",
          incomingHint: "Accept or reject requests from others.",
          loadingReq: "Loading requests...",
          noReq: "No friend requests.",
          accept: "Accept",
          reject: "Reject",
          sentTitle: "Sent requests",
          sentHint: "Track pending friend requests.",
          loadingSent: "Loading sent requests...",
          noSent: "No sent requests yet.",
          pending: "Pending",
        }
      : {
          friends: "Bạn bè",
          subtitle:
            "Tìm kiếm bằng số điện thoại, quản lý lời mời và giữ danh bạ luôn cập nhật.",
          currentPhone: "Số điện thoại đang dùng:",
          tabFriends: "Bạn bè",
          tabSearch: "Tìm kiếm",
          tabRequests: "Lời mời",
          tabSent: "Đã gửi",
          searchFriends: "Tìm bạn bè...",
          refresh: "Làm mới",
          loadingFriends: "Đang tải danh sách bạn bè...",
          noFriends: "Chưa tìm thấy bạn bè nào.",
          chat: "Nhắn tin",
          opening: "Đang mở...",
          removing: "Đang hủy...",
          unfriend: "Hủy kết bạn",
          searchByPhone: "Tìm bằng số điện thoại",
          phoneHint: "Nhập số điện thoại hoặc một phần số điện thoại.",
          phone: "Số điện thoại",
          optionalMessage: "Lời nhắn tùy chọn",
          searching: "Đang tìm...",
          searchBtn: "Tìm kiếm",
          searchResult: "Kết quả tìm kiếm",
          sendReqHint: "Gửi lời mời kết bạn đến người dùng đang hoạt động.",
          noSearchResult: "Kết quả tìm kiếm sẽ hiển thị ở đây.",
          sending: "Đang gửi...",
          addFriend: "Kết bạn",
          incomingTitle: "Lời mời đến",
          incomingHint: "Chấp nhận hoặc từ chối người muốn kết bạn với bạn.",
          loadingReq: "Đang tải lời mời...",
          noReq: "Không có lời mời kết bạn nào.",
          accept: "Chấp nhận",
          reject: "Từ chối",
          sentTitle: "Lời mời đã gửi",
          sentHint: "Theo dõi những lời mời kết bạn đang chờ phản hồi.",
          loadingSent: "Đang tải lời mời đã gửi...",
          noSent: "Bạn chưa gửi lời mời kết bạn nào.",
          pending: "Đang chờ",
        };
  const [activeTab, setActiveTab] = useState<TabId>("friends");
  const [currentPhone, setCurrentPhone] = useState("");
  const [friends, setFriends] = useState<ProfileUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<ProfileUser[]>([]);
  const [phoneQuery, setPhoneQuery] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [friendFilter, setFriendFilter] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingOutgoingRequests, setLoadingOutgoingRequests] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [openingChatId, setOpeningChatId] = useState("");
  const [friendToRemove, setFriendToRemove] = useState<ProfileUser | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState<FriendNotification[]>([]);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const filteredFriends = useMemo(() => {
    const query = friendFilter.trim().toLowerCase();
    if (!query) {
      return friends;
    }

    return friends.filter((friend) => {
      return (
        friend.fullName.toLowerCase().includes(query) ||
        (friend.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [friends, friendFilter]);

  useEffect(() => {
    void refreshFriends();
    void refreshRequests();
    void refreshOutgoingRequests();
    void loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const response = await getMe();
      setCurrentPhone(response.data.phone ?? "");
    } catch {
      setCurrentPhone("");
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      if (activeTab === "friends") {
        void refreshFriends({ silent: true });
        return;
      }

      if (activeTab === "requests") {
        void refreshRequests({ silent: true });
        return;
      }

      if (activeTab === "sent") {
        void refreshOutgoingRequests({ silent: true });
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [activeTab]);

  useEffect(() => {
    if (!onRealtimeEvent || !offRealtimeEvent) {
      return;
    }

    const handleIncomingRequest = (payload: unknown) => {
      const requester = getPayloadProfile(payload, "requester");
      const requesterName = requester?.fullName ?? "Một người dùng";
      pushNotification({
        title: "Lời mời kết bạn mới",
        body: `${requesterName} vừa gửi lời mời kết bạn cho bạn.`,
      });
      void refreshRequests({ silent: true });
    };

    const handleAcceptedRequest = (payload: unknown) => {
      const friend = getPayloadProfile(payload, "friend");
      const friendName = friend?.fullName ?? "Một người dùng";
      pushNotification({
        title: "Lời mời đã được chấp nhận",
        body: `${friendName} đã chấp nhận lời mời kết bạn của bạn.`,
      });
      void refreshOutgoingRequests({ silent: true });
      void refreshFriends({ silent: true });
    };

    onRealtimeEvent("friend_request:incoming", handleIncomingRequest);
    onRealtimeEvent("friend_request:accepted", handleAcceptedRequest);

    return () => {
      offRealtimeEvent("friend_request:incoming", handleIncomingRequest);
      offRealtimeEvent("friend_request:accepted", handleAcceptedRequest);
    };
  }, [onRealtimeEvent, offRealtimeEvent]);

  function pushNotification(input: Omit<FriendNotification, "id">) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNotifications((current) => [{ id, ...input }, ...current].slice(0, 3));

    window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id));
    }, 5000);
  }

  async function refreshFriends(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoadingFriends(true);
      setError("");
    }

    try {
      const response = await listFriends();
      setFriends(response.data);
    } catch (err) {
      if (!silent) {
        setError(getFriendlyError(err));
      }
    } finally {
      if (!silent) {
        setLoadingFriends(false);
      }
    }
  }

  async function refreshRequests(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoadingRequests(true);
      setError("");
    }

    try {
      const response = await listIncomingFriendRequests();
      setIncomingRequests(response.data);
    } catch (err) {
      if (!silent) {
        setError(getFriendlyError(err));
      }
    } finally {
      if (!silent) {
        setLoadingRequests(false);
      }
    }
  }

  async function refreshOutgoingRequests(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoadingOutgoingRequests(true);
      setError("");
    }

    try {
      const response = await listOutgoingFriendRequests();
      setOutgoingRequests(response.data);
    } catch (err) {
      if (!silent) {
        setError(getFriendlyError(err));
      }
    } finally {
      if (!silent) {
        setLoadingOutgoingRequests(false);
      }
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = phoneQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError("");
    setNotice("");

    try {
      const response = await discoverUsers(query);
      setSearchResults(response.data);
      if (response.data.length === 0) {
        setNotice("Không tìm thấy người dùng đang hoạt động với số điện thoại này.");
      }
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(user: ProfileUser) {
    if (!user.phone) {
      setError("Người dùng này chưa có số điện thoại.");
      return;
    }

    setBusyId(user.id);
    setError("");
    setNotice("");

    try {
      await sendFriendRequest(user.phone, requestMessage || undefined);
      setNotice(`Đã gửi lời mời kết bạn đến ${user.fullName}.`);
      setSearchResults((current) =>
        current.filter((item) => item.id !== user.id),
      );
      await refreshFriends();
      await refreshRequests();
      await refreshOutgoingRequests();
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleRespond(
    request: FriendRequest,
    action: "accept" | "reject",
  ) {
    setBusyId(request.id);
    setError("");
    setNotice("");

    try {
      await respondFriendRequest(request.id, action);
      setIncomingRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
      setNotice(
        action === "accept"
          ? "Đã chấp nhận lời mời kết bạn."
          : "Đã từ chối lời mời kết bạn.",
      );
      if (action === "accept") {
        void refreshFriends();
      }
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleConfirmRemoveFriend() {
    if (!friendToRemove) {
      return;
    }

    setBusyId(friendToRemove.id);
    setError("");
    setNotice("");

    try {
      await removeFriend(friendToRemove.id);
      setFriends((current) =>
        current.filter((item) => item.id !== friendToRemove.id),
      );
      setNotice(`Đã hủy kết bạn với ${friendToRemove.fullName}.`);
      setFriendToRemove(null);
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleOpenChat(friend: ProfileUser) {
    if (!onStartChat) {
      return;
    }

    setOpeningChatId(friend.id);
    setError("");
    setNotice("");

    try {
      await onStartChat(friend);
    } catch {
      setError("Chỉ có thể nhắn tin khi là đã là bạn bè.");
    } finally {
      setOpeningChatId("");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8 h-full font-sans text-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t.friends}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {t.subtitle}
          </p>
          {currentPhone && (
            <p className="text-xs text-slate-400 mt-1">
              {t.currentPhone} {currentPhone}
            </p>
          )}
        </div>
        <div className="flex bg-white border border-slate-200 rounded-lg p-1">
          <TabButton
            active={activeTab === "friends"}
            onClick={() => setActiveTab("friends")}
            icon={<Users className="w-4 h-4" />}
            label={t.tabFriends}
          />
          <TabButton
            active={activeTab === "search"}
            onClick={() => setActiveTab("search")}
            icon={<UserPlus className="w-4 h-4" />}
            label={t.tabSearch}
          />
          <TabButton
            active={activeTab === "requests"}
            onClick={() => setActiveTab("requests")}
            icon={<UserCheck className="w-4 h-4" />}
            label={t.tabRequests}
            badgeCount={incomingRequests.length}
          />
          <TabButton
            active={activeTab === "sent"}
            onClick={() => setActiveTab("sent")}
            icon={<Send className="w-4 h-4" />}
            label={t.tabSent}
            badgeCount={outgoingRequests.length}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {notice}
        </div>
      )}

      {notifications.length > 0 && (
        <div className="fixed right-5 top-5 z-50 flex w-80 flex-col gap-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="rounded-lg border border-blue-100 bg-white px-4 py-3 shadow-lg"
            >
              <div className="text-sm font-semibold text-slate-900">
                {notification.title}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {notification.body}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "friends" && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={friendFilter}
                onChange={(event) => setFriendFilter(event.target.value)}
                placeholder={t.searchFriends}
                className="w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2 pl-9 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => void refreshFriends()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {t.refresh}
            </button>
          </div>

          {loadingFriends ? (
            <EmptyState text={t.loadingFriends} />
          ) : filteredFriends.length === 0 ? (
            <EmptyState text={t.noFriends} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredFriends.map((friend) => (
                <UserRow
                  key={friend.id}
                  user={friend}
                  onClickAvatar={() => setProfileUserId(friend.id)}
                  meta={friend.phone ?? "Chưa có số điện thoại"}
                  action={
                    <div className="flex items-center gap-2">
                      <span className="bg-green-50 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                        Bạn bè
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleOpenChat(friend)}
                        disabled={!onStartChat || openingChatId === friend.id}
                        className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full disabled:opacity-60"
                      >
                        {openingChatId === friend.id ? t.opening : t.chat}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFriendToRemove(friend)}
                        disabled={busyId === friend.id}
                        className="bg-white border border-red-200 text-red-600 text-xs font-semibold px-3 py-1 rounded-full disabled:opacity-60"
                      >
                        {busyId === friend.id ? t.removing : t.unfriend}
                      </button>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "search" && (
        <section className="grid grid-cols-[360px_1fr] gap-6">
          <form
            onSubmit={handleSearch}
            className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-fit"
          >
            <h2 className="font-bold text-lg">{t.searchByPhone}</h2>
            <p className="text-sm text-slate-500 mt-1 mb-5">
              {t.phoneHint}
            </p>
            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase text-slate-500">
                {t.phone}
              </span>
              <input
                value={phoneQuery}
                onChange={(event) => setPhoneQuery(event.target.value)}
                placeholder="0911222333"
                className="mt-1 w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 px-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block mb-5">
              <span className="text-xs font-semibold uppercase text-slate-500">
                {t.optionalMessage}
              </span>
              <textarea
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                rows={4}
                maxLength={150}
                placeholder="Mình kết bạn nhé."
                className="mt-1 w-full bg-slate-50 border border-slate-200 text-sm rounded-lg py-2.5 px-3 outline-none resize-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <button
              disabled={searching}
              className="w-full bg-blue-600 text-white flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-70"
            >
              <Search className="w-4 h-4" />
              {searching ? t.searching : t.searchBtn}
            </button>
          </form>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="font-bold">{t.searchResult}</h2>
              <p className="text-sm text-slate-500">
                {t.sendReqHint}
              </p>
            </div>
            {searchResults.length === 0 ? (
              <EmptyState text={t.noSearchResult} />
            ) : (
              <div className="divide-y divide-slate-100">
                {searchResults.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onClickAvatar={() => setProfileUserId(user.id)}
                    meta={user.phone ?? "Chưa có số điện thoại"}
                    action={
                      <button
                        onClick={() => void handleSendRequest(user)}
                        disabled={busyId === user.id}
                        className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-70"
                      >
                        <Send className="w-4 h-4" />
                        {busyId === user.id ? t.sending : t.addFriend}
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "requests" && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold">{t.incomingTitle}</h2>
              <p className="text-sm text-slate-500">
                {t.incomingHint}
              </p>
            </div>
            <button
              onClick={() => void refreshRequests()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {t.refresh}
            </button>
          </div>

          {loadingRequests ? (
            <EmptyState text={t.loadingReq} />
          ) : incomingRequests.length === 0 ? (
            <EmptyState text={t.noReq} />
          ) : (
            <div className="divide-y divide-slate-100">
              {incomingRequests.map((request) => {
                const requester = request.requester;
                return (
                  <UserRow
                    key={request.id}
                    user={requester}
                    fallbackName="Người gửi không xác định"
                    meta={request.message || requester?.phone || "Không có lời nhắn"}
                    action={
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleRespond(request, "accept")}
                          disabled={busyId === request.id}
                          className="bg-green-600 text-white flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-70"
                        >
                          <Check className="w-4 h-4" />
                          {t.accept}
                        </button>
                        <button
                          onClick={() => void handleRespond(request, "reject")}
                          disabled={busyId === request.id}
                          className="bg-white border border-slate-200 text-slate-700 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-70"
                        >
                          <X className="w-4 h-4" />
                          {t.reject}
                        </button>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === "sent" && (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold">{t.sentTitle}</h2>
              <p className="text-sm text-slate-500">
                {t.sentHint}
              </p>
            </div>
            <button
              onClick={() => void refreshOutgoingRequests()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {t.refresh}
            </button>
          </div>

          {loadingOutgoingRequests ? (
            <EmptyState text={t.loadingSent} />
          ) : outgoingRequests.length === 0 ? (
            <EmptyState text={t.noSent} />
          ) : (
            <div className="divide-y divide-slate-100">
              {outgoingRequests.map((request) => {
                const addressee = request.addressee;
                return (
                  <UserRow
                    key={request.id}
                    user={addressee}
                    fallbackName="Người nhận không xác định"
                    meta={request.message || addressee?.phone || "Không có lời nhắn"}
                    action={
                      <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full">
                        {t.pending}
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {friendToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-friend-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 px-6 py-4">
              <h2
                id="remove-friend-title"
                className="text-lg font-semibold text-slate-900"
              >
                Hủy kết bạn
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Người này sẽ bị xóa khỏi danh sách bạn bè của bạn.
              </p>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700">
                Bạn có chắc muốn hủy kết bạn với{" "}
                <span className="font-semibold text-slate-900">
                  {friendToRemove.fullName}
                </span>
                ?
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setFriendToRemove(null)}
                disabled={busyId === friendToRemove.id}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Giữ lại
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRemoveFriend()}
                disabled={busyId === friendToRemove.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {busyId === friendToRemove.id ? "Đang hủy..." : "Hủy kết bạn"}
              </button>
            </div>
          </div>
        </div>
      )}

      {profileUserId && (
        <UserProfileModal
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
          onMessage={(userId) => {
            setProfileUserId(null);
            setTimeout(() => {
              const friend =
                friends.find((item) => item.id === userId) ||
                searchResults.find((item) => item.id === userId);
              if (friend) {
                void handleOpenChat(friend);
              }
            }, 100);
          }}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badgeCount,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badgeCount?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
        active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {Boolean(badgeCount) && (
        <span className="absolute -left-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white shadow-sm">
          {badgeCount}
        </span>
      )}
      {icon}
      {label}
    </button>
  );
}

function UserRow({
  user,
  meta,
  action,
  fallbackName = "Người dùng không xác định",
  onClickAvatar,
}: {
  user?: ProfileUser;
  meta: string;
  action: React.ReactNode;
  onClickAvatar?: () => void;
  fallbackName?: string;
}) {
  const name = user?.fullName ?? fallbackName;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="p-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onClickAvatar}
        className={
          onClickAvatar
            ? "cursor-pointer hover:opacity-80 transition-opacity"
            : "cursor-default"
        }
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={name}
            className="w-11 h-11 rounded-full object-cover"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
            {initials}
          </div>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{name}</div>
        <div className="text-xs text-slate-500 truncate mt-0.5">{meta}</div>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-slate-500">{text}</div>;
}

function getPayloadProfile(payload: unknown, key: "requester" | "friend") {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  if (!value || typeof value !== "object") {
    return null;
  }

  const profile = value as Partial<ProfileUser>;
  return typeof profile.fullName === "string" ? profile : null;
}

function getFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "request_failed";
  const labels: Record<string, string> = {
    missing_local_session: "Vui lòng đăng nhập trước khi quản lý bạn bè.",
    missing_bearer_token: "Vui lòng đăng nhập trước khi quản lý bạn bè.",
    invalid_or_expired_token: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    validation_error: "Vui lòng kiểm tra thông tin và thử lại.",
    target_user_not_found: "Không có người dùng nào với số điện thoại này.",
    target_user_inactive: "Tài khoản người dùng này đang bị vô hiệu hóa.",
    cannot_add_yourself: "Bạn không thể tự kết bạn với chính mình.",
    already_friends: "Hai bạn đã là bạn bè.",
    friend_request_already_pending: "Lời mời kết bạn đang chờ phản hồi.",
    friendship_blocked: "Quan hệ bạn bè này đã bị chặn.",
    friendship_not_found: "Không tìm thấy quan hệ bạn bè này.",
    friend_request_not_found: "Lời mời này không còn tồn tại.",
    friend_request_already_processed: "Lời mời này đã được xử lý.",
  };

  return labels[message] ?? "Có lỗi xảy ra. Vui lòng thử lại.";
}
