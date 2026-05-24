import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { HttpError } from "../utils/http-error.js";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "file_too_large" });
    }

    return res.status(400).json({
      message: error.message || "file_upload_invalid",
    });
  }

  if (error instanceof Error) {
    if (error.message.startsWith("File type ")) {
      return res.status(415).json({ message: "file_type_not_supported" });
    }

    if (
      error.message.includes("Unexpected end of form") ||
      error.message.includes("Multipart")
    ) {
      return res.status(400).json({ message: "file_upload_invalid_form" });
    }

    if (process.env.NODE_ENV !== "production") {
      return res
        .status(500)
        .json({ message: error.message || "internal_server_error" });
    }
  }

  console.error(error);
  return res.status(500).json({ message: "internal_server_error" });
}
