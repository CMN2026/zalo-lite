import type { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service.js";

const userService = new UserService();

export class UserController {
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.auth?.user_id;
      const data = await userService.getByIdOrThrow(userId);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await userService.getByIdOrThrow(req.params.id);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }

  static async searchByPhone(req: Request, res: Response, next: NextFunction) {
    try {
      const phone = String(req.query.phone ?? "").trim();
      const data = await userService.searchByPhone(phone);
      res.status(200).json({ data });
    } catch (error) {
      next(error);
    }
  }
}
