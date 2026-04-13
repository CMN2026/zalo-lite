/**
 * gRPC Client for User Service
 * Communicates with user-service via gRPC for token verification and user data
 * More efficient than HTTP for inter-service communication
 */

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = join(__dirname, "auth.proto");

// Load proto file
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const authProto = grpc.loadPackageDefinition(packageDefinition) as any;

export interface VerifyTokenResponse {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
  plan: "FREE" | "PREMIUM";
}

export class AuthServiceGRPCClient {
  private client: any;
  private channel: grpc.Channel;

  constructor() {
    const baseUrl = env.USER_SERVICE_BASE_URL || "localhost:3001";
    // gRPC needs bare host, no http(s):// scheme and no port (we always use 50051)
    const host = baseUrl.replace(/^https?:\/\//, "").split(":")[0];
    const userServiceUrl = `${host}:50051`;

    this.channel = new grpc.Channel(
      userServiceUrl,
      grpc.credentials.createInsecure(),
      {},
    );
    this.client = new authProto.auth.AuthService(
      userServiceUrl,
      grpc.credentials.createInsecure(),
      {},
    );
  }

  /**
   * Verify JWT token via gRPC call to user-service
   */
  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    return new Promise((resolve, reject) => {
      this.client.verifyToken(
        { token },
        (err: grpc.ServiceError | null, response: any) => {
          if (err) {
            if (err.code === grpc.status.UNAUTHENTICATED) {
              reject(new HttpError(401, "invalid_or_expired_token"));
            } else if (err.code === grpc.status.UNAVAILABLE) {
              reject(new HttpError(503, "user_service_unavailable"));
            } else {
              reject(new HttpError(401, "authentication_failed"));
            }
            return;
          }

          if (!response.success) {
            reject(
              new HttpError(401, response.error || "token_verification_failed"),
            );
            return;
          }

          resolve({
            userId: response.userId,
            email: response.email,
            role: response.role as "USER" | "ADMIN",
            plan: response.plan as "FREE" | "PREMIUM",
          });
        },
      );
    });
  }

  /**
   * Get user profile via gRPC
   */
  async getUser(userId: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    plan: string;
  }> {
    return new Promise((resolve, reject) => {
      this.client.getUser(
        { userId },
        (err: grpc.ServiceError | null, response: any) => {
          if (err) {
            if (err.code === grpc.status.NOT_FOUND) {
              reject(new HttpError(404, "user_not_found"));
            } else {
              reject(new HttpError(503, "user_service_unavailable"));
            }
            return;
          }

          if (!response.success) {
            reject(new HttpError(404, response.error || "user_not_found"));
            return;
          }

          resolve({
            id: response.id,
            email: response.email,
            fullName: response.fullName,
            role: response.role,
            plan: response.plan,
          });
        },
      );
    });
  }

  /**
   * Close gRPC channel
   */
  close(): void {
    this.channel.close();
  }
}

export const authGRPCClient = new AuthServiceGRPCClient();
