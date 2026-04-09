import { Router } from "express";
import { body, query, param } from "express-validator";
import { UserController } from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

export const userRoutes = Router();

userRoutes.use(authMiddleware);

userRoutes.get("/me", UserController.getMe);
userRoutes.patch(
  "/me",
  [
    body("fullName")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 2, max: 100 }),
    body("phone")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 8, max: 20 }),
    body("bio")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 0, max: 280 }),
    validateRequest,
  ],
  UserController.updateMe,
);

userRoutes.patch(
  "/me/avatar",
  [
    body("avatarUrl").trim().isURL().withMessage("avatarUrl_must_be_valid_url"),
    validateRequest,
  ],
  UserController.updateAvatar,
);

userRoutes.get(
  "/discover",
  [query("phone").trim().isLength({ min: 1, max: 20 }), validateRequest],
  UserController.discoverByPhone,
);

userRoutes.post(
  "/friend-requests",
  [
    body("phone").trim().isLength({ min: 8, max: 20 }),
    body("message")
      .optional({ nullable: true })
      .trim()
      .isLength({ min: 0, max: 150 }),
    validateRequest,
  ],
  UserController.sendFriendRequest,
);

userRoutes.get("/friend-requests/incoming", UserController.listIncomingRequests);

userRoutes.post(
  "/friend-requests/:requestId/respond",
  [
    param("requestId").isUUID(),
    body("action").isIn(["accept", "reject"]),
    validateRequest,
  ],
  UserController.respondFriendRequest,
);

userRoutes.get("/friends", UserController.listFriends);
userRoutes.get("/admin/list", UserController.listUsersForAdmin);
