import type { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service.js";
import { HttpError } from "../utils/http-error.js";

const userService = new UserService();

export class UserController {
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId;
      const data = await userService.getByIdOrThrow(userId);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId;
      const data = await userService.updateProfile(userId, req.body);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async updateAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId;
      const data = await userService.updateAvatar(userId, req.body.avatarUrl);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async discoverByPhone(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        throw new HttpError(401, "unauthorized");
      }

      const phone = String(req.query.phone ?? "").trim();
      const data = await userService.discoverByPhone(userId, phone);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async sendFriendRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId;
      const data = await userService.sendFriendRequest(userId, req.body.phone, req.body.message);
      res.status(201).json({ message: "friend_request_sent", data });
    } catch (error) {
      next(error);
    }
  }

  static async listIncomingRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId;
      const data = await userService.listIncomingRequests(userId);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async respondFriendRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId;
      const data = await userService.respondFriendRequest(
        userId,
        req.params.requestId,
        req.body.action,
      );
      res.status(200).json({ message: "friend_request_updated", data });
    } catch (error) {
      next(error);
    }
  }

  static async listFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.userId;
      const data = await userService.listFriends(userId);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async listUsersForAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.auth?.role;
      if (role !== "ADMIN") {
        throw new HttpError(403, "forbidden");
      }

      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);
      const data = await userService.listUsers(page, limit);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }
}
