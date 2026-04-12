const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3004/api";

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

type ApiErrorBody = {
  message?: string;
  errors?: Array<{ field: string; message: string }>;
};

type RequestOptions = {
  method?: "GET" | "PATCH" | "POST";
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
    {
      method: "PATCH",
      body: { avatarUrl },
    },
  );
}

export async function discoverUsers(phone: string) {
  return request<ApiResponse<ProfileUser[]>>(
    `/users/discover?phone=${encodeURIComponent(phone)}`,
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

export async function respondFriendRequest(
  requestId: string,
  action: "accept" | "reject",
) {
  return request<ApiResponse<FriendRequest>>(
    `/users/friend-requests/${requestId}/respond`,
    {
      method: "POST",
      body: { action },
    },
  );
}

export async function listFriends() {
  return request<ApiResponse<ProfileUser[]>>("/users/friends");
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
