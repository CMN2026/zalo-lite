import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { HttpError } from "../utils/http-error.js";

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = extractToken(req);
  if (!token) {
    return next(new HttpError(401, "missing_bearer_token"));
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    return next();
  } catch {
    return next(new HttpError(401, "invalid_or_expired_token"));
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    return null;
  }

  return parts[1];
}
