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
import { createProxyMiddleware } from "http-proxy-middleware";

type AuthPayload = {
  user_id: string;
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
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "http://localhost:3002")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

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
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ service: "api-gateway", status: "ok" });
});

app.use(
  "/api/auth",
  createProxyMiddleware({
    target: env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/auth": "/auth" },
  }),
);

app.use(
  "/api/users",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  createProxyMiddleware({
    target: env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/users": "/users" },
  }),
);

app.use(
  "/api/admin/users",
  authenticateJwt,
  authorizeRoles("ADMIN"),
  createProxyMiddleware({
    target: env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/admin/users": "/users/admin/list" },
  }),
);

app.use(
  "/api/conversations",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  createProxyMiddleware({
    target: env.CHAT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/conversations": "/conversations" },
  }),
);

app.use(
  "/api/friends",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  createProxyMiddleware({
    target: env.CHAT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/friends": "/friends" },
  }),
);

app.use(
  "/api/chatbot",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  createProxyMiddleware({
    target: env.CHATBOT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/chatbot": "/chatbot" },
  }),
);

app.use(
  "/api/groups/:conversationId/messages",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  createProxyMiddleware({
    target: env.CHAT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/groups/(.+)/messages": "/conversations/$1/messages" },
  }),
);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  return res.status(500).json({ message: "gateway_internal_error" });
});

app.listen(env.PORT, () => {
  console.log(`api-gateway listening on ${env.PORT}`);
});

function authenticateJwt(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ message: "missing_bearer_token" });
  }

  const [prefix, token] = header.split(" ");
  if (prefix !== "Bearer" || !token) {
    return res.status(401).json({ message: "invalid_authorization_header" });
  }

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

    // Add user_id to request for downstream services
    (req as any).userId = req.auth.user_id;
    return next();
  };
}
