import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type JwtPayload = {
  user_id: string;
};

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  }) as JwtPayload;
}
