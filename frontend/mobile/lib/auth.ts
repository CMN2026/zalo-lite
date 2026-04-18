import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:3004";

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

export async function register(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string | null;
}) {
  return post<AuthResponse<{ token: string; user: AuthUser }>>("/api/auth/register", {
    body: input,
  });
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
  } catch(e) {
    throw new Error(raw.slice(0, 120));
  }
  
  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload;
}
