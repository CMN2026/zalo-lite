import { Router } from "express";
import { body, param, query } from "express-validator";
import { ConversationController } from "../controllers/conversation.controller.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

export const conversationRoutes = Router();

conversationRoutes.post(
  "/",
  [
    body("type").isIn(["direct", "group"]),
    body("name").optional().isLength({ min: 1, max: 100 }),
    body("member_ids").isArray({ min: 1 }),
    body("member_ids.*").isString(),
    validateRequest,
  ],
  ConversationController.create,
);

conversationRoutes.post(
  "/direct",
  [body("user_id").isString().notEmpty(), validateRequest],
  ConversationController.getOrCreateDirect,
);

conversationRoutes.get("/", ConversationController.list);

conversationRoutes.get(
  "/:id",
  [param("id").isUUID(), validateRequest],
  ConversationController.detail,
);

conversationRoutes.patch(
  "/:id",
  [
    param("id").isUUID(),
    body("name").isLength({ min: 1, max: 100 }),
    validateRequest,
  ],
  ConversationController.update,
);

conversationRoutes.delete(
  "/:id",
  [param("id").isUUID(), validateRequest],
  ConversationController.remove,
);

conversationRoutes.post(
  "/:id/leave",
  [param("id").isUUID(), validateRequest],
  ConversationController.leave,
);

conversationRoutes.post(
  "/:id/members",
  [
    param("id").isUUID(),
    body("member_ids").isArray({ min: 1 }),
    body("member_ids.*").isUUID(),
    validateRequest,
  ],
  ConversationController.addMembers,
);

conversationRoutes.delete(
  "/:id/members/:userId",
  [
    param("id").isUUID(),
    param("userId").isUUID(),
    validateRequest,
  ],
  ConversationController.removeMember,
);

conversationRoutes.get(
  "/:id/messages",
  [
    param("id").isString(),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    validateRequest,
  ],
  ConversationController.listMessages,
);
