const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3004";

export type ConversationMember = {
  conversationId: string;
  userId: string;
  role: string;
  joinedAt: string;
  profile?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type Conversation = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  createdBy: string;
  lastMessageAt: string | null;
  createdAt: string;
  members?: ConversationMember[];
};

type ApiResponse<T> = {
  message?: string;
  data: T;
};

type ApiErrorBody = {
  message?: string;
  errors?: Array<{ field: string; message: string }>;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
};

export async function createConversation(input: {
  type: "direct" | "group";
  name?: string;
  memberIds: string[];
}) {
  return request<ApiResponse<Conversation>>("/api/conversations", {
    method: "POST",
    body: input,
  });
}

export async function listConversations() {
  return request<ApiResponse<Conversation[]>>("/api/conversations");
}

export async function getConversation(id: string) {
  return request<ApiResponse<Conversation>>(`/api/conversations/${id}`);
}

export async function updateConversation(id: string, input: { name: string }) {
  return request<ApiResponse<Conversation>>(`/api/conversations/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteConversation(id: string) {
  return request<ApiResponse<null>>(`/api/conversations/${id}`, {
    method: "DELETE",
  });
}

export async function leaveConversation(id: string) {
  return request<ApiResponse<null>>(`/api/conversations/${id}/leave`, {
    method: "POST",
  });
}

export async function addMembersToConversation(
  id: string,
  memberIds: string[],
) {
  return request<ApiResponse<{ addedCount: number }>>( // changed added_count to addedCount as serializer will also affect returning object keys
    `/api/conversations/${id}/members`,
    {
      method: "POST",
      body: { memberIds: memberIds },
    },
  );
}

export async function removeMemberFromConversation(id: string, userId: string) {
  return request<ApiResponse<null>>(
    `/api/conversations/${id}/members/${userId}`,
    {
      method: "DELETE",
    },
  );
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = localStorage.getItem("token");
  if (!token) {
    throw buildError({ message: "missing_local_session" });
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const rawPayload = await response.text();
  const payload =
    contentType.includes("application/json") && rawPayload
      ? (JSON.parse(rawPayload) as unknown)
      : { message: rawPayload || `http_${response.status}` };

  if (!response.ok) {
    throw buildError(payload);
  }

  return payload as T;
}

function buildError(payload: unknown) {
  const error = new Error("request_failed") as Error & ApiErrorBody;
  if (payload && typeof payload === "object") {
    const body = payload as ApiErrorBody;
    error.message = body.message ?? "request_failed";
    error.errors = body.errors;
  }
  return error;
}
