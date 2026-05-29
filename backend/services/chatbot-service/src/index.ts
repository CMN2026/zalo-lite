import "./observability/tracing.js";
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env.js";
import { initDynamoDB } from "./config/dynamodb.js";
import { redisClient } from "./config/redis.js";
import { adminRoutes } from "./routes/notification.routes.js";
import { chatbotRoutes } from "./routes/chatbot.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { ChatbotIOHandler } from "./handlers/chatbot.io.handler.js";
import { authGRPCClient } from "./grpc/auth-client.js";
import {
  getProviderHealthSnapshot,
  renderMetrics,
} from "./observability/metrics.js";
import { logger } from "./observability/logger.js";
import { randomUUID } from "node:crypto";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    skip: (req) => req.method === "OPTIONS",
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const requestId = (req.header("x-request-id") || randomUUID()).toString();
  res.setHeader("x-request-id", requestId);
  (req as express.Request & { requestId: string }).requestId = requestId;
  logger.info("http_request", {
    requestId,
    method: req.method,
    path: req.path,
  });
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({
    service: "chatbot-service",
    status: "ok",
    grpc: "connected",
    providers: getProviderHealthSnapshot(),
  });
});

app.get("/metrics", (_req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(200).send(renderMetrics());
});

// Routes
app.use("/chatbot", chatbotRoutes);
app.use("/admin/notifications", adminRoutes);

// Error handling
app.use(errorHandler);

// Socket.io handlers
const chatbotIOHandler = new ChatbotIOHandler(io);
chatbotIOHandler.setupHandlers();

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("shutdown_signal", { signal: "SIGTERM" });
  authGRPCClient.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("shutdown_signal", { signal: "SIGINT" });
  authGRPCClient.close();
  process.exit(0);
});

// Startup
try {
  await initDynamoDB();
  await redisClient.connect();

  httpServer.listen(env.PORT, () => {
    logger.info("service_started", {
      service: "chatbot-service",
      port: env.PORT,
    });
    logger.info("grpc_ready", { target: "user-service:50051" });
  });
} catch (error) {
  logger.error("service_start_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}
