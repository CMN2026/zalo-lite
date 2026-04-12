/**
 * Resilient HTTP Client for inter-service communication
 * Features:
 * - Automatic retries with exponential backoff
 * - Request timeouts
 * - Service-to-service authentication
 * - Detailed logging
 */

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  backoffMultiplier?: number;
  serviceToken?: string;
}

interface HttpResponse<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

class ResilientHttpClient {
  private defaultTimeout = 10000; // 10s
  private defaultRetries = 3;
  private defaultBackoffMultiplier = 2;

  async request<T>(
    url: string,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const {
      method = "GET",
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      backoffMultiplier = this.defaultBackoffMultiplier,
      serviceToken,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Add service token if provided
        const finalHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          ...headers,
        };

        if (serviceToken) {
          finalHeaders["X-Service-Token"] = serviceToken;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const fetchOptions: RequestInit = {
          method,
          headers: finalHeaders,
          signal: controller.signal,
        };

        if (body) {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = (await response.json()) as T;
          return { ok: true, status: response.status, data };
        }

        // Non-2xx responses
        if (response.status >= 500 && attempt < retries - 1) {
          // Retry on 5xx errors
          const delay = Math.pow(backoffMultiplier, attempt) * 100;
          console.warn(
            `[HttpClient] ${method} ${url} returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        // Non-retryable error
        const errorText = await response.text();
        return {
          ok: false,
          status: response.status,
          error: errorText || `HTTP ${response.status}`,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries - 1) {
          // Check if error is retryable
          if (
            lastError.message.includes("ECONNREFUSED") ||
            lastError.message.includes("ETIMEDOUT") ||
            lastError.message.includes("TimeoutError")
          ) {
            const delay = Math.pow(backoffMultiplier, attempt) * 100;
            console.warn(
              `[HttpClient] ${method} ${url} failed with ${lastError.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`,
            );
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
        }

        // Non-retryable error
        return {
          ok: false,
          status: 0,
          error: lastError.message,
        };
      }
    }

    return {
      ok: false,
      status: 0,
      error: lastError?.message || "Max retries exceeded",
    };
  }

  get<T>(
    url: string,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: "GET" });
  }

  post<T>(
    url: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: "POST", body });
  }

  put<T>(
    url: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: "PUT", body });
  }

  delete<T>(
    url: string,
    options?: Omit<RequestOptions, "method" | "body">,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: "DELETE" });
  }
}

export const httpClient = new ResilientHttpClient();
