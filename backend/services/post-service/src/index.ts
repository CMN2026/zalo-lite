import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { ensureTables } from "./config/dynamodb.js";
import { authMiddleware } from "./middlewares/auth.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { setupPostFileServer } from "./middlewares/upload.middleware.js";
import { postRoutes } from "./routes/post.routes.js";
import { initUserClientService } from "./services/user-client.service.js";

const app = express();
const server = http.createServer(app);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ service: "post-service", status: "ok" });
});

// Setup file server before auth middleware (images need auth via query token)
setupPostFileServer(app);

// Protected routes
app.use(authMiddleware);
app.use("/posts", postRoutes);
app.use(errorHandler);

// Initialize user client service
initUserClientService(env.USER_SERVICE_BASE_URL);

async function bootstrap() {
  await ensureTables();

  server.listen(env.PORT, () => {
    console.log(`post-service listening on ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start post-service", error);
  process.exit(1);
});
