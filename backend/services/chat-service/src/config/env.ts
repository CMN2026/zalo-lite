type Env = {
  PORT: number;
  REDIS_URL: string;
  DYNAMODB_ENDPOINT?: string;
  AWS_REGION: string;
  USER_SERVICE_BASE_URL: string;
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
  REDIS_MESSAGE_CHANNEL: string;
  REDIS_CALL_SIGNAL_CHANNEL: string;
  TABLE_CONVERSATIONS: string;
  TABLE_CONVERSATION_MEMBERS: string;
  TABLE_MESSAGES: string;
  TABLE_FRIEND_REQUESTS: string;
  TABLE_FRIENDSHIPS: string;
  TABLE_CALL_SESSIONS: string;
  TABLE_CALL_HISTORY: string;
  CORS_ORIGINS: string[];
  LIVEKIT_URL?: string;
  LIVEKIT_PUBLIC_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  CALL_INVITE_TIMEOUT_SECONDS: number;
  USE_S3: boolean;
  S3_BUCKET_NAME?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
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
  PORT: Number(getEnv("PORT", "3002")),
  REDIS_URL: getEnv("REDIS_URL", "redis://redis:6379"),
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT,
  AWS_REGION: getEnv("AWS_REGION", "ap-southeast-1"),
  USER_SERVICE_BASE_URL: getEnv(
    "USER_SERVICE_BASE_URL",
    "http://user-service:3001",
  ),
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_ISSUER: getEnv("JWT_ISSUER", "zalo-lite-user-service"),
  JWT_AUDIENCE: getEnv("JWT_AUDIENCE", "zalo-lite-clients"),
  RATE_LIMIT_WINDOW_MS: Number(getEnv("RATE_LIMIT_WINDOW_MS", "60000")),
  RATE_LIMIT_MAX: Number(getEnv("RATE_LIMIT_MAX", "300")),
  REDIS_MESSAGE_CHANNEL: getEnv("REDIS_MESSAGE_CHANNEL", "chat:messages"),
  REDIS_CALL_SIGNAL_CHANNEL: getEnv(
    "REDIS_CALL_SIGNAL_CHANNEL",
    "chat:calls:signaling",
  ),
  TABLE_CONVERSATIONS: getEnv("TABLE_CONVERSATIONS", "conversations"),
  TABLE_CONVERSATION_MEMBERS: getEnv(
    "TABLE_CONVERSATION_MEMBERS",
    "conversation_members",
  ),
  TABLE_MESSAGES: getEnv("TABLE_MESSAGES", "messages"),
  TABLE_FRIEND_REQUESTS: getEnv("TABLE_FRIEND_REQUESTS", "friend_requests"),
  TABLE_FRIENDSHIPS: getEnv("TABLE_FRIENDSHIPS", "friendships"),
  TABLE_CALL_SESSIONS: getEnv("TABLE_CALL_SESSIONS", "call_sessions"),
  TABLE_CALL_HISTORY: getEnv("TABLE_CALL_HISTORY", "call_history"),
  CORS_ORIGINS: parseCorsOrigins(
    getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3004"),
  ),
  LIVEKIT_URL: process.env.LIVEKIT_URL,
  LIVEKIT_PUBLIC_URL: process.env.LIVEKIT_PUBLIC_URL,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  CALL_INVITE_TIMEOUT_SECONDS: Number(
    getEnv("CALL_INVITE_TIMEOUT_SECONDS", "15"),
  ),
  USE_S3: process.env.USE_S3 === "true",
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
};
