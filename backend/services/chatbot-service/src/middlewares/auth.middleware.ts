import type { Request, Response, NextFunction } from "express";
import { authGRPCClient } from "../grpc/auth-client.js";
import { HttpError } from "../utils/http-error.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: string; plan: string };
    }
  }
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new HttpError(401, "unauthorized"));
  }

  const token = authHeader.slice(7);

  try {
    // gRPC Pattern: Call user-service via gRPC for token verification
    const verified = await authGRPCClient.verifyToken(token);
    req.auth = {
      userId: verified.userId,
      role: verified.role,
      plan: verified.plan,
    };
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      return next(error);
    }
    next(new HttpError(401, "authentication_failed"));
  }
}
