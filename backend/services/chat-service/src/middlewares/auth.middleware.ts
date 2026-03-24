import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "missing_bearer_token" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "missing_bearer_token" });
  }

  try {
    req.auth = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ message: "invalid_or_expired_token" });
  }
}
