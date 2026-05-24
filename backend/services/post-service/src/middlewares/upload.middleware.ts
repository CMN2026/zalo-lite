import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { verifyToken } from "../utils/jwt.js";

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
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const postId = req.params.postId || "temp";
    const dir = path.join(uploadsDir, postId);
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
  // Only allow image types for post images
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not supported. Only images are allowed.`));
  }
};

const localUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per image
    files: 10, // Max 10 images per post
  },
});

// Custom upload middleware wrapper: write local → upload to S3 → delete local
export const upload = {
  array: (fieldName: string, maxCount: number) => {
    const multerMiddleware = localUpload.array(fieldName, maxCount);
    return (req: Request, res: Response, next: NextFunction) => {
      multerMiddleware(req, res, async (err) => {
        if (err) {
          return next(err);
        }

        const files = req.files as Express.Multer.File[] | undefined;
        if (files && files.length > 0 && env.USE_S3 && s3Client) {
          for (const file of files) {
            const filepath = file.path;
            try {
              const postId = req.params.postId || "temp";
              const bucketName = env.S3_BUCKET_NAME || "zalo-lite-uploads";
              const s3Key = `post-uploads/${postId}/${file.filename}`;

              const fileStream = fs.createReadStream(filepath);

              await s3Client.send(
                new PutObjectCommand({
                  Bucket: bucketName,
                  Key: s3Key,
                  Body: fileStream,
                  ContentType: file.mimetype,
                }),
              );

              // Delete local temp file after successful S3 upload
              fs.unlink(filepath, (unlinkErr) => {
                if (unlinkErr) {
                  console.error("Failed to delete temp file:", filepath, unlinkErr);
                }
              });
            } catch (s3Err) {
              console.error("Error uploading file to AWS S3:", s3Err);
              if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
              }
              return next(new Error("Failed to store file on cloud storage"));
            }
          }
        }

        next();
      });
    };
  },
};

export const setupPostFileServer = (app: Express) => {
  // Serve post images
  app.get(
    "/post-uploads/:postId/:filename",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Allow public access to post images with token verification
        const authHeader = req.headers.authorization;
        const bearerToken =
          typeof authHeader === "string" && authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : undefined;
        const queryToken =
          typeof req.query.token === "string" ? req.query.token : undefined;
        const token = bearerToken ?? queryToken;

        const userId = token ? verifyToken(token).user_id : undefined;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { postId, filename } = req.params;

        // AWS S3 Mode: Stream file directly from S3
        if (env.USE_S3 && s3Client) {
          const bucketName = env.S3_BUCKET_NAME || "zalo-lite-uploads";
          const s3Key = `post-uploads/${postId}/${filename}`;

          try {
            const s3Response = await s3Client.send(
              new GetObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
              }),
            );

            if (!s3Response.Body) {
              return res.status(404).json({ message: "file_not_found" });
            }

            res.setHeader(
              "Content-Type",
              s3Response.ContentType || "application/octet-stream",
            );
            if (s3Response.ContentLength) {
              res.setHeader("Content-Length", s3Response.ContentLength);
            }
            res.setHeader("Content-Disposition", "inline");
            res.setHeader("Cache-Control", "public, max-age=86400");

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
        const filepath = path.join(uploadsDir, postId, filename);

        if (!fs.existsSync(filepath)) {
          return res.status(404).json({ message: "file_not_found" });
        }

        const realPath = fs.realpathSync(filepath);
        const allowedPath = fs.realpathSync(path.join(uploadsDir, postId));

        if (!realPath.startsWith(allowedPath)) {
          return res.status(403).json({ message: "Forbidden" });
        }

        res.sendFile(filepath);
      } catch (error) {
        next(error);
      }
    },
  );
};
