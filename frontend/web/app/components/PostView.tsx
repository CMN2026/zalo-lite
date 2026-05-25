"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/auth";
import { getAuthToken } from "../lib/auth";
import { WEB_GATEWAY_BASE_URL } from "../lib/runtime-base-url";
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
  type Comment,
  type ReactionType,
  type ReactionSummary,
} from "../lib/posts";
import {
  MessageCircle,
  Send,
  Image as ImageIcon,
  X,
  Trash2,
  ThumbsUp,
  Loader2,
  RefreshCw,
} from "lucide-react";

// ─── Reaction emoji map ──────────────────────────────────────────────────────

const REACTION_CONFIG: {
  key: ReactionType;
  emoji: string;
  label: string;
  color: string;
}[] = [
  { key: "like", emoji: "👍", label: "Thích", color: "#2563eb" },
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
  return (summary.like ?? 0) + (summary.love ?? 0) + (summary.haha ?? 0) + (summary.sad ?? 0) + (summary.angry ?? 0);
}

// ─── Create Post Card ────────────────────────────────────────────────────────

function CreatePostCard({ onPostCreated }: { onPostCreated: () => void }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = useMemo(() => {
    const source = user?.fullName || user?.email || "U";
    return source
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newImages = [...selectedImages, ...files].slice(0, 10);
    setSelectedImages(newImages);

    // Generate previews
    const newPreviews = newImages.map((f) => URL.createObjectURL(f));
    // Revoke old URLs
    previews.forEach((p) => URL.revokeObjectURL(p));
    setPreviews(newPreviews);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setPreviews(newPreviews);
  };

  const handleSubmit = async () => {
    if (!content.trim() && selectedImages.length === 0) return;
    const token = getAuthToken();
    if (!token) return;

    setIsSubmitting(true);
    try {
      await createPost(token, content, selectedImages, "friends");
      setContent("");
      setSelectedImages([]);
      previews.forEach((p) => URL.revokeObjectURL(p));
      setPreviews([]);
      onPostCreated();
    } catch (err) {
      console.error("Failed to create post:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Bạn đang nghĩ gì?"
            className="w-full resize-none border-0 bg-slate-100/90 rounded-2xl px-5 py-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all min-h-[48px]"
            rows={2}
          />

          {/* Image Previews */}
          {previews.length > 0 && (
            <div className={`mt-3 grid gap-2 ${previews.length === 1 ? "grid-cols-1" : previews.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {previews.map((src, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden aspect-square bg-slate-100">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors"
              >
                <ImageIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Ảnh</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (!content.trim() && selectedImages.length === 0)}
              className="px-5 py-2.5 bg-blue-400 text-white text-sm font-semibold rounded-2xl hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Đăng bài
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Comment Section ─────────────────────────────────────────────────────────

function CommentSection({
  postId,
  onCommentCountChange,
}: {
  postId: string;
  onCommentCountChange: (delta: number) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const token = getAuthToken();
    if (!token) return;

    setIsLoading(true);
    getComments(token, postId)
      .then((data) => {
        setComments(data);
        setLoaded(true);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [postId, loaded]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    const token = getAuthToken();
    if (!token) return;

    setIsSubmitting(true);
    try {
      const comment = await apiAddComment(token, postId, newComment);
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      onCommentCountChange(1);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      await apiDeleteComment(token, postId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentCountChange(-1);
    } catch (err) {
      console.error(err);
    }
  };

  const initials = useMemo(() => {
    const source = user?.fullName || user?.email || "U";
    return source.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }, [user]);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      {isLoading && (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      )}

      {comments.map((comment) => (
        <div key={comment.id} className="flex items-start gap-2.5 mb-3 group">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
            {(comment.user_id ?? "U").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-slate-50 rounded-2xl px-3.5 py-2.5 inline-block max-w-full">
              <p className="text-xs font-semibold text-slate-600 mb-0.5">
                {comment.user_id?.slice(0, 8)}...
              </p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 ml-1">
              {timeAgo(comment.created_at)}
            </p>
          </div>
          {comment.user_id === user?.id && (
            <button
              onClick={() => handleDelete(comment.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      {/* New comment input */}
      <div className="flex items-center gap-2 mt-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 flex items-center bg-slate-50 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:bg-white transition-all">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Viết bình luận..."
            className="flex-1 bg-transparent border-0 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || isSubmitting}
            className="ml-2 text-blue-500 hover:text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reaction Bar ────────────────────────────────────────────────────────────

function ReactionBar({
  postId,
  reactionSummary,
  onReactionSummaryChange,
}: {
  postId: string;
  reactionSummary: ReactionSummary;
  onReactionSummaryChange: (summary: ReactionSummary) => void;
}) {
  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pickerTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleReaction = async (reaction: ReactionType) => {
    const token = getAuthToken();
    if (!token) return;

    setIsLoading(true);
    setShowPicker(false);

    try {
      // Toggle: if same reaction, remove it; otherwise set new one
      const sendReaction = myReaction === reaction ? null : reaction;
      const result = await apiToggleReaction(token, postId, sendReaction);

      if (result.action === "removed") {
        // Decrease the count for the previous reaction
        if (myReaction) {
          const newSummary = { ...reactionSummary };
          newSummary[myReaction] = Math.max(0, (newSummary[myReaction] ?? 0) - 1);
          onReactionSummaryChange(newSummary);
        }
        setMyReaction(null);
      } else if (result.action === "added") {
        const newSummary = { ...reactionSummary };
        newSummary[reaction] = (newSummary[reaction] ?? 0) + 1;
        onReactionSummaryChange(newSummary);
        setMyReaction(reaction);
      } else if (result.action === "changed") {
        const newSummary = { ...reactionSummary };
        if (myReaction) {
          newSummary[myReaction] = Math.max(0, (newSummary[myReaction] ?? 0) - 1);
        }
        newSummary[reaction] = (newSummary[reaction] ?? 0) + 1;
        onReactionSummaryChange(newSummary);
        setMyReaction(reaction);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseEnter = () => {
    if (pickerTimeout.current) clearTimeout(pickerTimeout.current);
    setShowPicker(true);
  };

  const handleMouseLeave = () => {
    pickerTimeout.current = setTimeout(() => setShowPicker(false), 300);
  };

  const total = totalReactions(reactionSummary);
  const topReactions = REACTION_CONFIG.filter(
    (r) => (reactionSummary[r.key] ?? 0) > 0,
  ).sort(
    (a, b) => (reactionSummary[b.key] ?? 0) - (reactionSummary[a.key] ?? 0),
  );

  return (
    <div className="flex items-center gap-2">
      {/* Reaction summary */}
      {total > 0 && (
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            {topReactions.slice(0, 3).map((r) => (
              <span key={r.key} className="text-base" title={r.label}>
                {r.emoji}
              </span>
            ))}
          </div>
          <span className="text-xs text-slate-500 ml-1">{total}</span>
        </div>
      )}

      {/* Like button with hover picker */}
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={() => handleReaction(myReaction ?? "like")}
          disabled={isLoading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            myReaction
              ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
              : "text-slate-500 hover:bg-slate-50 hover:text-blue-600"
          }`}
        >
          {myReaction ? (
            <span className="text-base">
              {REACTION_CONFIG.find((r) => r.key === myReaction)?.emoji ?? "👍"}
            </span>
          ) : (
            <ThumbsUp className="w-4 h-4" />
          )}
          <span>
            {myReaction
              ? REACTION_CONFIG.find((r) => r.key === myReaction)?.label ?? "Thích"
              : "Thích"}
          </span>
        </button>

        {/* Reaction Picker Popup */}
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-2 flex items-center gap-1 bg-white rounded-full shadow-lg border border-slate-200 px-2 py-1.5 z-50 animate-[fadeInUp_0.15s_ease-out]">
            {REACTION_CONFIG.map((r) => (
              <button
                key={r.key}
                onClick={() => handleReaction(r.key)}
                title={r.label}
                className={`text-2xl hover:scale-125 transition-transform duration-150 px-1 ${
                  myReaction === r.key ? "scale-110" : ""
                }`}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Post Card ───────────────────────────────────────────────────────────────

function PostCard({
  post,
  authorName,
  authorAvatarUrl,
  onOpenProfile,
  onDelete,
}: {
  post: Post;
  authorName?: string;
  authorAvatarUrl?: string | null;
  onOpenProfile: (userId: string) => void;
  onDelete: (postId: string) => void;
}) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [reactionSummary, setReactionSummary] = useState<ReactionSummary>(
    post.reaction_summary ?? { like: 0, love: 0, haha: 0, sad: 0, angry: 0 },
  );
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const token = getAuthToken();

  const isOwner = post.user_id === user?.id;

  const handleDelete = async () => {
    if (!token) return;
    if (!window.confirm("Bạn có chắc muốn xóa bài đăng này?")) return;

    try {
      await apiDeletePost(token, post.id);
      onDelete(post.id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenProfile(post.user_id)}
            className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-md overflow-hidden"
          >
            {authorAvatarUrl ? (
              <img src={authorAvatarUrl} alt={authorName ?? "Avatar"} className="w-full h-full object-cover" />
            ) : (
              post.user_id.slice(0, 2).toUpperCase()
            )}
          </button>
          <div>
            <button
              type="button"
              onClick={() => onOpenProfile(post.user_id)}
              className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
            >
              {authorName ?? `${post.user_id.slice(0, 8)}...`}
            </button>
            <p className="text-xs text-slate-400">{timeAgo(post.created_at)}</p>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={handleDelete}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Xóa bài đăng"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-5 pb-3">
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {post.content}
          </p>
        </div>
      )}

      {/* Images */}
      {post.images && post.images.length > 0 && token && (
        <div
          className={`grid gap-0.5 ${
            post.images.length === 1
              ? "grid-cols-1"
              : post.images.length === 2
                ? "grid-cols-2"
                : post.images.length === 3
                  ? "grid-cols-2"
                  : "grid-cols-2"
          }`}
        >
          {post.images.map((filename, i) => (
            <div
              key={i}
              className={`relative overflow-hidden bg-slate-100 ${
                post.images.length === 1
                  ? "max-h-[500px]"
                  : post.images.length === 3 && i === 0
                    ? "row-span-2"
                    : ""
              }`}
            >
              <img
                src={getPostImageUrl(post.id, filename, token)}
                alt={`Ảnh ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Reaction summary + action bar */}
      <div className="px-5 py-2">
        <div className="flex items-center justify-between py-2">
          <ReactionBar
            postId={post.id}
            reactionSummary={reactionSummary}
            onReactionSummaryChange={setReactionSummary}
          />
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Bình luận</span>
            {commentCount > 0 && (
              <span className="ml-0.5 text-sm text-slate-400">
                ({commentCount})
              </span>
            )}
          </button>
        </div>

        {/* Comment section */}
        {showComments && (
          <CommentSection
            postId={post.id}
            onCommentCountChange={(delta) =>
              setCommentCount((prev) => Math.max(0, prev + delta))
            }
          />
        )}
      </div>
    </div>
  );
}

// ─── Main PostView ───────────────────────────────────────────────────────────

export default function PostView() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [authorProfiles, setAuthorProfiles] = useState<
    Record<string, { fullName: string; avatarUrl: string | null }>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAuthorProfiles = useCallback(async (feedPosts: Post[], token: string) => {
    const authorIds = Array.from(new Set(feedPosts.map((post) => post.user_id))).filter(Boolean);

    const profileEntries = await Promise.all(
      authorIds.map(async (userId) => {
        try {
          const response = await fetch(`${WEB_GATEWAY_BASE_URL}/api/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) return null;
          const payload = (await response.json()) as {
            data?: { fullName?: string; email?: string; avatarUrl?: string | null };
          };
          const name = payload.data?.fullName?.trim() || payload.data?.email?.trim() || userId;
          return [userId, { fullName: name, avatarUrl: payload.data?.avatarUrl ?? null }] as const;
        } catch {
          return null;
        }
      }),
    );

    const nextEntries = profileEntries.filter((entry): entry is readonly [string, { fullName: string; avatarUrl: string | null }] => Boolean(entry));
    if (nextEntries.length === 0) return;

    setAuthorProfiles((prev) => {
      const merged = { ...prev };
      nextEntries.forEach(([userId, profile]) => {
        merged[userId] = profile;
      });
      return merged;
    });
  }, []);

  const loadFeed = useCallback(async (showLoadingSpinner = true) => {
    const token = getAuthToken();
    if (!token) return;

    if (showLoadingSpinner) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await getFeed(token, 50);
      setPosts(data);
      await loadAuthorProfiles(data, token);
    } catch (err) {
      console.error("Failed to load feed:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [loadAuthorProfiles]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handlePostCreated = () => {
    loadFeed(false);
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleOpenProfile = useCallback((userId: string) => {
    router.push(`/user/${encodeURIComponent(userId)}`);
  }, [router]);

  return (
    <div className="flex-1 bg-slate-100 overflow-hidden">
      <div className="h-full overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
          <div className="max-w-[760px] mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-800">Bảng tin</h1>
            <button
              onClick={() => loadFeed(false)}
              disabled={isRefreshing}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Làm mới"
            >
              <RefreshCw
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-[760px] mx-auto px-4 py-4">
          {/* Create Post */}
          <CreatePostCard onPostCreated={handlePostCreated} />

          {/* Feed */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-sm text-slate-400">Đang tải bảng tin...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-base font-medium text-slate-500 mb-1">
                Chưa có bài đăng nào
              </p>
              <p className="text-sm text-slate-400">
                Hãy đăng bài đầu tiên hoặc kết bạn để xem bài viết!
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                authorName={authorProfiles[post.user_id]?.fullName}
                authorAvatarUrl={authorProfiles[post.user_id]?.avatarUrl}
                onOpenProfile={handleOpenProfile}
                onDelete={handlePostDeleted}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
