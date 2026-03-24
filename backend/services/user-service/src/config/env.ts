type Env = {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  BCRYPT_ROUNDS: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
};

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env: Env = {
  PORT: Number(getEnv("PORT", "3001")),
  DATABASE_URL: getEnv("DATABASE_URL"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: getEnv("JWT_EXPIRES_IN", "7d"),
  JWT_ISSUER: getEnv("JWT_ISSUER", "zalo-lite-user-service"),
  JWT_AUDIENCE: getEnv("JWT_AUDIENCE", "zalo-lite-clients"),
  BCRYPT_ROUNDS: Number(getEnv("BCRYPT_ROUNDS", "10")),
  RATE_LIMIT_WINDOW_MS: Number(getEnv("RATE_LIMIT_WINDOW_MS", "60000")),
  RATE_LIMIT_MAX: Number(getEnv("RATE_LIMIT_MAX", "200")),
};
