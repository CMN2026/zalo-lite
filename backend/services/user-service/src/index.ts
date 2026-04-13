import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/auth.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { AuthService } from "./services/auth.service.js";
import { startGRPCServer, stopGRPCServer } from "./grpc/auth-server.js";
import type { Server as GrpcServer } from "@grpc/grpc-js";

const app = express();
const authService = new AuthService();
let grpcServer: GrpcServer | undefined;
const startTime = Date.now();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
app.use(express.json({ limit: "5mb" }));

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

// Dev mode: Auto-seed test users on startup
const seedDevUsers = async () => {
  if (process.env.NODE_ENV === "production") return;

  const testUsers = [
    {
      fullName: "Admin Support",
      email: "admin@example.com",
      password: "test12345",
      phone: "0999999999",
    },
    {
      fullName: "User A",
      email: "usera@example.com",
      password: "test12345",
      phone: "0111111111",
    },
    {
      fullName: "User B",
      email: "userb@example.com",
      password: "test12345",
      phone: "0222222222",
    },
    {
      fullName: "User C",
      email: "userc@example.com",
      password: "test12345",
      phone: "0333333333",
    },
  ];

  for (const user of testUsers) {
    try {
      await authService.registerWithCredentials(user);
      console.log(`✅ Seeded user: ${user.email}`);
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        console.log(`ℹ️ User already exists: ${user.email}`);
      } else {
        console.error(`❌ Failed to seed ${user.email}:`, error.message);
      }
    }
  }
};

async function start() {
  try {
    await seedDevUsers();

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

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);
  if (grpcServer) {
    await stopGRPCServer(grpcServer);
  }
  process.exit(0);
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
