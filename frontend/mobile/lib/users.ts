import { API_BASE_URL } from "./api";
import { getAuthToken } from "./auth";

export type ProfileUser = {
  id: string;
  email?: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  bio?: string | null;
  role?: "USER" | "ADMIN";
  plan: "FREE" | "PREMIUM";
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type FriendRequest = {
  id: string;
  requester?: ProfileUser;
  addressee?: ProfileUser;
  message?: string | null;
  status?: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED";
  createdAt?: string;
};

type ApiResponse<T> = {
  message?: string;
  data: T;
};

type RequestOptions = {
  method?: "GET" | "PATCH" | "POST" | "DELETE";
  body?: Record<string, unknown>;
};

export async function getMe() {
  return request<ApiResponse<ProfileUser>>("/users/me");
}

export async function updateMe(input: {
  fullName?: string;
  phone?: string;
  bio?: string;
}) {
  return request<ApiResponse<ProfileUser>>("/users/me", {
    method: "PATCH",
    body: input,
  });
}

export async function updateAvatar(avatarUrl: string) {
  return request<ApiResponse<Pick<ProfileUser, "id" | "avatarUrl" | "updatedAt">>>(
    "/users/me/avatar",
    { method: "PATCH", body: { avatarUrl } }
  );
}

export async function discoverUsers(phone: string) {
  return request<ApiResponse<ProfileUser[]>>(
    `/users/discover?phone=${encodeURIComponent(phone)}`
  );
}

export async function sendFriendRequest(phone: string, message?: string) {
  return request<ApiResponse<FriendRequest>>("/users/friend-requests", {
    method: "POST",
    body: { phone, message },
  });
}

export async function listIncomingFriendRequests() {
  return request<ApiResponse<FriendRequest[]>>("/users/friend-requests/incoming");
}

export async function respondFriendRequest(requestId: string, action: "accept" | "reject") {
  return request<ApiResponse<FriendRequest>>(
    `/users/friend-requests/${requestId}/respond`,
    { method: "POST", body: { action } }
  );
}

export async function listFriends() {
  return request<ApiResponse<ProfileUser[]>>("/users/friends");
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("missing_local_session");
  }

  const method = options.method ?? "GET";
  let requestPath = path;
  if (method === "GET") {
    const sep = path.includes("?") ? "&" : "?";
    requestPath = `${path}${sep}_ts=${Date.now()}`;
  }

  const response = await fetch(`${API_BASE_URL}/api${requestPath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload: unknown = null;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const body = payload as { message?: string } | null;
    throw new Error(body?.message ?? `http_${response.status}`);
  }

  return payload as T;
}
