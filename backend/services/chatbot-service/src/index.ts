import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env.js";
import { initDynamoDB } from "./config/dynamodb.js";
import { redisClient } from "./config/redis.js";
import { adminRoutes } from "./routes/notification.routes.js";
import { chatbotRoutes } from "./routes/chatbot.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { ChatbotIOHandler } from "./handlers/chatbot.io.handler.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import { authGRPCClient } from "./grpc/auth-client.js";

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

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({
    service: "chatbot-service",
    status: "ok",
    grpc: "connected",
  });
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
  console.log("SIGTERM received, shutting down gracefully...");
  authGRPCClient.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  authGRPCClient.close();
  process.exit(0);
});

// Startup
async function start() {
  try {
    await initDynamoDB();
    await redisClient.connect();

    httpServer.listen(env.PORT, () => {
      console.log(`chatbot-service listening on ${env.PORT}`);
      console.log(`gRPC connection established to user-service:50051`);
    });
  } catch (error) {
    console.error("Failed to start chatbot service:", error);
    process.exit(1);
  }
}

start();
