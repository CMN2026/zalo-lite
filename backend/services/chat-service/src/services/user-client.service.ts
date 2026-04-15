/**
 * User Service Client (Simple HTTP calls)
 * Use resilience patterns when adding more services
 */

import jwt from "jsonwebtoken";
import { HttpError } from "../utils/http-error.js";
import { env } from "../config/env.js";

type UserBasic = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone?: string;
};

type FriendsResponse = {
  data?: UserBasic[];
};

type FriendshipStatusResponse = {
  data?: {
    status?: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED" | null;
    isBlocked?: boolean;
    blockedByUserId?: string | null;
  };
};

export class UserClientService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildInternalUserToken(userId: string): string {
    return jwt.sign(
      {
        userId,
        role: "USER",
        plan: "FREE",
      },
      env.JWT_SECRET,
      {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        subject: userId,
        expiresIn: "2m",
      },
    );
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
        throw new HttpError(502, `user_service_unavailable_${response.status}`);
      }

      const { data } = (await response.json()) as { data: UserBasic };
      return data;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, "user_service_unavailable");
    }
  }

  async listFriends(userId: string): Promise<UserBasic[]> {
    try {
      const token = this.buildInternalUserToken(userId);
      const response = await fetch(`${this.baseUrl}/users/friends`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new HttpError(401, "user_service_unauthorized");
        }
        throw new HttpError(502, `user_service_unavailable_${response.status}`);
      }

      const payload = (await response.json()) as FriendsResponse;
      return Array.isArray(payload.data) ? payload.data : [];
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(502, "user_service_unavailable");
    }
  }

  async isFriend(userId: string, otherUserId: string): Promise<boolean> {
    const friends = await this.listFriends(userId);
    return friends.some((friend) => friend.id === otherUserId);
  }

  async getFriendshipStatus(userId: string, otherUserId: string) {
    try {
      const token = this.buildInternalUserToken(userId);
      const response = await fetch(
        `${this.baseUrl}/users/friendships/${otherUserId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          return {
            status: null,
            isBlocked: false,
            blockedByUserId: null,
          };
        }

        throw new HttpError(502, `user_service_unavailable_${response.status}`);
      }

      const payload = (await response.json()) as FriendshipStatusResponse;
      return {
        status: payload.data?.status ?? null,
        isBlocked: Boolean(payload.data?.isBlocked),
        blockedByUserId: payload.data?.blockedByUserId ?? null,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
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
