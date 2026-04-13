import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";
import { HttpError } from "../utils/http-error.js";

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new HttpError(401, "missing_bearer_token"));
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next(new HttpError(401, "missing_bearer_token"));
  }

  try {
    const payload = verifyToken(token);
    // Normalize payload: support both userId and user_id
    const userId = payload.userId || payload.user_id;
    if (!userId) {
      return next(new HttpError(401, "invalid_token_payload"));
    }
    req.auth = { userId };
    return next();
  } catch (error) {
    return next(new HttpError(401, "invalid_or_expired_token"));
  }
}
