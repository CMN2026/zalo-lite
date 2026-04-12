import type { Request, Response, NextFunction } from "express";
import { MessageService } from "../services/message.service.js";
import { ConversationService } from "../services/conversation.service.js";

const messageService = new MessageService();
const conversationService = new ConversationService();

export type AuthRequest = Request & { auth?: { user_id: string } };

export class MessageController {
  // Send text message
  static async sendMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.user_id ?? "";
      const { conversationId, content, type = "text" } = req.body;

      const message = await messageService.sendMessage({
        conversation_id: conversationId,
        sender_id: userId,
        type,
        content,
      });

      res.status(201).json({ data: message, message: "Message sent" });
    } catch (error) {
      next(error);
    }
  }

  // Send message with file attachment
  static async sendMessageWithFile(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.user_id ?? "";
      const { conversationId } = req.params;
      const { content = "" } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: `/uploads/${conversationId}/${req.file.filename}`,
      };

      const message = await messageService.sendMessage({
        conversation_id: conversationId,
        sender_id: userId,
        type: "file",
        content: JSON.stringify({
          text: content,
          file: fileData,
        }),
      });

      res
        .status(201)
        .json({ data: message, message: "Message with file sent" });
    } catch (error) {
      next(error);
    }
  }

  // Get messages in a conversation
  static async getMessages(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.user_id ?? "";
      const { conversationId } = req.params;
      const limit = Number(req.query.limit ?? 50);

      const data = await conversationService.getMessages(
        userId,
        conversationId,
        limit,
      );
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  // Mark messages as read
  static async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const { conversationId } = req.params;

      await messageService.markMessagesAsRead(conversationId, userId);
      res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
      next(error);
    }
  }

  // Delete a message
  static async deleteMessage(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.user_id ?? "";
      const { messageId } = req.params;

      await messageService.deleteMessage(messageId, userId);
      res.status(200).json({ message: "Message deleted" });
    } catch (error) {
      next(error);
    }
  }

  // Search messages in a conversation
  static async searchMessages(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.auth?.user_id ?? "";
      const { conversationId } = req.params;
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({ message: "Search query required" });
      }

      const data = await messageService.searchMessages(
        conversationId,
        userId,
        q,
      );
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }
}
