import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { verifyToken } from "../utils/jwt.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";

const conversationRepository = new ConversationRepository();

// Create uploads directory if not exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const conversationId = req.params.conversationId || "temp";
    const dir = path.join(uploadsDir, conversationId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  // Allowed MIME types
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/zip",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not supported`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

export const setupFileServer = (app: Express) => {
  // Serve uploaded files
  app.get(
    "/uploads/:conversationId/:filename",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        const bearerToken =
          typeof authHeader === "string" && authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : undefined;
        const queryToken =
          typeof req.query.token === "string" ? req.query.token : undefined;
        const token = bearerToken ?? queryToken;

        const userId = token ? verifyToken(token).userId : undefined;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { conversationId, filename } = req.params;

        const members =
          await conversationRepository.getConversationMembers(conversationId);
        const isMember = members.some((member) => member.userId === userId);

        if (!isMember) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const filepath = path.join(uploadsDir, conversationId, filename);

        // Security: verify file exists and is within allowed directory
        const realPath = fs.realpathSync(filepath);
        const allowedPath = fs.realpathSync(
          path.join(uploadsDir, conversationId),
        );

        if (!realPath.startsWith(allowedPath)) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const shouldDownload = req.query.download === "1";
        const requestedName =
          typeof req.query.name === "string" && req.query.name.trim().length > 0
            ? path.basename(req.query.name)
            : filename;

        if (shouldDownload) {
          res.download(filepath, requestedName);
          return;
        }

        res.sendFile(filepath);
      } catch (error) {
        next(error);
      }
    },
  );
};
