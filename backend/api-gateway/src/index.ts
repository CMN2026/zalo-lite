import "dotenv/config";
import "./tracing.js";
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

type FriendProfile = {
  id?: string;
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
};

type FriendRequestPayload = {
  id?: string;
  status?: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED";
  message?: string | null;
  requester?: FriendProfile;
  addressee?: FriendProfile;
};

type ApiEnvelope<T> = {
  message?: string;
  data?: T;
};

const env = {
  PORT: Number(process.env.PORT ?? 3004),
  USER_SERVICE_URL: process.env.USER_SERVICE_URL ?? "http://32.236.47.127:3001",
  CHAT_SERVICE_URL: process.env.CHAT_SERVICE_URL ?? "http://32.236.47.127:3002",
  CHATBOT_SERVICE_URL:
    process.env.CHATBOT_SERVICE_URL ?? "http://32.236.47.127:3003",
  POST_SERVICE_URL:
    process.env.POST_SERVICE_URL ?? "http://32.236.47.127:3005",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret",
  JWT_ISSUER: process.env.JWT_ISSUER ?? "zalo-lite-user-service",
  JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? "zalo-lite-clients",
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "http://32.236.47.127:3000")
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
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
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

// ── File uploads proxy (MUST come BEFORE express.json body parsing) ──────────
// Proxied as a raw stream so binary file responses aren't corrupted by body
// parsing middleware.  Auth is handled by the chat-service itself (via
// ?token= query-string or Authorization header).
app.use(
  "/api/uploads",
  createProxyMiddleware({
    target: env.CHAT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (p, req) => {
      const rewritten = `/${p}`.replace(/^\/\//, "/").replace(/^\//, "/uploads/");
      console.log(`[Proxy] pathRewrite: ${p} -> ${rewritten}`);
      return rewritten;
    },
    on: {
      proxyRes(proxyRes) {
        // Android OkHttp / Fresco throws "unexpected end of stream" when the
        // upstream answers with Connection: close on a large binary body.
        // Force keep-alive so the TCP socket stays open until the full
        // Content-Length payload is delivered.
        proxyRes.headers["connection"] = "keep-alive";

        // Remove weak ETag prefix that can confuse some HTTP caches.
        const etag = proxyRes.headers["etag"];
        if (typeof etag === "string" && etag.startsWith('W/"')) {
          proxyRes.headers["etag"] = etag.slice(2);
        }
      },
      error(err, _req, res) {
        console.error("[Proxy Error /api/uploads]", err);
        const response = res as Response;
        if (!response.headersSent) {
          response.status(503).json({
            message: "service_unavailable",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      },
    },
  }) as unknown as express.RequestHandler,
);

// IMPORTANT: Parse body here so we can re-serialize it for the proxy.
// Without this, http-proxy-middleware tries to forward an already-consumed stream.
// NOTE: /api/uploads is mounted ABOVE so file streaming is unaffected.
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

function getBearerHeader(req: Request) {
  return typeof req.headers.authorization === "string"
    ? req.headers.authorization
    : "";
}

async function forwardJsonToUserService(
  req: Request,
  res: Response,
  upstreamPath: string,
): Promise<unknown> {
  const response = await fetch(`${env.USER_SERVICE_URL}${upstreamPath}`, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: getBearerHeader(req),
    },
    body: JSON.stringify(req.body ?? {}),
  });

  const raw = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType) {
    res.setHeader("content-type", contentType);
  }

  res.status(response.status).send(raw);

  if (!raw || !contentType.includes("application/json")) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
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

app.post(
  "/api/users/friend-requests",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  async (req, res, next) => {
    try {
      const payload = (await forwardJsonToUserService(
        req,
        res,
        "/users/friend-requests",
      )) as ApiEnvelope<FriendRequestPayload> | null;

      const request = payload?.data;
      if (!request || res.statusCode >= 400) {
        return;
      }

      if (request.status === "ACCEPTED") {
        const requesterId = request.requester?.id;
        if (requesterId) {
          io.to(`user_${requesterId}`).emit("friend_request:accepted", {
            requestId: request.id,
            friend: request.addressee,
          });
        }
        return;
      }

      const addresseeId = request.addressee?.id;
      if (addresseeId) {
        io.to(`user_${addresseeId}`).emit("friend_request:incoming", {
          requestId: request.id,
          requester: request.requester,
          message: request.message ?? null,
        });
      }
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/users/friend-requests/:requestId/respond",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  async (req, res, next) => {
    try {
      const payload = (await forwardJsonToUserService(
        req,
        res,
        `/users/friend-requests/${encodeURIComponent(
          req.params.requestId,
        )}/respond`,
      )) as ApiEnvelope<FriendRequestPayload> | null;

      const request = payload?.data;
      if (!request || res.statusCode >= 400 || request.status !== "ACCEPTED") {
        return;
      }

      const requesterId = request.requester?.id;
      if (requesterId) {
        io.to(`user_${requesterId}`).emit("friend_request:accepted", {
          requestId: request.id,
          friend: request.addressee,
        });
      }
    } catch (error) {
      next(error);
    }
  },
);

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
  "/api/calls",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.CHAT_SERVICE_URL, mapApiPrefix("/api/calls", "/calls")),
);

// /api/uploads is mounted before express.json() — see above.
// Do NOT add it here; it is already registered.

app.use(
  "/api/chatbot",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.CHATBOT_SERVICE_URL, mapApiPrefix("/api/chatbot", "/chatbot")),
);

