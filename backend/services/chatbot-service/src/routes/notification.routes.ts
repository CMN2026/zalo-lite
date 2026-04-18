import type { Request, Response, NextFunction, RequestHandler } from "express";
import { body, ValidationChain } from "express-validator";
import { Router } from "express";
import { validationResult } from "express-validator";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { notificationService } from "../services/notification.service.js";
import { HttpError } from "../utils/http-error.js";

export const adminRoutes = Router();

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

// Middleware to check admin role
function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "ADMIN") {
    next(new HttpError(403, "forbidden"));
    return;
  }
  next();
}

// POST /admin/notifications - Send system notification
adminRoutes.post(
  "/" as any,
  authMiddleware as any,
  requireAdmin as any,
  body("title").trim().notEmpty().withMessage("title_required") as any,
  body("content").trim().notEmpty().withMessage("content_required") as any,
  body("type")
    .isIn(["maintenance", "alert", "info"])
    .withMessage("invalid_type") as any,
  body("recipientType")
    .isIn(["all", "premium", "online"])
    .withMessage("invalid_recipient_type") as any,
  validateRequest as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, content, type, recipientType } = req.body;
      const createdBy = req.auth?.userId;

      if (!createdBy) {
        throw new HttpError(401, "unauthorized");
      }

      const notification = await notificationService.sendNotification(
        title,
        content,
        type,
        recipientType,
        createdBy,
      );

      res.status(201).json({
        message: "notification_sent",
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /admin/notifications - Get recent notifications
adminRoutes.get(
  "/" as any,
  authMiddleware as any,
  requireAdmin as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const notifications =
        await notificationService.getRecentNotifications(limit);

      res.status(200).json({
        data: notifications,
      });
    } catch (error) {
      next(error);
    }
  },
);

// POST /admin/notifications/:id/read - Mark notification as read
adminRoutes.post(
  "/:id/read" as any,
  authMiddleware as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const userId = req.auth?.userId;

      if (!userId) {
        throw new HttpError(401, "unauthorized");
      }

      await notificationService.markAsRead(id, userId);

      res.status(200).json({
        message: "marked_as_read",
      });
    } catch (error) {
      next(error);
    }
  },
);
