import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";

const authService = new AuthService();

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ message: "register_success", data: result });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({ message: "login_success", data: result });
    } catch (error) {
      next(error);
    }
  }

  static async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const token = String(req.query.token || "");
      await authService.verifyEmail(token);
      // redirect to frontend login with success
      const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontend}/login?verified=1`);
    } catch (error) {
      next(error);
    }
  }

  static async resendVerification(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { email } = req.body;
      const result = await authService.resendVerification(email);
      res.status(200).json({ message: "resend_success", data: result });
    } catch (error) {
      next(error);
    }
  }
}
