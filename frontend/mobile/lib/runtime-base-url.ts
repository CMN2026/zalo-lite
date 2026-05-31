const DEFAULT_GATEWAY_PORT = 3004;
const DEFAULT_USER_SERVICE_PORT = 3001;
const DEFAULT_CHAT_SERVICE_PORT = 3002;
const DEFAULT_CHATBOT_SERVICE_PORT = 3003;
const DEFAULT_POST_SERVICE_PORT = 3005;

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function buildUrlFromHost(hostname: string, port: number, protocol: string) {
  return `${protocol}//${hostname}:${port}`;
}

function buildOriginUrl(hostname: string, protocol: string) {
  return `${protocol}//${hostname}`;
}

export function getRuntimeBaseUrl(
  envValue: string | undefined,
  defaultPort: number,
): string {
  const fallback = `http://localhost:${defaultPort}`;

  if (typeof window === "undefined") {
    return envValue ?? fallback;
  }

  const currentHost = window.location.hostname;
  const currentProtocol = window.location.protocol || "http:";

  if (envValue) {
    try {
      const configured = new URL(envValue);
      if (isLoopbackHost(configured.hostname) && !isLoopbackHost(currentHost)) {
        const port = configured.port ? Number(configured.port) : defaultPort;
        return buildUrlFromHost(currentHost, port, currentProtocol);
      }
      return envValue;
    } catch {
      return envValue;
    }
  }

  if (!isLoopbackHost(currentHost)) {
    return buildOriginUrl(currentHost, currentProtocol);
  }

  return buildUrlFromHost(currentHost, defaultPort, currentProtocol);
}

export const MOBILE_GATEWAY_BASE_URL = getRuntimeBaseUrl(
  process.env.EXPO_PUBLIC_API_BASE_URL,
  DEFAULT_GATEWAY_PORT,
);

export const MOBILE_USER_SERVICE_BASE_URL = getRuntimeBaseUrl(
  process.env.EXPO_PUBLIC_USER_SERVICE_URL,
  DEFAULT_USER_SERVICE_PORT,
);

export const MOBILE_CHAT_SERVICE_BASE_URL = getRuntimeBaseUrl(
  process.env.EXPO_PUBLIC_CHAT_SERVICE_URL,
  DEFAULT_CHAT_SERVICE_PORT,
);

export const MOBILE_CHATBOT_SERVICE_BASE_URL = getRuntimeBaseUrl(
  process.env.EXPO_PUBLIC_CHATBOT_SERVICE_URL,
  DEFAULT_CHATBOT_SERVICE_PORT,
);

export const MOBILE_POST_SERVICE_BASE_URL = getRuntimeBaseUrl(
  process.env.EXPO_PUBLIC_POST_SERVICE_URL,
  DEFAULT_POST_SERVICE_PORT,
);
