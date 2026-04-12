const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3004";

export type ConversationMember = {
  conversation_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type Conversation = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  created_by: string;
  last_message_at: string | null;
  created_at: string;
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
  member_ids: string[];
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
  return request<ApiResponse<{ added_count: number }>>(
    `/api/conversations/${id}/members`,
    {
      method: "POST",
      body: { member_ids: memberIds },
    },
  );
}

export async function removeMemberFromConversation(
  id: string,
  userId: string,
) {
  return request<ApiResponse<null>>(
    `/api/conversations/${id}/members/${userId}`,
    {
      method: "DELETE",
    },
  );
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

  const payload = (await response.json()) as unknown;

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
