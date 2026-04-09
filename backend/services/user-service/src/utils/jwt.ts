import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

type AccessTokenPayload = {
  userId: string;
  role: "USER" | "ADMIN";
  plan: "FREE" | "PREMIUM";
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
};

export function signAccessToken(payload: {
  userId: string;
  role: "USER" | "ADMIN";
  plan: "FREE" | "PREMIUM";
}): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    subject: payload.userId,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  }) as AccessTokenPayload;
}
