import type { Request, Response } from "@types/express";
import { AuthService } from "../services/auth.service";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async register(req: Request, res: Response) {
    try {
      const { phone, password } = req.body;

      // Validate input
      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          message: "Phone and password are required",
        });
      }

      // Validate phone format (simple validation)
      if (!/^\d{10,}$/.test(phone.replace(/\D/g, ""))) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format",
        });
      }

      const result = await this.authService.register(phone, password);
      return res.status(201).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Registration failed";
      return res.status(400).json({
        success: false,
        message,
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { phone, password } = req.body;

      // Validate input
      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          message: "Phone and password are required",
        });
      }

      const result = await this.authService.login(phone, password);
      return res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      return res.status(401).json({
        success: false,
        message,
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const accountId = req.user?.accountId;
      if (!accountId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await this.authService.logout(accountId);
      return res.status(200).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Logout failed";
      return res.status(500).json({
        success: false,
        message,
      });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const accountId = req.user?.accountId;
      if (!accountId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const account = await this.authService.verifyAccount(accountId);
      return res.status(200).json({
        success: true,
        data: {
          accountId: account.id,
          userId: account.user?.id,
          phone: account.phone,
          status: account.status,
          createdAt: account.created_at,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to get profile";
      return res.status(404).json({
        success: false,
        message,
      });
    }
  }
}
