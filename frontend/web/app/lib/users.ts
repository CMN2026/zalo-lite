const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3004";

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

export type FriendshipStatus = {
  userId: string;
  otherUserId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED" | null;
  isBlocked: boolean;
  blockedByUserId: string | null;
  friendshipId: string | null;
  targetUser?: ProfileUser;
};

type ApiResponse<T> = {
  message?: string;
  data: T;
};

type ApiErrorBody = {
  message?: string;
  errors?: Array<{ field: string; message: string }>;
};

type ApiRequestError = Error &
  ApiErrorBody & {
    status?: number;
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
  return request<
    ApiResponse<Pick<ProfileUser, "id" | "avatarUrl" | "updatedAt">>
  >("/users/me/avatar", {
    method: "PATCH",
    body: { avatarUrl },
  });
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
  return request<ApiResponse<FriendRequest[]>>(
    "/users/friend-requests/incoming",
  );
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

export async function getFriendshipStatus(otherUserId: string) {
  try {
    return await request<ApiResponse<FriendshipStatus>>(
      `/users/friendships/${otherUserId}`,
    );
  } catch (error) {
    const typed = error as ApiRequestError;
    if (typed.status !== 404) {
      throw error;
    }

    return request<ApiResponse<FriendshipStatus>>(
      `/users/friendship/${otherUserId}`,
    );
  }
}

export async function blockFriendship(otherUserId: string) {
  try {
    return await request<ApiResponse<FriendshipStatus>>(
      `/users/friendships/${otherUserId}/block`,
      {
        method: "POST",
      },
    );
  } catch (error) {
    const typed = error as ApiRequestError;
    if (typed.status !== 404) {
      throw error;
    }

    return request<ApiResponse<FriendshipStatus>>(
      `/users/friendship/${otherUserId}/block`,
      {
        method: "POST",
      },
    );
  }
}

export async function unblockFriendship(otherUserId: string) {
  try {
    return await request<ApiResponse<FriendshipStatus>>(
      `/users/friendships/${otherUserId}/unblock`,
      {
        method: "POST",
      },
    );
  } catch (error) {
    const typed = error as ApiRequestError;
    if (typed.status !== 404) {
      throw error;
    }

    return request<ApiResponse<FriendshipStatus>>(
      `/users/friendship/${otherUserId}/unblock`,
      {
        method: "POST",
      },
    );
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = localStorage.getItem("token");
  if (!token) {
    throw buildError({ message: "missing_local_session" });
  }

  const method = options.method ?? "GET";

  let requestPath = path;
  if (method === "GET") {
    const separator = path.includes("?") ? "&" : "?";
    requestPath = `${path}${separator}_ts=${Date.now()}`;
  }

  const response = await fetch(`${API_BASE_URL}/api${requestPath}`, {
    method,
    cache: method === "GET" ? "no-store" : "default",
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
    throw buildError(payload, response.status);
  }

  return payload as T;
}

function buildError(payload: unknown, status?: number): ApiRequestError {
  const error = new Error("request_failed") as ApiRequestError;
  error.status = status;
  if (payload && typeof payload === "object") {
    const body = payload as ApiErrorBody;
    error.message = body.message ?? "request_failed";
    error.errors = body.errors;
    return error;
  }

  if (typeof status === "number") {
    error.message = `http_${status}`;
  }

  return error;
}
