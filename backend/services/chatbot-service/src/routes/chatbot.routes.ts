import type { Request, Response, NextFunction, RequestHandler } from "express";
import { body, ValidationChain } from "express-validator";
import { Router } from "express";
import { validationResult } from "express-validator";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { chatbotService } from "../services/chatbot.service.js";
import { HttpError } from "../utils/http-error.js";

export const chatbotRoutes = Router();

function validateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  res.status(400).json({
    message: "validation_error",
    errors: result.array().map((item) => ({
      field: item.type === "field" ? item.path : "request",
      message: item.msg,
    })),
  });
}

// POST /chatbot/messages - Send message to chatbot
chatbotRoutes.post(
  "/messages" as any,
  authMiddleware as any,
  body("message").trim().notEmpty().withMessage("message_required") as any,
  body("conversationId").optional({ nullable: true }).isString() as any,
  validateRequest as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { message, conversationId } = req.body;
      const userId = req.auth?.userId;

      if (!userId) {
        throw new HttpError(401, "unauthorized");
      }

      const result = await chatbotService.handleMessage(
        userId,
        message,
        conversationId,
      );

      res.status(200).json({
        message: "message_sent",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /chatbot/conversations - List user's chatbot conversations
chatbotRoutes.get(
  "/conversations" as any,
  authMiddleware as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.auth?.userId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      if (!userId) {
        throw new HttpError(401, "unauthorized");
      }

      const conversations = await chatbotService.listConversations(
        userId,
        limit,
      );

      res.status(200).json({
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /chatbot/conversations/:conversationId/history - Get chat history
chatbotRoutes.get(
  "/conversations/:conversationId/history" as any,
  authMiddleware as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params as { conversationId: string };
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const history = await chatbotService.getHistory(conversationId, limit);

      res.status(200).json({
        data: {
          conversationId,
          messages: history,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /chatbot/faq - Get all FAQs
chatbotRoutes.get(
  "/faq" as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query.q as string;

      let faqs;
      if (query) {
        faqs = await chatbotService.searchFAQ(query);
      } else {
        faqs = await chatbotService.getFAQ();
      }

      res.status(200).json({
        data: faqs,
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /chatbot/conversations/:conversationId/escalate - Escalate to admin
chatbotRoutes.post(
  "/conversations/:conversationId/escalate" as any,
  authMiddleware as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params as { conversationId: string };
      const adminId = req.auth?.userId;

      if (!adminId) {
        throw new HttpError(401, "unauthorized");
      }

      await chatbotService.escalateToAdmin(conversationId, adminId);

      res.status(200).json({
        message: "escalated_to_admin",
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /chatbot/conversations/:conversationId/close - Close conversation
chatbotRoutes.post(
  "/conversations/:conversationId/close" as any,
  authMiddleware as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params as { conversationId: string };

      await chatbotService.closeConversation(conversationId);

      res.status(200).json({
        message: "conversation_closed",
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /chatbot/feedback - Record user feedback for continuous learning
chatbotRoutes.post(
  "/feedback" as any,
  authMiddleware as any,
  body("messageId").trim().notEmpty().withMessage("messageId_required") as any,
  body("intent").trim().notEmpty().withMessage("intent_required") as any,
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("rating_must_be_1_to_5") as any,
  body("feedback").optional().trim() as any,
  validateRequest as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messageId, intent, rating, feedback } = req.body;

      const result = await chatbotService.recordFeedback(
        messageId,
        intent,
        rating,
        feedback,
      );

      res.status(200).json({
        message: "feedback_recorded",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /chatbot/stats - Get learning statistics
chatbotRoutes.get(
  "/stats" as any,
  authMiddleware as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await chatbotService.getLearningStats();

      res.status(200).json({
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },
);
