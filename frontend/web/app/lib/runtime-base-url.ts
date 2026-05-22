const DEFAULT_GATEWAY_PORT = 3004;
const DEFAULT_USER_SERVICE_PORT = 3001;
const DEFAULT_CHAT_SERVICE_PORT = 3002;

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function buildUrlFromHost(hostname: string, port: number, protocol: string) {
  return `${protocol}//${hostname}:${port}`;
}

export function getRuntimeBaseUrl(
  envValue: string | undefined,
  defaultPort: number,
): string {
  const fallback = `http://32.236.47.127:${defaultPort}`;

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

  return buildUrlFromHost(currentHost, defaultPort, currentProtocol);
}

export const WEB_GATEWAY_BASE_URL = getRuntimeBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  DEFAULT_GATEWAY_PORT,
);

export const WEB_USER_SERVICE_BASE_URL = getRuntimeBaseUrl(
  process.env.NEXT_PUBLIC_USER_SERVICE_URL,
  DEFAULT_USER_SERVICE_PORT,
);

export const WEB_CHAT_SERVICE_BASE_URL = getRuntimeBaseUrl(
  process.env.NEXT_PUBLIC_CHAT_SERVICE_URL,
  DEFAULT_CHAT_SERVICE_PORT,
);

