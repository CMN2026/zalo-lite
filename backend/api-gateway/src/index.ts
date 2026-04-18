import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import http from "node:http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { Server as SocketIOServer, type Socket } from "socket.io";
import {
  io as createSocketClient,
  type Socket as ClientSocket,
} from "socket.io-client";

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
const httpServer = http.createServer(app);
const isProduction = process.env.NODE_ENV === "production";

// Socket.io server - proxies to chat-service
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io/",
});

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
    max: isProduction ? 300 : 3000,
    skip: (req) => req.method === "OPTIONS",
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
        const contentTypeHeader = req.headers["content-type"];
        const contentType = Array.isArray(contentTypeHeader)
          ? contentTypeHeader[0]
          : contentTypeHeader;

        if (
          typeof contentType === "string" &&
          contentType.toLowerCase().startsWith("multipart/form-data")
        ) {
          // Multipart payload must remain stream-based; re-serializing can corrupt boundaries.
          return;
        }

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

function mapApiPrefix(apiPrefix: string, upstreamPrefix: string) {
  const normalizedApiPrefix = apiPrefix.endsWith("/")
    ? apiPrefix.slice(0, -1)
    : apiPrefix;
  const normalizedUpstreamPrefix = upstreamPrefix.endsWith("/")
    ? upstreamPrefix.slice(0, -1)
    : upstreamPrefix;

  return (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (normalizedPath.startsWith(normalizedApiPrefix)) {
      const suffix = normalizedPath.slice(normalizedApiPrefix.length);
      return `${normalizedUpstreamPrefix}${suffix}`;
    }

    if (normalizedPath === "/") {
      return normalizedUpstreamPrefix;
    }

    return `${normalizedUpstreamPrefix}${normalizedPath}`;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public routes — no auth required
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  "/api/auth",
  buildProxy(env.USER_SERVICE_URL, mapApiPrefix("/api/auth", "/auth")),
);

// ─────────────────────────────────────────────────────────────────────────────
// Protected routes — JWT required
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  "/api/users",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.USER_SERVICE_URL, mapApiPrefix("/api/users", "/users")),
);

app.use(
  "/api/conversations",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(
    env.CHAT_SERVICE_URL,
    mapApiPrefix("/api/conversations", "/conversations"),
  ),
);

app.use(
  "/api/friends",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.CHAT_SERVICE_URL, mapApiPrefix("/api/friends", "/friends")),
);

app.use(
  "/api/messages",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.CHAT_SERVICE_URL, mapApiPrefix("/api/messages", "/messages")),
);

app.use(
  "/api/uploads",
  buildProxy(env.CHAT_SERVICE_URL, mapApiPrefix("/api/uploads", "/uploads")),
);

app.use(
  "/api/chatbot",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.CHATBOT_SERVICE_URL, mapApiPrefix("/api/chatbot", "/chatbot")),
);

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io connection handling
// ─────────────────────────────────────────────────────────────────────────────

io.use((socket: Socket, next: (err?: Error) => void) => {
  try {
    const headerToken = socket.handshake.headers.authorization;
    const authToken = socket.handshake.auth.token;

    const bearer =
      typeof headerToken === "string" && headerToken.startsWith("Bearer ")
        ? headerToken.slice(7)
        : undefined;

    const token = bearer ?? authToken;

    if (!token || typeof token !== "string") {
      return next(new Error("unauthorized: missing_token"));
    }

    // Verify JWT token
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as AuthPayload;

    // Store auth info in socket for later use
    socket.data.auth = payload;
    socket.data.token = token;
    next();
  } catch (error) {
    console.error("[Socket.io Auth Error]", error);
    next(new Error("unauthorized: invalid_token"));
  }
});

io.on("connection", (socket: Socket) => {
  const token =
    typeof socket.data.token === "string" ? socket.data.token : undefined;

  if (!token) {
    socket.disconnect(true);
    return;
  }

  const upstream: ClientSocket = createSocketClient(env.CHAT_SERVICE_URL, {
    path: "/socket.io/",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  console.log(
    `[Socket.io] Connected: ${socket.id} (user: ${socket.data.auth?.userId})`,
  );

  const clientToUpstreamEvents = [
    "join_conversation",
    "leave_conversation",
    "message:send",
    "message:typing",
    "message:read",
    "message:delete",
    "message:recall",
    "message:react",
  ];

  clientToUpstreamEvents.forEach((eventName) => {
    socket.on(eventName, (payload: unknown) => {
      upstream.emit(eventName, payload);
    });
  });

  const upstreamToClientEvents = [
    "connect",
    "disconnect",
    "connect_error",
    "message:receive",
    "message:send_ack",
    "message:typing",
    "message:read_receipt",
    "message:deleted",
    "message:delete_ack",
    "message:recalled",
    "message:reaction_updated",
    "message:recall_ack",
    "message:reaction_ack",
    "notification:new_message",
    "notification:reply",
    "user:online",
    "user:joined_conversation",
    "user:left_conversation",
    "join_conversation_ack",
    "join_conversation_error",
    "leave_conversation_ack",
    "leave_conversation_error",
    "message:read_error",
    "message:delete_error",
    "message:recall_error",
    "message:reaction_error",
  ];

  upstreamToClientEvents.forEach((eventName) => {
    upstream.on(eventName, (payload: unknown) => {
      if (eventName === "connect") {
        console.log(`[Socket.io] Upstream connected for ${socket.id}`);
        return;
      }
      if (eventName === "disconnect") {
        console.log(`[Socket.io] Upstream disconnected for ${socket.id}`);
        return;
      }
      if (eventName === "connect_error") {
        console.error(`[Socket.io] Upstream error for ${socket.id}`, payload);
        socket.emit("connect_error", payload);
        return;
      }
      socket.emit(eventName, payload);
    });
  });

  socket.on("disconnect", () => {
    if (upstream.connected) {
      upstream.disconnect();
    }
    console.log(`[Socket.io] Disconnected: ${socket.id}`);
  });
});

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

httpServer.listen(env.PORT, () => {
  console.log(`api-gateway listening on port ${env.PORT}`);
  console.log(`  - REST API: http://localhost:${env.PORT}/api/*`);
  console.log(`  - Socket.io: http://localhost:${env.PORT}/socket.io/`);
});

// Graceful shutdown
const signals = ["SIGTERM", "SIGINT"];
signals.forEach((signal) => {
  process.on(signal, () => {
    console.log(`\n[${signal}] Shutting down gracefully...`);
    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
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
