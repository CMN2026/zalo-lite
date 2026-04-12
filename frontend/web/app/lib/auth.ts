const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3004/api";

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

function isValidationErrorResponse(value: unknown): value is ValidationErrorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { message?: unknown; errors?: unknown };
  const hasMessage = typeof candidate.message === "string";
  const hasErrors = Array.isArray(candidate.errors);

  return hasMessage || hasErrors;
}

export async function login(identifier: string, password: string) {
  return post<AuthResponse<{ token: string; user: AuthUser }>>("/auth/login", {
    body: { identifier, password },
  });
}

export async function register(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string | null;
}) {
  return post<AuthResponse<{ token: string; user: AuthUser }>>("/auth/register", {
    body: input,
  });
}

async function post<T>(path: string, options: RequestOptions): Promise<T> {
  const url = API_BASE_URL.includes('/api') ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/api${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.body),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const error = new Error("request_failed") as Error & ValidationErrorResponse;
    if (isValidationErrorResponse(payload)) {
      error.message = payload.message ?? "request_failed";
      error.errors = payload.errors;
    }

    throw error;
  }

  return payload as T;
}

export function saveAuthSession(token: string, user: AuthUser) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function getAuthToken() {
  return localStorage.getItem("token");
}

export function getSavedAuthUser(): AuthUser | null {
  const rawUser = localStorage.getItem("user");
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
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
