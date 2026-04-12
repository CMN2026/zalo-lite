/**
 * User Service Client (Saga Pattern)
 * Communicates with user-service for JWT verification and user data
 * This implements the saga pattern - delegating to user-service instead of local verification
 */

import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

export interface VerifyTokenResponse {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
  plan: "FREE" | "PREMIUM";
}

export class UserServiceClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.USER_SERVICE_BASE_URL || "http://localhost:3001";
  }

  /**
   * Verify JWT token by calling user-service
   * Saga pattern: Delegate JWT verification to user-service
   */
  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new HttpError(
          response.status,
          response.status === 401
            ? "invalid_or_expired_token"
            : "verification_failed",
        );
      }

      const data = (await response.json()) as VerifyTokenResponse;
      return data;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      // Network error or parsing error
      throw new HttpError(503, "user_service_unavailable");
    }
  }

  /**
   * Get user profile from user-service
   */
  async getUserProfile(userId: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    plan: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/users/${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new HttpError(response.status, "user_not_found");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(503, "user_service_unavailable");
    }
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    try {
      const profile = await this.getUserProfile(userId);
      return profile.role === "ADMIN";
    } catch {
      return false;
    }
  }
}

export const userServiceClient = new UserServiceClient();
