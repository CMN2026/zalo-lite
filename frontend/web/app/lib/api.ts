/**
 * Centralized API helpers for the Zalo-Lite frontend.
 * All services call this instead of inline process.env references.
 */

import { WEB_GATEWAY_BASE_URL } from "./runtime-base-url";

export const API_BASE_URL = WEB_GATEWAY_BASE_URL;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Override the Authorization header (defaults to localStorage token) */
  token?: string;
};

type ApiErrorBody = {
  message?: string;
  errors?: Array<{ field: string; message: string }>;
};

function getToken(): string | null {
  if (globalThis.window === undefined) return null;
  return localStorage.getItem("token");
}

/**
 * Handles the raw Response from fetch to properly parse JSON/text and throw appropriate errors.
 */
async function handleApiResponse<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  
  let payload: unknown;
  if (contentType.includes("application/json")) {
    payload = await res.json();
  } else {
    const text = await res.text();
    payload = { message: text || `http_${res.status}` };
  }

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth-error"));
      }
    }
    const body = payload as ApiErrorBody;
    // UX improvement: Show specific error instead of generic ones like request_failed
    const errorMessage = body.message ?? "Lỗi kết nối hoặc thực thi từ máy chủ.";
    const err = new Error(errorMessage) as Error & ApiErrorBody;
    err.errors = body.errors;
    throw err;
  }

  return payload as T;
}

/**
 * Generic authenticated API request helper.
 * Throws an `Error` whose `.message` is the server `message` field on failure.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = options.token ?? getToken();
  if (!token) {
    const err = new Error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.") as Error & ApiErrorBody;
    throw err;
  }

  const url = `${API_BASE_URL}${path}`;
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  if (options.body !== undefined) {
    (init.headers as Record<string, string>)["Content-Type"] =
      "application/json";
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, init);
  return handleApiResponse<T>(res);
}

/**
 * Unauthenticated POST (login / register).
 */
export async function publicPost<T = unknown>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return handleApiResponse<T>(res);
}

