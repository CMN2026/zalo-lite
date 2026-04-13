const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3004";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: "USER" | "ADMIN";
  plan: "FREE" | "PREMIUM";
};

type AuthResponse<T> = {
  message: string;
  data: T;
};

type ValidationErrorResponse = {
  message?: string;
  errors?: Array<{ field: string; message: string }>;
};

type RequestOptions = {
  body: Record<string, unknown>;
};

function isValidationErrorResponse(
  value: unknown,
): value is ValidationErrorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { message?: unknown; errors?: unknown };
  const hasMessage = typeof candidate.message === "string";
  const hasErrors = Array.isArray(candidate.errors);

  return hasMessage || hasErrors;
}

export async function login(identifier: string, password: string) {
  return post<AuthResponse<{ token: string; user: AuthUser }>>(
    "/api/auth/login",
    {
      body: { identifier, password },
    },
  );
}

export async function register(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string | null;
}) {
  return post<AuthResponse<{ token: string; user: AuthUser }>>(
    "/api/auth/register",
    {
      body: input,
    },
  );
}

export const AUTH_TOKEN_KEY = "token";
export const AUTH_USER_KEY = "user";

export function saveAuthSession(token: string, user: AuthUser) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getSavedAuthUser(): AuthUser | null {
  const rawUser = localStorage.getItem(AUTH_USER_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

async function post<T>(path: string, options: RequestOptions): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.body),
  });

  const raw = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  let payload: unknown = null;
  if (raw) {
    if (contentType.includes("application/json")) {
      payload = JSON.parse(raw) as unknown;
    } else {
      payload = { message: raw.slice(0, 120) };
    }
  }

  if (!response.ok) {
    const error = new Error("request_failed") as Error &
      ValidationErrorResponse;
    if (isValidationErrorResponse(payload)) {
      error.message = payload.message ?? "request_failed";
      error.errors = payload.errors;
    } else if (!contentType.includes("application/json")) {
      error.message = "api_response_is_not_json_check_api_base_url";
    }

    throw error;
  }

  if (!contentType.includes("application/json")) {
    throw new Error("api_response_is_not_json_check_api_base_url");
  }

  return payload as T;
}
