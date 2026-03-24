import { Router } from "express";
import { query, param } from "express-validator";
import { UserController } from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

export const userRoutes = Router();

userRoutes.get("/me", authMiddleware, UserController.getMe);
userRoutes.get(
  "/search",
  [query("phone").optional().isLength({ min: 1, max: 20 }), validateRequest],
  UserController.searchByPhone,
);
userRoutes.get(
  "/:id",
  [param("id").isUUID(), validateRequest],
  UserController.getById,
);
