import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/auth.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { startGRPCServer, stopGRPCServer } from "./grpc/auth-server.js";
import { prisma } from "./config/db.js";
import type * as grpc from "@grpc/grpc-js";

const app = express();
let grpcServer: grpc.Server;

// Simple health check endpoint
const startTime = Date.now();

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

// Improved health check endpoint
app.get("/health", (_req, res) => {
  const uptime = Date.now() - startTime;
  res.status(200).json({
    service: "user-service",
    status: "healthy",
    uptime: uptime,
  });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);

app.use(errorHandler);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  if (grpcServer) {
    await stopGRPCServer(grpcServer);
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  if (grpcServer) {
    await stopGRPCServer(grpcServer);
  }
  process.exit(0);
});

async function start() {
  try {
    // Start gRPC server
    grpcServer = await startGRPCServer(50051);

    // Start HTTP server
    app.listen(env.PORT, () => {
      console.log(`user-service listening on ${env.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start user-service:", error);
    process.exit(1);
  }
}

start();
