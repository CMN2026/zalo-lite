import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type JwtPayload = {
  user_id: string;
};

export function verifyToken(token: string): JwtPayload {
  const rawPayload = jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  }) as { user_id?: string; userId?: string; sub?: string };

  const userId = rawPayload.user_id ?? rawPayload.userId ?? rawPayload.sub;
  if (!userId) {
    throw new Error("invalid_token_payload");
  }

  return { user_id: userId };
}
