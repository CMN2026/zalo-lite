import { API_BASE_URL } from "./api";
import { getAuthToken } from "./auth";

const CHAT_SERVICE_BASE_URL =
  process.env.EXPO_PUBLIC_CHAT_SERVICE_URL ?? "http://32.236.47.127:3002";

export type CallSessionParticipant = {
  user_id: string;
  state: "initiated" | "invited" | "connected" | "declined" | "left" | "missed";
  joined_at?: string;
  left_at?: string;
};

export type CallSession = {
  id: string;
  conversation_id: string;
  call_type: "direct" | "group";
  initiator_id: string;
  participants: CallSessionParticipant[];
  participant_user_ids: string[];
  status: "active" | "ended";
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  end_reason?: string;
};

export type CallHistoryItem = {
  user_id: string;
  created_at_call_id: string;
  call_id: string;
  conversation_id: string;
  call_type: "direct" | "group";
  initiator_id: string;
  status: "answered" | "declined" | "missed";
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  end_reason?: string;
  participant_user_ids: string[];
};

export type LiveKitTokenPayload = {
  token: string;
  ws_url: string;
  room_name: string;
  expires_at: string;
};

type ApiResponse<T> = {
  message?: string;
  data: T;
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
};

export async function startCall(input: {
  conversation_id: string;
  call_type: "direct" | "group";
  call_id?: string;
}) {
  return request<ApiResponse<CallSession>>("/calls/start", {
    method: "POST",
    body: input,
  });
}

export async function endCall(input: {
  call_id: string;
  conversation_id: string;
  reason?: string;
}) {
  return request<ApiResponse<CallSession>>(`/calls/${encodeURIComponent(input.call_id)}/end`, {
    method: "POST",
    body: {
      conversation_id: input.conversation_id,
      reason: input.reason,
    },
  });
}

export async function leaveCall(input: {
  call_id: string;
  conversation_id: string;
}) {
  return request<ApiResponse<{ action: "participant_left" | "ended"; session: CallSession }>>(
    `/calls/${encodeURIComponent(input.call_id)}/leave`,
    {
      method: "POST",
      body: {
        conversation_id: input.conversation_id,
      },
    },
  );
}

export async function getCallHistory(limit = 50) {
  return request<ApiResponse<CallHistoryItem[]>>(
    `/calls/history?limit=${encodeURIComponent(String(limit))}`,
  );
}

export async function getActiveCalls() {
  return request<ApiResponse<CallSession[]>>("/calls/active");
}

export async function getActiveCallForConversation(conversation_id: string) {
  return request<ApiResponse<CallSession | null>>(
    `/calls/active-for-conversation?conversation_id=${encodeURIComponent(conversation_id)}`,
  );
}

export async function getLiveKitToken(input: {
  call_id: string;
  conversation_id: string;
}) {
  return request<ApiResponse<LiveKitTokenPayload>>(
    `/calls/${encodeURIComponent(input.call_id)}/livekit-token`,
    {
      method: "POST",
      body: {
        conversation_id: input.conversation_id,
      },
    },
  );
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

  const requestInit: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  };

  const candidates = [
    `${API_BASE_URL}/api${requestPath}`,
    `${CHAT_SERVICE_BASE_URL}${requestPath}`,
    `${CHAT_SERVICE_BASE_URL}/api${requestPath}`,
  ];

  let lastError: unknown = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const endpoint = candidates[i];
    try {
      const response = await fetch(endpoint, requestInit);

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
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isNetworkError =
        message.includes("Network request failed") ||
        message.toLowerCase().includes("fetch failed");

      // Retry next candidate only for transport-level failures.
      if (!isNetworkError || i === candidates.length - 1) {
        break;
      }
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
}

