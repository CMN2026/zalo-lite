import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "@types/express";
import authRoutes from "./routes/auth.routes";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "user-service" });
});

// Routes
app.use("/api/auth", authRoutes);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
});
