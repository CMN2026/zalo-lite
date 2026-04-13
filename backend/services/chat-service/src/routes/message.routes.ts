import { Router } from "express";
import { body, param, query } from "express-validator";
import { MessageController } from "../controllers/message.controller.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validateRequest } from "../middlewares/validate.middleware.js";

export const messageRoutes = Router();

// Send text message
messageRoutes.post(
  "/",
  [
    body("conversationId").isString().withMessage("Invalid conversation ID"),
    body("content")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Content is required"),
    body("type").optional().isIn(["text", "image", "file"]),
    validateRequest,
  ],
  MessageController.sendMessage,
);

// Send message with file attachment
messageRoutes.post(
  "/:conversationId/upload",
  [
    param("conversationId").isString().withMessage("Invalid conversation ID"),
    validateRequest,
  ],
  upload.single("file"),
  MessageController.sendMessageWithFile,
);

// Get messages in conversation
messageRoutes.get(
  "/:conversationId",
  [
    param("conversationId").isString().withMessage("Invalid conversation ID"),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    validateRequest,
  ],
  MessageController.getMessages,
);

// Mark messages as read
messageRoutes.put(
  "/:conversationId/read",
  [
    param("conversationId").isString().withMessage("Invalid conversation ID"),
    validateRequest,
  ],
  MessageController.markAsRead,
);

// Delete message
messageRoutes.delete(
  "/:messageId",
  [
    param("messageId").isString().withMessage("Invalid message ID"),
    validateRequest,
  ],
  MessageController.deleteMessage,
);

// Search messages
messageRoutes.get(
  "/:conversationId/search",
  [
    param("conversationId").isUUID().withMessage("Invalid conversation ID"),
    query("q")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Search query required"),
    validateRequest,
  ],
  MessageController.searchMessages,
);
