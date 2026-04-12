/**
 * Service Authentication Middleware
 * Validates service-to-service requests
 */

import type { Request, Response, NextFunction } from "express";
import { ServiceTokenManager } from "./service-auth.js";

declare global {
  namespace Express {
    interface Request {
      service?: {
        id: string;
      };
    }
  }
}

/**
 * Middleware to verify service-to-service tokens
 */
export function createServiceAuthMiddleware(tokenManager: ServiceTokenManager) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers["x-service-token"] as string | undefined;

    // Service-to-service token is optional for some endpoints
    // But if provided, it must be valid
    if (token) {
      try {
        const decoded = tokenManager.verifyToken(token);
        req.service = { id: decoded.serviceId };
        return next();
      } catch (error) {
        return res.status(401).json({
          message: "invalid_service_token",
          error: String(error),
        });
      }
    }

    next();
  };
}

/**
 * Middleware to require service-to-service authentication
 * Use this for endpoints that should only be called by other services
 */
export function requireServiceAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.service?.id) {
    return res.status(401).json({
      message: "service_authentication_required",
    });
  }
  next();
}
