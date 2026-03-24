import type { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

export function validateRequest(req: Request, res: Response, next: NextFunction) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    message: "validation_error",
    errors: result.array().map((item) => ({
      field: item.type === "field" ? item.path : "request",
      message: item.msg,
    })),
  });
}
