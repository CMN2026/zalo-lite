import { Router } from "express";
import { body, query, param } from "express-validator";
import { UserController } from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

export const userRoutes = Router();

const avatarUrlValidator = (value: unknown) => {
  if (typeof value !== "string") {
    throw new Error("avatarUrl_must_be_valid_url_or_image_data");
  }

  const isHttpUrl = /^https?:\/\/\S+$/i.test(value);
  const isImageDataUrl =
    /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value);

  if (!isHttpUrl && !isImageDataUrl) {
    throw new Error("avatarUrl_must_be_valid_url_or_image_data");
  }

  return true;
};

userRoutes.use(authMiddleware);

userRoutes.get("/chat-peers", UserController.listChatPeers);
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
  [body("avatarUrl").trim().custom(avatarUrlValidator), validateRequest],
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

userRoutes.get(
  "/friend-requests/incoming",
  UserController.listIncomingRequests,
);

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
userRoutes.get(
  "/friendships/:otherUserId",
  [param("otherUserId").isUUID(), validateRequest],
  UserController.getFriendshipStatus,
);
// Backward-compatible alias for older frontend bundles.
userRoutes.get(
  "/friendship/:otherUserId",
  [param("otherUserId").isUUID(), validateRequest],
  UserController.getFriendshipStatus,
);
userRoutes.post(
  "/friendships/:otherUserId/block",
  [param("otherUserId").isUUID(), validateRequest],
  UserController.blockFriendship,
);
// Backward-compatible alias for older frontend bundles.
userRoutes.post(
  "/friendship/:otherUserId/block",
  [param("otherUserId").isUUID(), validateRequest],
  UserController.blockFriendship,
);
userRoutes.post(
  "/friendships/:otherUserId/unblock",
  [param("otherUserId").isUUID(), validateRequest],
  UserController.unblockFriendship,
);
// Backward-compatible alias for older frontend bundles.
userRoutes.post(
  "/friendship/:otherUserId/unblock",
  [param("otherUserId").isUUID(), validateRequest],
  UserController.unblockFriendship,
);
userRoutes.get("/admin/list", UserController.listUsersForAdmin);
