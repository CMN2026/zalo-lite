import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "missing_bearer_token" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "missing_bearer_token" });
  }

  try {
    const payload = verifyToken(token);
    // Normalize payload: support both userId and user_id
    const userId = payload.userId || payload.user_id;
    if (!userId) {
      return res.status(401).json({ message: "invalid_token_payload" });
    }
    req.auth = { user_id: userId };
    return next();
  } catch (error) {
    // Development mode: try to extract user_id from mock token
    if (process.env.NODE_ENV !== "production") {
      try {
        // Mock token format: header.payload.mock-signature
        const parts = token.split(".");
        if (parts.length === 3) {
          const payloadStr = Buffer.from(parts[1], "base64").toString("utf-8");
          const payload = JSON.parse(payloadStr) as {
            user_id?: string;
            userId?: string;
          };
          const userId = payload.user_id ?? payload.userId;
          if (userId) {
            console.log(
              `🔐 Dev auth (HTTP): Extracted user_id from mock token: ${userId}`,
            );
            req.auth = { user_id: userId };
            return next();
          }
        }
      } catch (parseError) {
        console.error("Failed to parse mock token:", parseError);
      }
    }
    return res.status(401).json({ message: "invalid_or_expired_token" });
  }
}