// ── Post Service Routes ──────────────────────────────────────────────────────
app.use(
  "/api/posts",
  authenticateJwt,
  authorizeRoles("USER", "ADMIN"),
  buildProxy(env.POST_SERVICE_URL, mapApiPrefix("/api/posts", "/posts")),
);

// Post uploads proxy (file serving, needs raw stream like /api/uploads)
app.use(
  "/api/post-uploads",
  createProxyMiddleware({
    target: env.POST_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (p) => {
      const rewritten = `/${p}`.replace(/^\/\//, "/").replace(/^\//, "/post-uploads/");
      return rewritten;
    },
    on: {
      proxyRes(proxyRes) {
        proxyRes.headers["connection"] = "keep-alive";
      },
      error(err, _req, res) {
        console.error("[Proxy Error /api/post-uploads]", err);
        const response = res as Response;
        if (!response.headersSent) {
          response.status(503).json({
            message: "service_unavailable",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      },
    },
  }) as unknown as express.RequestHandler,
);

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io connection handling
// ─────────────────────────────────────────────────────────────────────────────

io.use((socket: Socket, next: (err?: Error) => void) => {
  let token: string | undefined = undefined;
  try {
    const headerToken = socket.handshake.headers.authorization;
    const authToken = socket.handshake.auth.token;

    const bearer =
      typeof headerToken === "string" && headerToken.startsWith("Bearer ")
        ? headerToken.slice(7)
        : undefined;

    token = (bearer ?? authToken) as string | undefined;

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

  const userId =
    typeof socket.data.auth?.userId === "string"
      ? socket.data.auth.userId
      : undefined;
  if (userId) {
    socket.join(`user_${userId}`);
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
    `[Socket.io] Connected: ${socket.id} (user: ${userId ?? "unknown"})`,
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
    "call:initiate",
    "call:accept",
    "call:decline",
    "call:offer",
    "call:answer",
    "call:ice_candidate",
    "call:participant_update",
    "call:end",
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
    "receive_message",
    "message:receive",
    "message:send_ack",
    "message:typing",
    "message:read_receipt",
    "message:deleted",
    "message:delete_ack",
    "message:recalled",
    "force_logout",
    "message:reaction_updated",
    "message:recall_ack",
    "message:reaction_ack",
    "notification:new_message",
    "notification:reply",
    "conversation:created",
    "conversation:deleted",
    "conversation:member_left",
    "conversation:member_removed",
    "conversation:member_role_updated",
    "conversation:members_added",
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
    "call:initiate",
    "call:initiate_ack",
    "call:accept",
    "call:decline",
    "call:offer",
    "call:answer",
    "call:ice_candidate",
    "call:participant_update",
    "call:end",
    "call:missed",
    "call:signal_ack",
    "call:error",
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
      if (eventName === "force_logout") {
        console.log(`[Socket.io] Upstream received force_logout for ${socket.id}`);
        socket.emit("force_logout", payload);
        upstream.disconnect();
        return;
      }
      if (eventName === "connect_error") {
        console.error(`[Socket.io] Upstream error for ${socket.id}`, payload);
        socket.emit("upstream_connect_error", {
          message:
            payload instanceof Error
              ? payload.message
              : "Unable to connect to chat service",
        });
        return;
      }
      socket.emit(eventName, payload);
    });
  });

  socket.on("disconnect", () => {
    upstream.disconnect();
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
  console.log("[authenticateJwt] Hit for URL:", req.originalUrl);
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

