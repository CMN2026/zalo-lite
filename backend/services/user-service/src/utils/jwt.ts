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

type PasswordResetTokenPayload = {
  userId: string;
  type: "password_reset";
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  sub?: string;
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

export function signPasswordResetToken(payload: { userId: string }): string {
  return jwt.sign(
    { userId: payload.userId, type: "password_reset" },
    env.JWT_SECRET,
    {
      expiresIn: "5m",
      issuer: env.JWT_ISSUER,
      audience: "zalo-lite-password-reset",
      subject: payload.userId,
    },
  );
}

export function verifyPasswordResetToken(token: string): PasswordResetTokenPayload {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: "zalo-lite-password-reset",
  }) as PasswordResetTokenPayload;
}
