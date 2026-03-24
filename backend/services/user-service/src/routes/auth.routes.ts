import { Router } from "express";
import { body } from "express-validator";
import { AuthController } from "../controllers/auth.controller.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

export const authRoutes = Router();

authRoutes.post(
  "/register",
  [
    body("phone").trim().isLength({ min: 8, max: 20 }),
    body("password").isLength({ min: 8, max: 72 }),
    body("full_name").trim().isLength({ min: 2, max: 100 }),
    body("email").optional().isEmail(),
    body("birth_date").optional().isISO8601(),
    body("gender").optional().isIn(["male", "female", "other"]),
    validateRequest,
  ],
  AuthController.register,
);

authRoutes.post(
  "/login",
  [
    body("phone").trim().isLength({ min: 8, max: 20 }),
    body("password").isLength({ min: 8, max: 72 }),
    validateRequest,
  ],
  AuthController.login,
);
