type Env = {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  ADMIN_EMAILS: string[];
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
  CORS_ORIGINS: string[];
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
};

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV?.trim() ?? "development",
  PORT: Number(getEnv("PORT", "3001")),
  DATABASE_URL: getEnv("DATABASE_URL"),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
  ADMIN_EMAILS: parseList(process.env.ADMIN_EMAILS?.trim() ?? ""),
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: getEnv("JWT_EXPIRES_IN", "7d"),
  JWT_ISSUER: getEnv("JWT_ISSUER", "zalo-lite-user-service"),
  JWT_AUDIENCE: getEnv("JWT_AUDIENCE", "zalo-lite-clients"),
  RATE_LIMIT_WINDOW_MS: Number(getEnv("RATE_LIMIT_WINDOW_MS", "60000")),
  RATE_LIMIT_MAX: Number(getEnv("RATE_LIMIT_MAX", "200")),
  CORS_ORIGINS: parseCorsOrigins(
    getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3003"),
  ),
  SMTP_HOST: process.env.SMTP_HOST?.trim() ?? "",
  SMTP_PORT: Number(getEnv("SMTP_PORT", "587")),
  SMTP_SECURE: (process.env.SMTP_SECURE?.trim() ?? "false") === "true",
  SMTP_USER: process.env.SMTP_USER?.trim() ?? "",
  SMTP_PASS: process.env.SMTP_PASS?.trim() ?? "",
  SMTP_FROM: process.env.SMTP_FROM?.trim() ?? "no-reply@zalolite.local",
};
