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
    body("member_ids.*").isUUID(),
    validateRequest,
  ],
  ConversationController.create,
);

conversationRoutes.get("/", ConversationController.list);

conversationRoutes.get(
  "/:id/messages",
  [
    param("id").isUUID(),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    validateRequest,
  ],
  ConversationController.listMessages,
);
