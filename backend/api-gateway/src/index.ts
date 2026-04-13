import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

type AuthPayload = {
  userId: string; // JWT uses camelCase from user-service
  role: "USER" | "ADMIN";
  plan: "FREE" | "PREMIUM";
};

const env = {
  PORT: Number(process.env.PORT ?? 3004),
  USER_SERVICE_URL: process.env.USER_SERVICE_URL ?? "http://localhost:3001",
  CHAT_SERVICE_URL: process.env.CHAT_SERVICE_URL ?? "http://localhost:3002",
  CHATBOT_SERVICE_URL:
    process.env.CHATBOT_SERVICE_URL ?? "http://localhost:3003",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret",
  JWT_ISSUER: process.env.JWT_ISSUER ?? "zalo-lite-user-service",
  JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? "zalo-lite-clients",
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// IMPORTANT: Parse body here so we can re-serialize it for the proxy.
// Without this, http-proxy-middleware tries to forward an already-consumed stream → ERR_EMPTY_RESPONSE.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.status(200).json({ service: "api-gateway", status: "ok" });
});

/**
 * Build a proxy middleware that:
 * 1. Rewrites the path prefix
 * 2. Re-serialises the JSON body that Express already consumed
 */
function buildProxy(
  target: string,
  mapPath: (path: string) => string,
): express.RequestHandler {
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => mapPath(path),
    // Allow us to modify the request before it's sent upstream
    on: {
      proxyReq(proxyReq, req) {
        // Re-stream body that was already parsed by express.json().
        fixRequestBody(proxyReq, req as unknown as Request);
      },
      error(err, _req, res) {
        console.error("[Proxy Error]", err);
        const response = res as Response;
        if (!response.headersSent) {
          response.status(503).json({
            message: "service_unavailable",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      },
    },
  });

  return proxy as unknown as express.RequestHandler;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public routes — no auth required
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  "/api/auth",
  buildProxy(env.USER_SERVICE_URL, (path) => `/auth${path}`),
);

// ─────────────────────────────────────────────────────────────────────────────
// Protected routes — JWT required
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  "/api/users",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.USER_SERVICE_URL, (path) => `/users${path}`),
);

app.use(
  "/api/conversations",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.CHAT_SERVICE_URL, (path) => `/conversations${path}`),
);

app.use(
  "/api/friends",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.CHAT_SERVICE_URL, (path) => `/friends${path}`),
);

app.use(
  "/api/chatbot",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.CHATBOT_SERVICE_URL, (path) => `/chatbot${path}`),
);

// ─────────────────────────────────────────────────────────────────────────────
// Global error handler
// ─────────────────────────────────────────────────────────────────────────────

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Gateway Error]", error);
  if (!res.headersSent) {
    res.status(500).json({ message: "gateway_internal_error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

app.listen(env.PORT, () => {
  console.log(`api-gateway listening on port ${env.PORT}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────────────

function authenticateJwt(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "missing_bearer_token" });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as AuthPayload;

    req.auth = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "invalid_or_expired_token" });
  }
}

function authorizeRoles(...roles: Array<"USER" | "ADMIN">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ message: "unauthorized" });
    }
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ message: "forbidden" });
    }
    return next();
  };
}
