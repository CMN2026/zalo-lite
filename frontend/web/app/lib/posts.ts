import { WEB_GATEWAY_BASE_URL } from "./runtime-base-url";

const API_BASE = WEB_GATEWAY_BASE_URL;

export type ReactionType = "like" | "love" | "haha" | "sad" | "angry";

export type ReactionSummary = {
  like: number;
  love: number;
  haha: number;
  sad: number;
  angry: number;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  images: string[];
  visibility: "friends" | "public";
  reaction_summary: ReactionSummary;
  comment_count: number;
  created_at: string;
  updated_at: string;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type Reaction = {
  post_id: string;
  user_id: string;
  reaction: ReactionType;
  created_at: string;
};

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function createPost(
  token: string,
  content: string,
  images: File[],
  visibility: "friends" | "public" = "friends",
): Promise<Post> {
  const formData = new FormData();
  formData.append("content", content);
  formData.append("visibility", visibility);
  images.forEach((img) => formData.append("images", img));

  const res = await fetch(`${API_BASE}/api/posts`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.message ?? "create_post_failed");
  }

  const payload = (await res.json()) as { data: Post };
  return payload.data;
}

export async function getFeed(
  token: string,
  limit = 50,
): Promise<Post[]> {
  const res = await fetch(`${API_BASE}/api/posts/feed?limit=${limit}`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    throw new Error("fetch_feed_failed");
  }

  const payload = (await res.json()) as { data: Post[] };
  return payload.data ?? [];
}

export async function getMyPosts(
  token: string,
  limit = 50,
): Promise<Post[]> {
  const res = await fetch(`${API_BASE}/api/posts/me?limit=${limit}`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    throw new Error("fetch_my_posts_failed");
  }

  const payload = (await res.json()) as { data: Post[] };
  return payload.data ?? [];
}

export async function getPost(
  token: string,
  postId: string,
): Promise<Post> {
  const res = await fetch(`${API_BASE}/api/posts/${postId}`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    throw new Error("fetch_post_failed");
  }

  const payload = (await res.json()) as { data: Post };
  return payload.data;
}

export async function deletePost(
  token: string,
  postId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/posts/${postId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  if (!res.ok) {
    throw new Error("delete_post_failed");
  }
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function addComment(
  token: string,
  postId: string,
  content: string,
): Promise<Comment> {
  const res = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    throw new Error("add_comment_failed");
  }

  const payload = (await res.json()) as { data: Comment };
  return payload.data;
}

export async function getComments(
  token: string,
  postId: string,
  limit = 100,
): Promise<Comment[]> {
  const res = await fetch(
    `${API_BASE}/api/posts/${postId}/comments?limit=${limit}`,
    {
      headers: authHeaders(token),
    },
  );

  if (!res.ok) {
    throw new Error("fetch_comments_failed");
  }

  const payload = (await res.json()) as { data: Comment[] };
  return payload.data ?? [];
}

export async function deleteComment(
  token: string,
  postId: string,
  commentId: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/posts/${postId}/comments/${commentId}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
    },
  );

  if (!res.ok) {
    throw new Error("delete_comment_failed");
  }
}

// ─── Reactions ───────────────────────────────────────────────────────────────

export async function toggleReaction(
  token: string,
  postId: string,
  reaction: ReactionType | null,
): Promise<{ action: string; reaction: Reaction | null }> {
  const res = await fetch(`${API_BASE}/api/posts/${postId}/reactions`, {
    method: "PUT",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reaction }),
  });

  if (!res.ok) {
    throw new Error("toggle_reaction_failed");
  }

  const payload = (await res.json()) as {
    data: { action: string; reaction: Reaction | null };
  };
  return payload.data;
}

export async function getReactions(
  token: string,
  postId: string,
): Promise<Reaction[]> {
  const res = await fetch(`${API_BASE}/api/posts/${postId}/reactions`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    throw new Error("fetch_reactions_failed");
  }

  const payload = (await res.json()) as { data: Reaction[] };
  return payload.data ?? [];
}

// ─── Image URL helper ────────────────────────────────────────────────────────

export function getPostImageUrl(
  postId: string,
  filename: string,
  token: string,
): string {
  return `${API_BASE}/api/post-uploads/${postId}/${filename}?token=${encodeURIComponent(token)}`;
}
