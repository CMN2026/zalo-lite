import type { Request, Response, NextFunction } from "express";
import { FriendService } from "../services/friend.service.js";

const friendService = new FriendService();

export class FriendController {
  static async request(req: Request, res: Response, next: NextFunction) {
    try {
      const senderId = req.auth?.user_id ?? "";
      const data = await friendService.sendRequest(senderId, req.body.receiver_id);
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async accept(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const data = await friendService.acceptRequest(userId, req.body.request_id);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async getFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const data = await friendService.listFriends(userId);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id ?? "";
      const phone = String(req.query.phone ?? "");
      const data = await friendService.searchByPhone(userId, phone);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }
}
