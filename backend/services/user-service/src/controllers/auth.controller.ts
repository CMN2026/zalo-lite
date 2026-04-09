import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";

const authService = new AuthService();

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.registerWithCredentials(req.body);
      res.status(201).json({ message: "register_success", data: result });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.loginWithCredentials(req.body);
      res.status(200).json({ message: "login_success", data: result });
    } catch (error) {
      next(error);
    }
  }

  static async loginWithGoogle(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.loginWithGoogle(req.body);
      res.status(200).json({ message: "auth_success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
