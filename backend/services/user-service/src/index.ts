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

const app = express();
const authService = new AuthService();

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

app.get("/health", (_req, res) => {
  res.status(200).json({ service: "user-service", status: "ok" });
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

app.listen(env.PORT, async () => {
  await seedDevUsers();
  console.log(`user-service listening on ${env.PORT}`);
});
