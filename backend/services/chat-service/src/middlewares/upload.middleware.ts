import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { verifyToken } from "../utils/jwt.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";

const conversationRepository = new ConversationRepository();

// Initialize S3 client if USE_S3 is enabled
let s3Client: S3Client | null = null;
if (env.USE_S3) {
  const s3Config: any = {
    region: env.AWS_REGION,
  };
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;
  if (accessKeyId && secretAccessKey && accessKeyId !== "dummy") {
    s3Config.credentials = {
      accessKeyId,
      secretAccessKey,
    };
  }
  s3Client = new S3Client(s3Config);
}

// Use UPLOADS_DIR env var if set, otherwise fall back to <project-root>/uploads.
// In Docker the working directory is /app, so this resolves to /app/uploads.
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage (always write to local temp folder first, then optionally move to S3)
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
    "image/heic",
    "image/heif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo",
    "video/x-matroska",
    "video/3gpp",
    "video/3gpp2",
    "video/mpeg",
    "video/x-ms-wmv",
    "video/ogg",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.rar",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "application/octet-stream",
    "text/plain",
    "application/zip",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not supported`));
  }
};

const localUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Custom upload middleware wrapper to intercept local file, upload to S3, and delete local file
export const upload = {
  single: (fieldName: string) => {
    const multerMiddleware = localUpload.single(fieldName);
    return (req: Request, res: Response, next: NextFunction) => {
      multerMiddleware(req, res, async (err) => {
        if (err) {
          return next(err);
        }

        // If S3 upload is enabled and file exists on local disk
        if (req.file && env.USE_S3 && s3Client) {
          const filepath = req.file.path;
          try {
            const conversationId = req.params.conversationId || "temp";
            const filename = req.file.filename;
            const bucketName = env.S3_BUCKET_NAME || "zalo-lite-uploads";
            const s3Key = `uploads/${conversationId}/${filename}`;

            // Read the file from local disk temp path
            const fileStream = fs.createReadStream(filepath);

            // Upload file to AWS S3
            await s3Client.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
                Body: fileStream,
                ContentType: req.file.mimetype,
              })
            );

            // Once successfully uploaded to S3, delete file from local temporary directory
            fs.unlink(filepath, (unlinkErr) => {
              if (unlinkErr) {
                console.error("Failed to delete temp file:", filepath, unlinkErr);
              }
            });
          } catch (s3Err) {
            console.error("Error uploading file to AWS S3:", s3Err);
            // Cleanup temp file in case of S3 upload failure
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
            return next(new Error("Failed to store file on cloud storage"));
          }
        }

        next();
      });
    };
  }
};

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

        const shouldDownload = req.query.download === "1";
        const requestedName =
          typeof req.query.name === "string" && req.query.name.trim().length > 0
            ? path.basename(req.query.name)
            : filename;

        // AWS S3 Mode: Stream file directly from S3
        if (env.USE_S3 && s3Client) {
          const bucketName = env.S3_BUCKET_NAME || "zalo-lite-uploads";
          const s3Key = `uploads/${conversationId}/${filename}`;

          try {
            const s3Response = await s3Client.send(
              new GetObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
              })
            );

            if (!s3Response.Body) {
              return res.status(404).json({ message: "file_not_found" });
            }

            res.setHeader("Content-Type", s3Response.ContentType || "application/octet-stream");
            if (s3Response.ContentLength) {
              res.setHeader("Content-Length", s3Response.ContentLength);
            }

            if (shouldDownload) {
              const encodedName = encodeURIComponent(requestedName);
              res.setHeader(
                "Content-Disposition",
                `attachment; filename*=UTF-8''${encodedName}`
              );
            } else {
              res.setHeader("Content-Disposition", "inline");
            }

            // Pipe S3 stream response to client
            const s3Stream = s3Response.Body as any;
            s3Stream.pipe(res);
            return;
          } catch (s3Err: any) {
            if (s3Err.name === "NoSuchKey") {
              return res.status(404).json({ message: "file_not_found" });
            }
            console.error("Error reading file from AWS S3:", s3Err);
            return res.status(500).json({ message: "failed_to_retrieve_file" });
          }
        }

        // Local Storage Fallback Mode
        const filepath = path.join(uploadsDir, conversationId, filename);

        if (!fs.existsSync(filepath)) {
          return res.status(404).json({ message: "file_not_found" });
        }

        // Security: verify file exists and is within allowed directory
        const realPath = fs.realpathSync(filepath);
        const allowedPath = fs.realpathSync(
          path.join(uploadsDir, conversationId),
        );

        if (!realPath.startsWith(allowedPath)) {
          return res.status(403).json({ message: "Forbidden" });
        }

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
