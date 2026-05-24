type Env = {
  PORT: number;
  AWS_REGION: string;
  DYNAMODB_ENDPOINT?: string;
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  USER_SERVICE_BASE_URL: string;
  TABLE_POSTS: string;
  TABLE_POST_COMMENTS: string;
  TABLE_POST_REACTIONS: string;
  CORS_ORIGINS: string[];
  USE_S3: boolean;
  S3_BUCKET_NAME?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
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

function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const env: Env = {
  PORT: Number(getEnv("PORT", "3005")),
  AWS_REGION: getEnv("AWS_REGION", "ap-southeast-1"),
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT,
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_ISSUER: getEnv("JWT_ISSUER", "zalo-lite-user-service"),
  JWT_AUDIENCE: getEnv("JWT_AUDIENCE", "zalo-lite-clients"),
  USER_SERVICE_BASE_URL: getEnv(
    "USER_SERVICE_BASE_URL",
    "http://user-service:3001",
  ),
  TABLE_POSTS: getEnv("TABLE_POSTS", "posts"),
  TABLE_POST_COMMENTS: getEnv("TABLE_POST_COMMENTS", "post_comments"),
  TABLE_POST_REACTIONS: getEnv("TABLE_POST_REACTIONS", "post_reactions"),
  CORS_ORIGINS: parseCorsOrigins(
    getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3004"),
  ),
  USE_S3: process.env.USE_S3 === "true",
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  RATE_LIMIT_WINDOW_MS: Number(getEnv("RATE_LIMIT_WINDOW_MS", "60000")),
  RATE_LIMIT_MAX: Number(getEnv("RATE_LIMIT_MAX", "300")),
};
