import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../../contexts/auth";
import { getAuthToken } from "../../lib/auth";
import { getMe, listFriends, type ProfileUser } from "../../lib/users";
import { API_BASE_URL } from "../../lib/api";
import {
  createPost,
  getFeed,
  deletePost as apiDeletePost,
  addComment as apiAddComment,
  getComments,
  deleteComment as apiDeleteComment,
  toggleReaction as apiToggleReaction,
  getPostImageUrl,
  type Post,
  type PostComment as Comment,
  type ReactionType,
  type ReactionSummary,
} from "../../lib/posts";

// ─── Constants ───────────────────────────────────────────────────────────────

const REACTION_CONFIG: {
  key: ReactionType;
  emoji: string;
  label: string;
  color: string;
}[] = [
  { key: "like", emoji: "👍", label: "Thích", color: "#0068FF" },
  { key: "love", emoji: "❤️", label: "Yêu thích", color: "#ef4444" },
  { key: "haha", emoji: "😂", label: "Haha", color: "#f59e0b" },
  { key: "sad", emoji: "😢", label: "Buồn", color: "#f59e0b" },
  { key: "angry", emoji: "😡", label: "Phẫn nộ", color: "#ef4444" },
];

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(isoDate).toLocaleDateString("vi-VN");
}

function totalReactions(summary: ReactionSummary): number {
  if (!summary) return 0;
  return (summary.like ?? 0) + (summary.love ?? 0) + (summary.haha ?? 0) + (summary.sad ?? 0) + (summary.angry ?? 0);
}

// ─── Helper components ───────────────────────────────────────────────────────

