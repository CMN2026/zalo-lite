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
  } catch {
    return res.status(401).json({ message: "invalid_or_expired_token" });
  }
}
