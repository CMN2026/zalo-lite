type Env = {
  PORT: number;
  USER_SERVICE_BASE_URL: string;
  CHAT_SERVICE_BASE_URL: string;
  AWS_REGION: string;
  DYNAMODB_ENDPOINT?: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  REDIS_URL: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX: number;
  CORS_ORIGINS: string[];
  ENABLE_AI_ENGINE: boolean;
  GEMINI_API_KEY: string;
  TABLE_CONVERSATIONS: string;
  TABLE_FAQ: string;
  TABLE_NOTIFICATIONS: string;
  TABLE_ANALYTICS: string;
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
  PORT: Number(getEnv("PORT", "3003")),
  USER_SERVICE_BASE_URL: getEnv(
    "USER_SERVICE_BASE_URL",
    "http://localhost:3001",
  ),
  CHAT_SERVICE_BASE_URL: getEnv(
    "CHAT_SERVICE_BASE_URL",
    "http://localhost:3002",
  ),
  AWS_REGION: getEnv("AWS_REGION", "ap-southeast-1"),
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT,
  AWS_ACCESS_KEY_ID: getEnv("AWS_ACCESS_KEY_ID", "dummy"),
  AWS_SECRET_ACCESS_KEY: getEnv("AWS_SECRET_ACCESS_KEY", "dummy"),
  REDIS_URL: getEnv("REDIS_URL", "redis://localhost:6379"),
  RATE_LIMIT_WINDOW_MS: Number(getEnv("RATE_LIMIT_WINDOW_MS", "60000")),
  RATE_LIMIT_MAX: Number(getEnv("RATE_LIMIT_MAX", "200")),
  CORS_ORIGINS: parseCorsOrigins(
    getEnv("CORS_ORIGINS", "http://localhost:3000"),
  ),
  ENABLE_AI_ENGINE: getEnv("ENABLE_AI_ENGINE", "false") === "true",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY?.trim() ?? "",
  TABLE_CONVERSATIONS: getEnv("TABLE_CONVERSATIONS", "chatbot_conversations"),
  TABLE_FAQ: getEnv("TABLE_FAQ", "chatbot_faq"),
  TABLE_NOTIFICATIONS: getEnv("TABLE_NOTIFICATIONS", "chatbot_notifications"),
  TABLE_ANALYTICS: getEnv("TABLE_ANALYTICS", "chatbot_analytics"),
};
