import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { UserService } from "../services/user.service.js";

const authService = new AuthService();
const userService = new UserService();

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.initiateCredentialRegistration(req.body);
      res.status(201).json({ message: "register_pending_verification", data: result });
    } catch (error) {
      next(error);
    }
  }

  static async verifyRegisterCode(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await authService.verifyCredentialRegistration(req.body);
      res.status(200).json({ message: "register_success", data: result });
    } catch (error) {
      next(error);
    }
  }

  static async resendRegisterCode(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await authService.resendCredentialVerificationCode(req.body);
      res.status(200).json({ message: "verification_code_resent", data: result });
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

  static async loginWithGoogle(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await authService.loginWithGoogle(req.body);
      res.status(200).json({ message: "auth_success", data: result });
    } catch (error) {
      next(error);
    }
  }

  static async requestPasswordReset(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await authService.requestPasswordReset(req.body);
      res.status(200).json({ message: "password_reset_requested", data: result });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await authService.resetPassword(req.body);
      res.status(200).json({ message: "password_reset_success", data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify JWT token and return user info
   * Used by other microservices to verify tokens (saga pattern)
   */
  static async verify(req: Request, res: Response, next: NextFunction) {
    try {
      // JWT is already verified by authMiddleware
      // Just return the payload from req.auth
      const auth = req.auth as any;

      // Fetch full user details for response
      const user = await userService.getByIdOrThrow(auth.userId);

      res.status(200).json({
        message: "token_valid",
        data: {
          userId: user.id,
          email: user.email,
          role: user.role,
          plan: user.plan,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
