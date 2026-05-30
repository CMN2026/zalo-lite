import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://32.236.47.127:3004";

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

export async function login(identifier: string, password: string) {
  return post<AuthResponse<{ token: string; user: AuthUser }>>("/api/auth/login", {
    body: { identifier, password },
  });
}

export async function loginWithGoogle(input: {
  idToken: string;
  fullName?: string;
  avatarUrl?: string | null;
}) {
  return post<AuthResponse<{ token: string; user: AuthUser }>>("/api/auth/google", {
    body: input,
  });
}

export async function register(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string | null;
}) {
  return post<
    AuthResponse<{
      verificationSessionId: string;
      email: string;
      expiresAt: string;
      resendAfterSeconds: number;
      maxAttempts: number;
    }>
  >("/api/auth/register", {
    body: input,
  });
}

export async function verifyRegisterCode(input: {
  verificationSessionId: string;
  code: string;
}) {
  return post<AuthResponse<{ token: string; user: AuthUser }>>(
    "/api/auth/register/verify",
    { body: input },
  );
}

export async function resendRegisterCode(verificationSessionId: string) {
  return post<
    AuthResponse<{
      verificationSessionId: string;
      email: string;
      expiresAt: string;
      resendAfterSeconds: number;
    }>
  >("/api/auth/register/resend", {
    body: { verificationSessionId },
  });
}

export async function requestPasswordReset(email: string) {
  return post<
    AuthResponse<{
      email: string;
      expiresInMinutes: number;
    }>
  >("/api/auth/forgot-password", {
    body: { email },
  });
}

export async function resetPassword(input: {
  token: string;
  newPassword: string;
}) {
  return post<AuthResponse<{ success: boolean }>>("/api/auth/reset-password", {
    body: input,
  });
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  const token = await getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    },
    body: JSON.stringify(input),
  });

  const raw = await response.text();
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error("request_failed");
  }

  if (!response.ok) {
    throw new Error(payload?.message || "request_failed");
  }

  return payload as AuthResponse<{ success: boolean }>;
}

export const AUTH_TOKEN_KEY = "token";
export const AUTH_USER_KEY = "user";

export async function saveAuthSession(token: string, user: AuthUser) {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export async function getAuthToken() {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function getSavedAuthUser(): Promise<AuthUser | null> {
  const rawUser = await AsyncStorage.getItem(AUTH_USER_KEY);
  if (!rawUser) {
    return null;
  }
  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    return null;
  }
}

export async function clearAuthSession() {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
}

async function post<T>(path: string, options: { body: Record<string, unknown> }): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.body),
  });

  const raw = await response.text();
  let payload: any = null;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    throw new Error(raw.slice(0, 120));
  }

  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload;
}

