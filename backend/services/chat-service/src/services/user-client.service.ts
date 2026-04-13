/**
 * User Service Client (Simple HTTP calls)
 * Use resilience patterns when adding more services
 */

import { HttpError } from "../utils/http-error.js";
import { env } from "../config/env.js";

type UserBasic = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone?: string;
};

export class UserClientService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserBasic> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${userId}`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new HttpError(404, "user_not_found");
        }
        throw new HttpError(502, "user_service_unavailable");
      }

      const { data } = (await response.json()) as { data: UserBasic };
      return data;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, "user_service_unavailable");
    }
  }

  /**
   * Search users by phone
   */
  async searchByPhone(phone: string): Promise<UserBasic[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/users/search?phone=${encodeURIComponent(phone)}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new HttpError(502, "user_service_unavailable");
      }

      const { data } = (await response.json()) as { data: UserBasic[] };
      return data ?? [];
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return [];
    }
  }

  /**
   * Get multiple users by IDs
   */
  async getUsersByIds(userIds: string[]): Promise<UserBasic[]> {
    try {
      const response = await fetch(`${this.baseUrl}/users/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userIds }),
      });

      if (!response.ok) {
        throw new HttpError(502, "user_service_unavailable");
      }

      const { data } = (await response.json()) as { data: UserBasic[] };
      return data ?? [];
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return [];
    }
  }
}

// Singleton instance
let userClientService: UserClientService | null = null;

export function initUserClientService(baseUrl: string): UserClientService {
  userClientService = new UserClientService(
    baseUrl || env.USER_SERVICE_BASE_URL,
  );
  return userClientService;
}

export function getUserClientService(): UserClientService {
  if (!userClientService) {
    throw new Error("UserClientService not initialized");
  }
  return userClientService;
}
