import type { Request, Response, NextFunction } from "express";
import { ConversationService } from "../services/conversation.service.js";

const conversationService = new ConversationService();

export class ConversationController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const creatorId = req.auth?.user_id ?? "";
      const data = await conversationService.createConversation(creatorId, req.body);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const data = await conversationService.getConversations(userId);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async listMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const conversationId = req.params.id;
      const limit = Number(req.query.limit ?? 50);
      const data = await conversationService.getMessages(userId, conversationId, limit);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }
}
