import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

type AccessTokenPayload = {
  user_id: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export function signAccessToken(payload: { user_id: string }): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  }) as AccessTokenPayload;
}
