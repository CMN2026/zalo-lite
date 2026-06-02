import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSettings } from "../../contexts/settings";
import {
  discoverUsers,
  listFriends,
  listIncomingFriendRequests,
  respondFriendRequest,
  sendFriendRequest,
  type FriendRequest,
  type ProfileUser,
} from "../../lib/users";
import { getAuthToken } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";

type TabId = "friends" | "search" | "requests";

function UserAvatar({ user, fallbackName = "?" }: { user?: ProfileUser; fallbackName?: string }) {
  const name = user?.fullName ?? fallbackName;
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  if (user?.avatarUrl) {
    return <Image source={{ uri: user.avatarUrl }} className="w-12 h-12 rounded-full bg-slate-200" />;
  }
  return (
    <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
      <Text className="text-blue-700 font-bold text-sm">{initials}</Text>
    </View>
  );
}

export default function FriendsScreen() {
  const router = useRouter();
  const { language } = useSettings();
  const t =
    language === "en"
      ? {
          labels: {
            missing_local_session: "Please sign in again.",
            invalid_or_expired_token: "Your session has expired.",
            target_user_not_found: "No user found with this phone number.",
            cannot_add_yourself: "You cannot add yourself.",
            already_friends: "You are already friends.",
            friend_request_already_pending: "There is already a pending friend request.",
          } satisfies Record<string, string>,
          genericError: "Something went wrong. Please try again.",
          contacts: "Contacts",
          friends: "Friends",
          search: "Search",
          requests: "Requests",
          refresh: "Refresh",
          searchFriends: "Search friends...",
          noFriends: "No friends yet",
          noPhone: "No phone number",
          noPhoneShort: "No phone",
          openChatFailed: "Unable to open the conversation. Please try again.",
          connectFailed: "Unable to connect. Please try again.",
          searchByPhone: "Search by phone number",
          searchHint: "Enter a full or partial phone number.",
          requestMessage: "Message (optional)...",
          searchAction: "Search",
          searchResults: "Search results",
          emptyResults: "Results will appear here.",
          noUsersFound: "No user found with this phone number.",
          addFriend: "Add friend",
          requestSent: (name: string) => `Friend request sent to ${name}.`,
          requestsTitle: "Friend requests",
          noRequests: "No friend requests.",
          anonymousUser: "Anonymous user",
          noMessage: "No message",
          accept: "Accept",
          reject: "Decline",
          accepted: "Friend request accepted.",
          rejected: "Friend request declined.",
        }
      : {
          labels: {
            missing_local_session: "Vui lòng đăng nhập lại.",
            invalid_or_expired_token: "Phiên đăng nhập hết hạn.",
            target_user_not_found: "Không tìm thấy người dùng với số điện thoại này.",
            cannot_add_yourself: "Không thể tự kết bạn với chính mình.",
            already_friends: "Hai bạn đã là bạn bè rồi.",
            friend_request_already_pending: "Đã có lời mời kết bạn đang chờ.",
          } satisfies Record<string, string>,
          genericError: "Đã xảy ra lỗi. Vui lòng thử lại.",
          contacts: "Danh bạ",
          friends: "Bạn bè",
          search: "Tìm kiếm",
          requests: "Lời mời",
          refresh: "Refresh",
          searchFriends: "Tìm bạn bè...",
          noFriends: "Chưa có bạn bè nào",
          noPhone: "Không có số điện thoại",
          noPhoneShort: "Không có số",
          openChatFailed: "Không thể mở cuộc trò chuyện. Vui lòng thử lại.",
          connectFailed: "Không thể kết nối. Vui lòng thử lại.",
          searchByPhone: "Tìm theo số điện thoại",
          searchHint: "Nhập số điện thoại hoặc một phần số.",
          requestMessage: "Lời nhắn (tuỳ chọn)...",
          searchAction: "Tìm kiếm",
          searchResults: "Kết quả tìm kiếm",
          emptyResults: "Kết quả sẽ hiển thị ở đây.",
          noUsersFound: "Không tìm thấy người dùng nào với số điện thoại này.",
          addFriend: "Kết bạn",
          requestSent: (name: string) => `Đã gửi lời mời kết bạn đến ${name}.`,
          requestsTitle: "Lời mời kết bạn",
          noRequests: "Không có lời mời kết bạn nào.",
          anonymousUser: "Người dùng ẩn danh",
          noMessage: "Không có lời nhắn",
          accept: "Đồng ý",
          reject: "Từ chối",
          accepted: "Đã chấp nhận lời mời kết bạn.",
          rejected: "Đã từ chối lời mời kết bạn.",
        };

  const [activeTab, setActiveTab] = useState<TabId>("friends");
  const [friends, setFriends] = useState<ProfileUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<ProfileUser[]>([]);
  const [phoneQuery, setPhoneQuery] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [friendFilter, setFriendFilter] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [openingChatId, setOpeningChatId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const getFriendlyError = (err: unknown) => {
    const message = err instanceof Error ? err.message : "request_failed";
    return t.labels[message] ?? t.genericError;
  };

  const filteredFriends = useMemo(() => {
    const query = friendFilter.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter(
      (friend) =>
        friend.fullName.toLowerCase().includes(query) ||
        (friend.phone ?? "").toLowerCase().includes(query),
    );
  }, [friendFilter, friends]);

  useEffect(() => {
    void refreshFriends();
    void refreshRequests();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshRequests(true);
      if (activeTab === "friends") {
        void refreshFriends(true);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [activeTab]);

  async function refreshFriends(silent = false) {
    if (!silent) {
      setLoadingFriends(true);
      setError("");
    }
    try {
      const res = await listFriends();
      setFriends(res.data);
    } catch (err) {
      if (!silent) setError(getFriendlyError(err));
    } finally {
      if (!silent) setLoadingFriends(false);
    }
  }

  async function refreshRequests(silent = false) {
    if (!silent) {
      setLoadingRequests(true);
      setError("");
    }
    try {
      const res = await listIncomingFriendRequests();
      setIncomingRequests(res.data);
    } catch (err) {
      if (!silent) setError(getFriendlyError(err));
    } finally {
      if (!silent) setLoadingRequests(false);
    }
  }

  async function handleSearch() {
    const query = phoneQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError("");
    setNotice("");
    try {
      const res = await discoverUsers(query);
      setSearchResults(res.data);
      if (res.data.length === 0) {
        setNotice(t.noUsersFound);
      }
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(user: ProfileUser) {
    if (!user.phone) {
      setError(t.noPhone);
      return;
    }
    setBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await sendFriendRequest(user.phone, requestMessage || undefined);
      setNotice(t.requestSent(user.fullName));
      setSearchResults((current) => current.filter((candidate) => candidate.id !== user.id));
      void refreshFriends();
      void refreshRequests();
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleRespond(req: FriendRequest, action: "accept" | "reject") {
    setBusyId(req.id);
    setError("");
    setNotice("");
    try {
      await respondFriendRequest(req.id, action);
      setIncomingRequests((current) => current.filter((item) => item.id !== req.id));
      setNotice(action === "accept" ? t.accepted : t.rejected);
      if (action === "accept") {
        void refreshFriends();
      }
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId("");
    }
  }

  async function openChatWithFriend(friend: ProfileUser) {
    setOpeningChatId(friend.id);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/conversations/direct`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ userId: friend.id }),
      });

      let conversationId: string | null = null;
      if (res.ok) {
        const data = await res.json();
        conversationId = data.data?.id ?? data.id ?? null;
      }

      if (conversationId) {
        router.navigate({
          pathname: "/",
          params: {
            openConversationId: conversationId,
            openConversationNonce: Date.now().toString(),
          },
        });
      } else {
        setError(t.openChatFailed);
      }
    } catch {
      setError(t.connectFailed);
    } finally {
      setOpeningChatId("");
    }
  }

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: "friends", label: t.friends },
    { id: "search", label: t.search },
    { id: "requests", label: t.requests, badge: incomingRequests.length },
  ];

  return (
    <SafeAreaView className="flex-1 bg-zalo-bg">
      <View className="bg-zalo-blue px-4 pt-3 pb-0">
        <Text className="text-xl font-bold text-white mb-3">{t.contacts}</Text>
        <View className="flex-row gap-1">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                setActiveTab(tab.id);
                setError("");
                setNotice("");
              }}
              className={`flex-1 items-center py-2 relative border-b-2 ${activeTab === tab.id ? "border-white" : "border-transparent"}`}
            >
              <Text className={`text-sm font-medium ${activeTab === tab.id ? "text-white" : "text-blue-100"}`}>
                {tab.label}
              </Text>
              {(tab.badge ?? 0) > 0 && (
                <View className="absolute -top-1 right-2 min-w-[18px] h-[18px] bg-red-500 rounded-full items-center justify-center px-1">
                  <Text className="text-white text-[10px] font-bold">{tab.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {error ? (
        <View className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View className="mx-4 mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <Text className="text-blue-700 text-sm">{notice}</Text>
        </View>
      ) : null}

      {activeTab === "friends" && (
        <View className="flex-1">
          <View className="mx-4 mt-3 mb-2 flex-row items-center gap-2">
            <TextInput
              value={friendFilter}
              onChangeText={setFriendFilter}
              placeholder={t.searchFriends}
              className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm"
            />
            <TouchableOpacity onPress={() => void refreshFriends()} className="bg-blue-600 px-4 py-2 rounded-lg">
              <Text className="text-white text-sm font-semibold">{t.refresh}</Text>
            </TouchableOpacity>
          </View>

          {loadingFriends ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : filteredFriends.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-slate-400 text-sm">{t.noFriends}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/user/[id]", params: { id: item.id } })}
                  onLongPress={() => void openChatWithFriend(item)}
                  className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100 active:bg-slate-50"
                >
                  <UserAvatar user={item} />
                  <View className="flex-1 ml-3">
                    <Text className="font-semibold text-zalo-text">{item.fullName}</Text>
                    <Text className="text-xs text-slate-500 mt-0.5">{item.phone ?? t.noPhone}</Text>
                  </View>
                  {openingChatId === item.id ? <ActivityIndicator size="small" color="#2563EB" /> : null}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {activeTab === "search" && (
        <View className="flex-1 px-4 pt-3">
          <View className="bg-white rounded-xl border border-slate-100 p-4 mb-3">
            <Text className="font-bold text-base text-slate-800 mb-1">{t.searchByPhone}</Text>
            <Text className="text-xs text-slate-500 mb-3">{t.searchHint}</Text>
            <TextInput
              value={phoneQuery}
              onChangeText={setPhoneQuery}
              placeholder="0911222333"
              keyboardType="phone-pad"
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-3"
            />
            <TextInput
              value={requestMessage}
              onChangeText={setRequestMessage}
              placeholder={t.requestMessage}
              multiline
              numberOfLines={3}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-3"
              style={{ textAlignVertical: "top", minHeight: 80 }}
            />
            <TouchableOpacity
              onPress={handleSearch}
              disabled={searching}
              className={`bg-blue-600 py-2.5 rounded-lg items-center ${searching ? "opacity-70" : ""}`}
            >
              {searching ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">{t.searchAction}</Text>}
            </TouchableOpacity>
          </View>

          <View className="bg-white rounded-xl border border-slate-100 flex-1 overflow-hidden">
            <View className="px-4 py-3 border-b border-slate-100">
              <Text className="font-bold text-slate-800">{t.searchResults}</Text>
            </View>
            {searchResults.length === 0 ? (
              <View className="p-8 items-center justify-center">
                <Text className="text-slate-400 text-sm">{t.emptyResults}</Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100">
                    <UserAvatar user={item} />
                    <View className="flex-1 ml-3">
                      <Text className="font-semibold text-zalo-text">{item.fullName}</Text>
                      <Text className="text-xs text-slate-500 mt-0.5">{item.phone ?? t.noPhoneShort}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => void handleSendRequest(item)}
                      disabled={busyId === item.id}
                      className={`bg-blue-600 px-3 py-1.5 rounded-lg ${busyId === item.id ? "opacity-70" : ""}`}
                    >
                      {busyId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-white text-xs font-semibold">{t.addFriend}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      )}

      {activeTab === "requests" && (
        <View className="flex-1">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="font-bold text-slate-800">{t.requestsTitle}</Text>
            <TouchableOpacity onPress={() => void refreshRequests()} className="bg-blue-600 px-3 py-1.5 rounded-lg">
              <Text className="text-white text-xs font-semibold">{t.refresh}</Text>
            </TouchableOpacity>
          </View>

          {loadingRequests ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : incomingRequests.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-slate-400 text-sm">{t.noRequests}</Text>
            </View>
          ) : (
            <FlatList
              data={incomingRequests}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const requester = item.requester;
                return (
                  <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100">
                    <UserAvatar user={requester} fallbackName="?" />
                    <View className="flex-1 ml-3">
                      <Text className="font-semibold text-zalo-text">{requester?.fullName ?? t.anonymousUser}</Text>
                      <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
                        {item.message ?? requester?.phone ?? t.noMessage}
                      </Text>
                    </View>
                    <View className="flex-row gap-2 ml-2">
                      <TouchableOpacity
                        onPress={() => void handleRespond(item, "accept")}
                        disabled={busyId === item.id}
                        className={`bg-green-600 px-3 py-1.5 rounded-lg ${busyId === item.id ? "opacity-70" : ""}`}
                      >
                        <Text className="text-white text-xs font-semibold">{t.accept}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => void handleRespond(item, "reject")}
                        disabled={busyId === item.id}
                        className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg"
                      >
                        <Text className="text-slate-700 text-xs font-semibold">{t.reject}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