function AuthorAvatar({
  userId,
  usersMap,
  size = 40,
}: {
  userId: string;
  usersMap: Record<string, { fullName: string; avatarUrl: string | null }>;
  size?: number;
}) {
  const user = usersMap[userId];
  const name = user?.fullName ?? "User";
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  if (user?.avatarUrl) {
    return (
      <Image
        source={{ uri: user.avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="bg-slate-200"
      />
    );
  }

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-blue-100 items-center justify-center"
    >
      <Text className="text-blue-700 font-bold" style={{ fontSize: size * 0.4 }}>
        {initials}
      </Text>
    </View>
  );
}

function getAuthorName(
  userId: string,
  usersMap: Record<string, { fullName: string; avatarUrl: string | null }>
): string {
  const user = usersMap[userId];
  if (user?.fullName) return user.fullName;
  return `User_${userId.slice(0, 6)}`;
}

function PostImages({
  images,
  postId,
  token,
}: {
  images: string[];
  postId: string;
  token: string;
}) {
  if (!images || images.length === 0) return null;

  const getUrl = (filename: string) => getPostImageUrl(postId, filename, token);

  if (images.length === 1) {
    return (
      <View className="rounded-xl overflow-hidden mb-3">
        <Image
          source={{ uri: getUrl(images[0]) }}
          style={{ width: "100%", height: 280 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  if (images.length === 2) {
    return (
      <View className="flex-row gap-1 mb-3 rounded-xl overflow-hidden">
        <View className="flex-1">
          <Image
            source={{ uri: getUrl(images[0]) }}
            style={{ width: "100%", height: 180 }}
            resizeMode="cover"
          />
        </View>
        <View className="flex-1">
          <Image
            source={{ uri: getUrl(images[1]) }}
            style={{ width: "100%", height: 180 }}
            resizeMode="cover"
          />
        </View>
      </View>
    );
  }

  if (images.length === 3) {
    return (
      <View className="flex-row gap-1 mb-3 h-52 rounded-xl overflow-hidden">
        <View className="flex-1">
          <Image
            source={{ uri: getUrl(images[0]) }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-1">
            <Image
              source={{ uri: getUrl(images[1]) }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </View>
          <View className="flex-1">
            <Image
              source={{ uri: getUrl(images[2]) }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-3 rounded-xl overflow-hidden">
      <View className="flex-row gap-1 h-36 mb-1">
        <View className="flex-1">
          <Image
            source={{ uri: getUrl(images[0]) }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        </View>
        <View className="flex-1">
          <Image
            source={{ uri: getUrl(images[1]) }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        </View>
      </View>
      <View className="flex-row gap-1 h-36">
        <View className="flex-1">
          <Image
            source={{ uri: getUrl(images[2]) }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        </View>
        <View className="flex-1 relative">
          <Image
            source={{ uri: getUrl(images[3]) }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
          {images.length > 4 && (
            <View className="absolute inset-0 bg-black/50 items-center justify-center">
              <Text className="text-white text-lg font-bold">+{images.length - 4}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── PostCard Component ──────────────────────────────────────────────────────

function PostCard({
  post,
  token,
  currentUserId,
  usersMap,
  onDelete,
}: {
  post: Post;
  token: string;
  currentUserId: string;
  usersMap: Record<string, { fullName: string; avatarUrl: string | null }>;
  onDelete: (postId: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionSummary, setReactionSummary] = useState<ReactionSummary>(
    post.reaction_summary ?? { like: 0, love: 0, haha: 0, sad: 0, angry: 0 }
  );
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);

  const isOwner = post.user_id === currentUserId;

  // Retrieve user reaction if exists
  useEffect(() => {
    if (!token || !currentUserId) return;
    fetch(`${API_BASE_URL}/api/posts/${post.id}/reactions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((payload) => {
        const list = payload.data || [];
        const mine = list.find((r: any) => r.user_id === currentUserId);
        if (mine) {
          setMyReaction(mine.reaction);
        }
      })
      .catch((err) => console.log("Error loading post reaction:", err));
  }, [post.id, token, currentUserId]);

  const toggleComments = () => {
    if (!showComments) {
      setLoadingComments(true);
      getComments(token, post.id)
        .then((data) => setComments(data))
        .catch((err) => console.log("Error comments:", err))
        .finally(() => setLoadingComments(false));
    }
    setShowComments(!showComments);
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;
    setSubmittingComment(true);
    try {
      const added = await apiAddComment(token, post.id, newCommentText);
      setComments((prev) => [...prev, added]);
      setNewCommentText("");
      setCommentCount((prev) => prev + 1);
    } catch (err) {
      Alert.alert("Lỗi", "Không thể đăng bình luận.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert("Xoá bình luận", "Bạn có chắc chắn muốn xoá bình luận này?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDeleteComment(token, post.id, commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            setCommentCount((prev) => Math.max(0, prev - 1));
          } catch (err) {
            Alert.alert("Lỗi", "Không thể xoá bình luận.");
          }
        },
      },
    ]);
  };

  const handleToggleReaction = async (reaction: ReactionType) => {
    setShowReactionPicker(false);
    try {
      const sendReaction = myReaction === reaction ? null : reaction;
      const result = await apiToggleReaction(token, post.id, sendReaction);

      const newSummary = { ...reactionSummary };

      if (result.action === "removed") {
        if (myReaction) {
          newSummary[myReaction] = Math.max(0, (newSummary[myReaction] ?? 0) - 1);
        }
        setMyReaction(null);
      } else if (result.action === "added") {
        newSummary[reaction] = (newSummary[reaction] ?? 0) + 1;
        setMyReaction(reaction);
      } else if (result.action === "changed") {
        if (myReaction) {
          newSummary[myReaction] = Math.max(0, (newSummary[myReaction] ?? 0) - 1);
        }
        newSummary[reaction] = (newSummary[reaction] ?? 0) + 1;
        setMyReaction(reaction);
      }
      setReactionSummary(newSummary);
    } catch (err) {
      console.log("Error reaction:", err);
    }
  };

  const handleDeletePost = () => {
    Alert.alert("Xoá bài đăng", "Bạn có chắc chắn muốn xoá bài viết này?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDeletePost(token, post.id);
            onDelete(post.id);
          } catch (err) {
            Alert.alert("Lỗi", "Không thể xoá bài viết.");
          }
        },
      },
    ]);
  };

  const totalReacts = totalReactions(reactionSummary);
  const sortedReactions = REACTION_CONFIG.filter(
    (r) => (reactionSummary[r.key] ?? 0) > 0
  ).sort((a, b) => (reactionSummary[b.key] ?? 0) - (reactionSummary[a.key] ?? 0));

  const activeReactionInfo = myReaction
    ? REACTION_CONFIG.find((r) => r.key === myReaction)
    : null;

  return (
    <View className="bg-white rounded-2xl border border-slate-100 mb-4 p-4 relative shadow-sm">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-3">
          <AuthorAvatar userId={post.user_id} usersMap={usersMap} />
          <View>
            <Text className="font-semibold text-slate-800 text-[15px]">
              {getAuthorName(post.user_id, usersMap)}
            </Text>
            <Text className="text-[11px] text-slate-400 mt-0.5">
              {timeAgo(post.created_at)}
            </Text>
          </View>
        </View>

        {isOwner && (
          <TouchableOpacity onPress={handleDeletePost} className="p-1">
            <MaterialIcons name="delete-outline" size={20} color="#767A7F" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {post.content ? (
        <Text className="text-slate-800 text-[15px] mb-3 leading-relaxed">
          {post.content}
        </Text>
      ) : null}

      {/* Images */}
      {post.images && post.images.length > 0 && token ? (
        <PostImages images={post.images} postId={post.id} token={token} />
      ) : null}

      {/* Reaction & Comments stats */}
      <View className="flex-row justify-between items-center py-2 border-b border-slate-100">
        <View className="flex-row items-center gap-1.5">
          {totalReacts > 0 ? (
            <>
              <View className="flex-row gap-0.5">
                {sortedReactions.slice(0, 3).map((r) => (
                  <Text key={r.key} style={{ fontSize: 13 }}>
                    {r.emoji}
                  </Text>
                ))}
              </View>
              <Text className="text-xs text-slate-500 font-medium">
                {totalReacts}
              </Text>
            </>
          ) : (
            <Text className="text-xs text-slate-400">Chưa có tương tác</Text>
          )}
        </View>

        {commentCount > 0 ? (
          <Text className="text-xs text-slate-500 font-medium">
            {commentCount} bình luận
          </Text>
        ) : null}
      </View>

      {/* Buttons */}
      <View className="flex-row py-1 justify-between relative mt-1">
        {/* Like/Reaction Button */}
        <TouchableOpacity
          onPress={() => handleToggleReaction(myReaction ?? "like")}
          onLongPress={() => setShowReactionPicker(true)}
          className="flex-row items-center justify-center flex-1 py-1.5 gap-1.5 rounded-lg active:bg-slate-50"
        >
          {activeReactionInfo ? (
            <>
              <Text style={{ fontSize: 16 }}>{activeReactionInfo.emoji}</Text>
              <Text
                style={{ color: activeReactionInfo.color }}
                className="text-xs font-semibold"
              >
                {activeReactionInfo.label}
              </Text>
            </>
          ) : (
            <>
              <MaterialIcons name="thumb-up-off-alt" size={18} color="#767A7F" />
              <Text className="text-xs font-medium text-slate-500">Thích</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Comment Toggle Button */}
        <TouchableOpacity
          onPress={toggleComments}
          className="flex-row items-center justify-center flex-1 py-1.5 gap-1.5 rounded-lg active:bg-slate-50"
        >
          <MaterialIcons name="chat-bubble-outline" size={18} color="#767A7F" />
          <Text className="text-xs font-medium text-slate-500">Bình luận</Text>
        </TouchableOpacity>

        {/* Floating reaction picker */}
        {showReactionPicker && (
          <View
            style={{
              position: "absolute",
              bottom: 45,
              left: 10,
              backgroundColor: "white",
              borderRadius: 30,
              flexDirection: "row",
              paddingHorizontal: 12,
              paddingVertical: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 5,
              elevation: 5,
              borderWidth: 1,
              borderColor: "#E2E8F0",
              zIndex: 100,
              gap: 10,
            }}
          >
            {REACTION_CONFIG.map((r) => (
              <TouchableOpacity
                key={r.key}
                onPress={() => handleToggleReaction(r.key)}
                className="active:scale-125"
              >
                <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setShowReactionPicker(false)}
              className="ml-1 justify-center"
            >
              <MaterialIcons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Inline Comments Section */}
      {showComments && (
        <View className="mt-3 pt-3 border-t border-slate-50">
          {loadingComments ? (
            <ActivityIndicator size="small" color="#0068FF" className="py-2" />
          ) : (
            comments.map((comment) => (
              <View key={comment.id} className="flex-row items-start gap-2.5 mb-3">
                <AuthorAvatar
                  userId={comment.user_id}
                  usersMap={usersMap}
                  size={30}
                />
                <View className="flex-1">
                  <View className="bg-slate-50 rounded-2xl px-3 py-2 self-start max-w-full">
                    <Text className="text-xs font-semibold text-slate-700">
                      {getAuthorName(comment.user_id, usersMap)}
                    </Text>
                    <Text className="text-slate-800 text-[13px] mt-0.5 leading-relaxed">
                      {comment.content}
                    </Text>
                  </View>
                  <Text className="text-[10px] text-slate-400 mt-1 ml-1">
                    {timeAgo(comment.created_at)}
                  </Text>
                </View>

                {comment.user_id === currentUserId && (
                  <TouchableOpacity
                    onPress={() => handleDeleteComment(comment.id)}
                    className="p-1 self-center"
                  >
                    <MaterialIcons
                      name="delete-outline"
                      size={16}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          {/* New Comment Input */}
          <View className="flex-row items-center gap-2 mt-2">
            <AuthorAvatar userId={currentUserId} usersMap={usersMap} size={28} />
            <View className="flex-1 flex-row items-center bg-slate-50 rounded-full px-3.5 py-1.5 border border-slate-100">
              <TextInput
                value={newCommentText}
                onChangeText={setNewCommentText}
                placeholder="Viết bình luận..."
                placeholderTextColor="#94A3B8"
                className="flex-1 text-[13px] text-slate-800 p-0"
                style={{ maxHeight: 60 }}
                multiline
              />
              <TouchableOpacity
                onPress={handleAddComment}
                disabled={!newCommentText.trim() || submittingComment}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#0068FF" />
                ) : (
                  <MaterialIcons
                    name="send"
                    size={18}
                    color={newCommentText.trim() ? "#0068FF" : "#CBD5E1"}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main Feed Screen ────────────────────────────────────────────────────────

export default function PostsScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [usersMap, setUsersMap] = useState<
    Record<string, { fullName: string; avatarUrl: string | null }>
  >({});
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Composer Modal State
  const [composerVisible, setComposerVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [pickedImages, setPickedImages] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  const currentUserId = authUser?.id ?? "";

  // Get token and load initial data
  useEffect(() => {
    getAuthToken().then((t) => {
      if (t) {
        setToken(t);
        bootstrap(t);
      }
    });
  }, [currentUserId]);

  const fetchUsersProfile = async (
    tokenString: string,
    feedPosts: Post[]
  ) => {
    const map: Record<string, { fullName: string; avatarUrl: string | null }> =
      {};

    // Add current user
    if (authUser) {
      map[authUser.id] = {
        fullName: authUser.fullName,
        avatarUrl: authUser.avatarUrl,
      };
    }

    // Add friends
    try {
      const friendsRes = await listFriends();
      if (friendsRes && friendsRes.data) {
        friendsRes.data.forEach((friend) => {
          map[friend.id] = {
            fullName: friend.fullName,
            avatarUrl: friend.avatarUrl,
          };
        });
      }
    } catch (err) {
      console.log("Error loading friends in feed profiles:", err);
    }

    // Add any missing authors from the post list itself (if any)
    feedPosts.forEach((post) => {
      if (!map[post.user_id]) {
        map[post.user_id] = {
          fullName: `User_${post.user_id.slice(0, 6)}`,
          avatarUrl: null,
        };
      }
    });

    setUsersMap(map);
  };

  const bootstrap = async (tokenString: string, showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const feed = await getFeed(tokenString, 50);
      setPosts(feed);
      await fetchUsersProfile(tokenString, feed);
    } catch (err) {
      console.log("Error bootstrapping posts:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    bootstrap(token, false);
  };

  const handleImagePick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Quyền truy cập", "Vui lòng cấp quyền truy cập thư viện ảnh.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });

    if (!result.canceled && result.assets) {
      const uris = result.assets.map((a) => a.uri);
      setPickedImages((prev) => [...prev, ...uris].slice(0, 10));
    }
  };

  const handlePublishPost = async () => {
    if (!newPostContent.trim() && pickedImages.length === 0) return;
    setPublishing(true);
    try {
      await createPost(token, newPostContent, pickedImages, "friends");
      setNewPostContent("");
      setPickedImages([]);
      setComposerVisible(false);
      handleRefresh();
    } catch (err) {
      Alert.alert("Lỗi", "Không thể đăng bài viết. Vui lòng thử lại.");
    } finally {
      setPublishing(false);
    }
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-zalo-blue px-4 py-3 flex-row items-center justify-between border-b border-zalo-blue">
        <Text className="text-xl font-bold text-white">Bảng tin</Text>
        <TouchableOpacity
          onPress={() => setComposerVisible(true)}
          className="bg-white/10 w-9 h-9 rounded-full items-center justify-center"
        >
          <MaterialIcons name="edit" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Main Composer Box Trigger */}
      <View className="bg-white px-4 py-3 border-b border-slate-100 flex-row items-center gap-3">
        <AuthorAvatar userId={currentUserId} usersMap={usersMap} size={36} />
        <TouchableOpacity
          onPress={() => setComposerVisible(true)}
          className="flex-1 bg-slate-50 border border-slate-100 rounded-full px-4 py-2.5 justify-center"
        >
          <Text className="text-slate-400 text-sm">Bạn đang nghĩ gì?</Text>
        </TouchableOpacity>
      </View>

      {/* Feed List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0068FF" />
          <Text className="text-xs text-slate-400 mt-2">Đang tải bảng tin...</Text>
        </View>
      ) : posts.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20 px-8">
              <View className="w-16 h-16 bg-slate-100 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="newspaper" size={28} color="#CBD5E1" />
              </View>
              <Text className="text-[15px] font-semibold text-slate-500 mb-1">
                Chưa có bài viết nào
              </Text>
              <Text className="text-xs text-slate-400 text-center">
                Hãy đăng bài viết đầu tiên hoặc kết bạn để xem bài viết của nhau!
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              token={token}
              currentUserId={currentUserId}
              usersMap={usersMap}
              onDelete={handlePostDeleted}
            />
          )}
        />
      )}

      {/* Create Post Composer Modal */}
      <Modal
        visible={composerVisible}
        animationType="slide"
        onRequestClose={() => setComposerVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
          >
            {/* Modal Header */}
            <View className="px-4 py-3 flex-row items-center justify-between border-b border-slate-100">
              <TouchableOpacity
                onPress={() => {
                  if (newPostContent.trim() || pickedImages.length > 0) {
                    Alert.alert(
                      "Huỷ bài viết",
                      "Bỏ bài viết đang soạn thảo?",
                      [
                        { text: "Tiếp tục soạn", style: "cancel" },
                        {
                          text: "Bỏ",
                          style: "destructive",
                          onPress: () => setComposerVisible(false),
                        },
                      ]
                    );
                  } else {
                    setComposerVisible(false);
                  }
                }}
                className="py-1"
              >
                <Text className="text-slate-500 text-sm font-semibold">Huỷ</Text>
              </TouchableOpacity>

              <Text className="text-base font-bold text-slate-800">Tạo bài viết</Text>

              <TouchableOpacity
                onPress={handlePublishPost}
                disabled={(!newPostContent.trim() && pickedImages.length === 0) || publishing}
                className={`bg-blue-600 px-4 py-1.5 rounded-full ${
                  (!newPostContent.trim() && pickedImages.length === 0) || publishing
                    ? "opacity-40"
                    : ""
                }`}
              >
                {publishing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white text-xs font-bold">Đăng</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4">
              {/* Author Info */}
              <View className="flex-row items-center gap-3 mb-4">
                <AuthorAvatar
                  userId={currentUserId}
                  usersMap={usersMap}
                  size={42}
                />
                <View>
                  <Text className="font-bold text-slate-800 text-[15px]">
                    {getAuthorName(currentUserId, usersMap)}
                  </Text>
                  <View className="flex-row items-center bg-slate-100 rounded-full px-2 py-0.5 mt-1 border border-slate-200 self-start">
                    <MaterialIcons name="people" size={12} color="#64748B" />
                    <Text className="text-[10px] text-slate-500 font-medium ml-1">
                      Bạn bè
                    </Text>
                  </View>
                </View>
              </View>

              {/* TextInput */}
              <TextInput
                value={newPostContent}
                onChangeText={setNewPostContent}
                placeholder="Bạn đang nghĩ gì?"
                placeholderTextColor="#94A3B8"
                className="text-base text-slate-800 min-h-[120px] p-0"
                style={{ textAlignVertical: "top" }}
                multiline
                autoFocus
              />

              {/* Image Previews */}
              {pickedImages.length > 0 ? (
                <View className="mt-4">
                  <Text className="text-xs font-bold text-slate-500 mb-2 uppercase">
                    Ảnh đã chọn ({pickedImages.length}/10)
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {pickedImages.map((uri, index) => (
                      <View key={index} className="relative mr-2 mb-2">
                        <Image
                          source={{ uri }}
                          style={{ width: 100, height: 100, borderRadius: 12 }}
                          className="bg-slate-100"
                        />
                        <TouchableOpacity
                          onPress={() =>
                            setPickedImages((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                          className="absolute -top-1 -right-1 bg-black/60 w-6 h-6 rounded-full items-center justify-center border border-white"
                        >
                          <MaterialIcons name="close" size={14} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </ScrollView>

            {/* Bottom Actions Toolbar */}
            <View className="border-t border-slate-100 p-3 flex-row items-center justify-between bg-slate-50">
              <TouchableOpacity
                onPress={handleImagePick}
                className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200"
              >
                <MaterialIcons name="photo-library" size={20} color="#10B981" />
                <Text className="text-slate-600 text-xs font-semibold">Thêm ảnh</Text>
              </TouchableOpacity>

              <Text className="text-[10px] text-slate-400 italic">
                Chỉ chia sẻ với bạn bè
              </Text>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
