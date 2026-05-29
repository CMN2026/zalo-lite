import { env } from "../config/env.js";

export type UserProfile = {
  id: string;
  fullName: string;
  email?: string;
  avatarUrl?: string | null;
};

export class UserClientService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? env.USER_SERVICE_BASE_URL;
  }

  async getUserById(userId: string, token?: string): Promise<UserProfile> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/users/${userId}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user ${userId}: ${response.status}`);
    }

    const payload = (await response.json()) as { data?: UserProfile };
    const user = payload.data;
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    return {
      id: user.id,
      fullName: user.fullName ?? "Unknown",
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
    };
  }

  async getFriendIds(userId: string, token?: string): Promise<string[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Try chat-peers endpoint first (includes all conversation partners)
    try {
      const response = await fetch(`${this.baseUrl}/users/chat-peers`, {
        headers,
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          data?: Array<{ id: string }>;
        };
        if (Array.isArray(payload.data)) {
          return payload.data
            .filter((item) => item && typeof item.id === "string")
            .map((item) => item.id);
        }
      }
    } catch {
      // Fall through to friends endpoint
    }

    // Fallback to friends endpoint
    try {
      const response = await fetch(`${this.baseUrl}/users/friends`, {
        headers,
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          data?: Array<{ id: string }>;
        };
        if (Array.isArray(payload.data)) {
          return payload.data
            .filter((item) => item && typeof item.id === "string")
            .map((item) => item.id);
        }
      }
    } catch {
      // Return empty
    }

    return [];
  }

  async getMultipleUsers(
    userIds: string[],
    token?: string,
  ): Promise<Map<string, UserProfile>> {
    const map = new Map<string, UserProfile>();

    // Fetch users in parallel (with limit to avoid overwhelming user-service)
    const uniqueIds = [...new Set(userIds)];
    const batches: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += 10) {
      batches.push(uniqueIds.slice(i, i + 10));
    }

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((id) => this.getUserById(id, token)),
      );

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          map.set(batch[index], result.value);
        }
      });
    }

    return map;
  }
}

let defaultInstance: UserClientService | null = null;

export function initUserClientService(baseUrl?: string): void {
  defaultInstance = new UserClientService(baseUrl);
}

export function getUserClientService(): UserClientService {
  if (!defaultInstance) {
    defaultInstance = new UserClientService();
  }
  return defaultInstance;
}
