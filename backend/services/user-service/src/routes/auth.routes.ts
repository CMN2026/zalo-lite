import { Router, type Request, type RequestHandler } from "express";
import { body } from "express-validator";
import { AuthController } from "../controllers/auth.controller.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

export const authRoutes = Router();

function normalizeNameFields(req: Request) {
  if (!req.body.fullName && typeof req.body.full_name === "string") {
    req.body.fullName = req.body.full_name;
  }
}

const normalizeNameFieldsMiddleware: RequestHandler = (req, _res, next) => {
  normalizeNameFields(req);
  next();
};

authRoutes.post(
  "/register",
  [
    body().custom((_, { req }) => {
      const fullName = req.body?.fullName;
      const fullNameSnake = req.body?.full_name;
      if (!fullName && !fullNameSnake) {
        throw new Error("fullName_required");
      }

      return true;
    }),
    body("email").trim().isEmail(),
    body("password").isLength({ min: 8, max: 72 }),
    body("fullName")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 2, max: 100 }),
    body("full_name")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 2, max: 100 }),
    body("phone")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 8, max: 20 }),
    body("avatarUrl")
      .optional({ nullable: true })
      .isURL()
      .withMessage("avatarUrl_must_be_valid_url"),
    normalizeNameFieldsMiddleware,
    validateRequest,
  ],
  AuthController.register,
);

authRoutes.post(
  "/login",
  [
    body("identifier").trim().isLength({ min: 3, max: 255 }),
    body("password").isLength({ min: 8, max: 72 }),
    validateRequest,
  ],
  AuthController.login,
);

authRoutes.post(
  "/google",
  [
    body("idToken").trim().notEmpty(),
    body("phone")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 8, max: 20 }),
    body("fullName")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 2, max: 100 }),
    body("full_name")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 2, max: 100 }),
    body("avatarUrl")
      .optional({ nullable: true })
      .isURL()
      .withMessage("avatarUrl_must_be_valid_url"),
    normalizeNameFieldsMiddleware,
    validateRequest,
  ],
  AuthController.loginWithGoogle,
);
