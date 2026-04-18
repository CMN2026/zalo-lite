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

function getFriendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "request_failed";
  const labels: Record<string, string> = {
    missing_local_session: "Vui lòng đăng nhập lại.",
    invalid_or_expired_token: "Phiên đăng nhập hết hạn.",
    target_user_not_found: "Không tìm thấy người dùng với số điện thoại này.",
    cannot_add_yourself: "Không thể tự kết bạn với chính mình.",
    already_friends: "Hai bạn đã là bạn bè rồi.",
    friend_request_already_pending: "Đã có lời mời kết bạn đang chờ.",
  };
  return labels[message] ?? "Đã xảy ra lỗi. Vui lòng thử lại.";
}

function UserAvatar({ user, fallbackName = "?" }: { user?: ProfileUser; fallbackName?: string }) {
  const name = user?.fullName ?? fallbackName;
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
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

  const filteredFriends = useMemo(() => {
    const q = friendFilter.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.fullName.toLowerCase().includes(q) || (f.phone ?? "").toLowerCase().includes(q)
    );
  }, [friends, friendFilter]);

  useEffect(() => {
    refreshFriends();
    refreshRequests();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshRequests(true);
      if (activeTab === "friends") refreshFriends(true);
    }, 8000);
    return () => clearInterval(timer);
  }, [activeTab]);

  async function refreshFriends(silent = false) {
    if (!silent) { setLoadingFriends(true); setError(""); }
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
    if (!silent) { setLoadingRequests(true); setError(""); }
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
    const q = phoneQuery.trim();
    if (!q) { setSearchResults([]); return; }
    setSearching(true); setError(""); setNotice("");
    try {
      const res = await discoverUsers(q);
      setSearchResults(res.data);
      if (res.data.length === 0) setNotice("Không tìm thấy người dùng nào với số điện thoại này.");
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(user: ProfileUser) {
    if (!user.phone) { setError("Người dùng này không có số điện thoại."); return; }
    setBusyId(user.id); setError(""); setNotice("");
    try {
      await sendFriendRequest(user.phone, requestMessage || undefined);
      setNotice(`Đã gửi lời mời kết bạn đến ${user.fullName}.`);
      setSearchResults((cur) => cur.filter((u) => u.id !== user.id));
      refreshFriends();
      refreshRequests();
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleRespond(req: FriendRequest, action: "accept" | "reject") {
    setBusyId(req.id); setError(""); setNotice("");
    try {
      await respondFriendRequest(req.id, action);
      setIncomingRequests((cur) => cur.filter((r) => r.id !== req.id));
      setNotice(action === "accept" ? "Đã chấp nhận lời mời kết bạn." : "Đã từ chối lời mời kết bạn.");
      if (action === "accept") refreshFriends();
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId("");
    }
  }

  // Open a direct conversation with a friend
  async function openChatWithFriend(friend: ProfileUser) {
    setOpeningChatId(friend.id);
    try {
      const token = await getAuthToken();
      // Try to find or create direct conversation
      const res = await fetch(`${API_BASE_URL}/api/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ memberIds: [friend.id], type: "direct" }),
      });

      let conversationId: string | null = null;
      if (res.ok) {
        const data = await res.json();
        conversationId = data.data?.id ?? data.id ?? null;
      } else if (res.status === 409 || res.status === 400) {
        // Conversation already exists — fetch conversations list to find it
        const listRes = await fetch(`${API_BASE_URL}/api/conversations`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const convs = (listData.data ?? []) as any[];
          const existing = convs.find(
            (c: any) =>
              c.type === "direct" &&
              Array.isArray(c.memberIds) &&
              c.memberIds.includes(friend.id)
          );
          conversationId = existing?.id ?? null;
        }
      }

      if (conversationId) {
        // Navigate to Chat tab and pass the conversationId as param
        router.navigate({
          pathname: "/(tabs)/",
          params: { openConversationId: conversationId },
        });
      } else {
        setError("Không thể mở cuộc trò chuyện. Vui lòng thử lại.");
      }
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setOpeningChatId("");
    }
  }

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: "friends", label: "Bạn bè" },
    { id: "search", label: "Tìm kiếm" },
    { id: "requests", label: "Lời mời", badge: incomingRequests.length },
  ];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="bg-white px-4 pt-3 pb-0 border-b border-slate-200">
        <Text className="text-xl font-bold text-slate-800 mb-3">Danh bạ</Text>
        <View className="flex-row gap-1">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => { setActiveTab(tab.id); setError(""); setNotice(""); }}
              className={`flex-1 items-center py-2 rounded-t-lg relative ${activeTab === tab.id ? "bg-blue-600" : "bg-slate-100"}`}
            >
              <Text className={`text-xs font-semibold ${activeTab === tab.id ? "text-white" : "text-slate-600"}`}>
                {tab.label}
              </Text>
              {(tab.badge ?? 0) > 0 && (
                <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full items-center justify-center px-1">
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

      {/* ── FRIENDS TAB ── */}
      {activeTab === "friends" && (
        <View className="flex-1">
          <View className="mx-4 mt-3 mb-2 flex-row items-center gap-2">
            <TextInput
              value={friendFilter}
              onChangeText={setFriendFilter}
              placeholder="Tìm bạn bè..."
              className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm"
            />
            <TouchableOpacity onPress={() => refreshFriends()} className="bg-blue-600 px-4 py-2 rounded-lg">
              <Text className="text-white text-sm font-semibold">Refresh</Text>
            </TouchableOpacity>
          </View>

          {loadingFriends ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : filteredFriends.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-slate-400 text-sm">Chưa có bạn bè nào</Text>
            </View>
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => openChatWithFriend(item)}
                  disabled={openingChatId === item.id}
                  className="flex-row items-center px-4 py-3 bg-white border-b border-slate-50 active:bg-slate-50"
                >
                  <UserAvatar user={item} />
                  <View className="flex-1 ml-3">
                    <Text className="font-semibold text-slate-800">{item.fullName}</Text>
                    <Text className="text-xs text-slate-500 mt-0.5">{item.phone ?? "Không có số điện thoại"}</Text>
                  </View>
                  {openingChatId === item.id ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <View className="flex-row items-center gap-2">
                      <View className="bg-blue-50 px-3 py-1.5 rounded-full flex-row items-center gap-1">
                        <Text className="text-blue-600 text-xs font-semibold">💬 Nhắn tin</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* ── SEARCH TAB ── */}
      {activeTab === "search" && (
        <View className="flex-1 px-4 pt-3">
          <View className="bg-white rounded-xl border border-slate-100 p-4 mb-3">
            <Text className="font-bold text-base text-slate-800 mb-1">Tìm theo số điện thoại</Text>
            <Text className="text-xs text-slate-500 mb-3">Nhập số điện thoại hoặc một phần số.</Text>
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
              placeholder="Lời nhắn (tuỳ chọn)..."
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
              {searching ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Tìm kiếm</Text>}
            </TouchableOpacity>
          </View>

          <View className="bg-white rounded-xl border border-slate-100 flex-1 overflow-hidden">
            <View className="px-4 py-3 border-b border-slate-100">
              <Text className="font-bold text-slate-800">Kết quả tìm kiếm</Text>
            </View>
            {searchResults.length === 0 ? (
              <View className="p-8 items-center justify-center">
                <Text className="text-slate-400 text-sm">Kết quả sẽ hiển thị ở đây.</Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View className="flex-row items-center px-4 py-3 border-b border-slate-50">
                    <UserAvatar user={item} />
                    <View className="flex-1 ml-3">
                      <Text className="font-semibold text-slate-800">{item.fullName}</Text>
                      <Text className="text-xs text-slate-500 mt-0.5">{item.phone ?? "Không có số"}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleSendRequest(item)}
                      disabled={busyId === item.id}
                      className={`bg-blue-600 px-3 py-1.5 rounded-lg ${busyId === item.id ? "opacity-70" : ""}`}
                    >
                      {busyId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-white text-xs font-semibold">Kết bạn</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      )}

      {/* ── REQUESTS TAB ── */}
      {activeTab === "requests" && (
        <View className="flex-1">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="font-bold text-slate-800">Lời mời kết bạn</Text>
            <TouchableOpacity onPress={() => refreshRequests()} className="bg-blue-600 px-3 py-1.5 rounded-lg">
              <Text className="text-white text-xs font-semibold">Refresh</Text>
            </TouchableOpacity>
          </View>

          {loadingRequests ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : incomingRequests.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-slate-400 text-sm">Không có lời mời kết bạn nào.</Text>
            </View>
          ) : (
            <FlatList
              data={incomingRequests}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const requester = item.requester;
                return (
                  <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-50">
                    <UserAvatar user={requester} fallbackName="?" />
                    <View className="flex-1 ml-3">
                      <Text className="font-semibold text-slate-800">{requester?.fullName ?? "Người dùng ẩn danh"}</Text>
                      <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
                        {item.message ?? requester?.phone ?? "Không có lời nhắn"}
                      </Text>
                    </View>
                    <View className="flex-row gap-2 ml-2">
                      <TouchableOpacity
                        onPress={() => handleRespond(item, "accept")}
                        disabled={busyId === item.id}
                        className={`bg-green-600 px-3 py-1.5 rounded-lg ${busyId === item.id ? "opacity-70" : ""}`}
                      >
                        <Text className="text-white text-xs font-semibold">Đồng ý</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRespond(item, "reject")}
                        disabled={busyId === item.id}
                        className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg"
                      >
                        <Text className="text-slate-700 text-xs font-semibold">Từ chối</Text>
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
