/**
 * gRPC Server for User Service
 * Handles auth verification requests from other microservices
 */

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { verifyAccessToken } from "../utils/jwt.js";
import { UserService } from "../services/user.service.js";

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
const userService = new UserService();

/**
 * Verify token RPC handler
 */
async function verifyToken(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
) {
  try {
    const { token } = call.request;

    if (!token) {
      callback(null, {
        success: false,
        error: "token_required",
      });
      return;
    }

    try {
      const payload = verifyAccessToken(token);

      // Get user details
      const user = await userService.getByIdOrThrow(payload.userId);

      callback(null, {
        success: true,
        userId: user.id,
        email: user.email,
        role: user.role,
        plan: user.plan,
      });
    } catch (error) {
      callback(null, {
        success: false,
        error:
          error instanceof Error ? error.message : "token_verification_failed",
      });
    }
  } catch (error) {
    const err = error as grpc.ServiceError;
    err.code = grpc.status.INTERNAL;
    callback(err);
  }
}

/**
 * Get user RPC handler
 */
async function getUser(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
) {
  try {
    const { userId } = call.request;

    if (!userId) {
      callback(null, {
        success: false,
        error: "userId_required",
      });
      return;
    }

    try {
      const user = await userService.getByIdOrThrow(userId);

      callback(null, {
        success: true,
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        plan: user.plan,
      });
    } catch (error) {
      callback(null, {
        success: false,
        error: error instanceof Error ? error.message : "user_not_found",
      });
    }
  } catch (error) {
    const err = error as grpc.ServiceError;
    err.code = grpc.status.INTERNAL;
    callback(err);
  }
}

/**
 * Start gRPC server
 */
export async function startGRPCServer(
  port: number = 50051,
): Promise<grpc.Server> {
  const server = new grpc.Server();

  try {
    server.addService(authProto.auth.AuthService.service, {
      verifyToken,
      getUser,
    });

    await new Promise<void>((resolve, reject) => {
      server.bindAsync(
        `0.0.0.0:${port}`,
        grpc.ServerCredentials.createInsecure(),
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });

    console.log(`gRPC server listening on port ${port}`);
    return server;
  } catch (error) {
    console.error("Failed to start gRPC server:", error);
    throw error;
  }
}

export function stopGRPCServer(server: grpc.Server): Promise<void> {
  return new Promise((resolve) => {
    server.tryShutdown(() => {
      console.log("gRPC server stopped");
      resolve();
    });
  });
}
