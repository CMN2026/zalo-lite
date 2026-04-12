/**
 * Service-to-Service Authentication
 * Generates and verifies internal service tokens
 * Separate from user JWT tokens
 */

import { sign, verify } from "jsonwebtoken";

interface ServiceTokenPayload {
  serviceId: string;
  type: "SERVICE";
  iat: number;
  exp: number;
}

interface ServiceTokenConfig {
  secret: string;
  issuer: string;
  audience: string;
  expiresIn?: string; // Default: "5m"
}

export class ServiceAuthenticator {
  private config: ServiceTokenConfig;

  constructor(config: ServiceTokenConfig) {
    this.config = {
      ...config,
      expiresIn: config.expiresIn ?? "5m",
    };
  }

  /**
   * Generate internal service token
   * Valid for 5 minutes by default
   */
  generateServiceToken(serviceId: string): string {
    const payload: ServiceTokenPayload = {
      serviceId,
      type: "SERVICE",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    };

    return sign(payload, this.config.secret, {
      issuer: this.config.issuer,
      audience: this.config.audience,
      algorithm: "HS256",
    });
  }

  /**
   * Verify service token
   */
  verifyServiceToken(token: string): ServiceTokenPayload {
    try {
      const decoded = verify(token, this.config.secret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ["HS256"],
      }) as ServiceTokenPayload;

      if (decoded.type !== "SERVICE") {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error) {
      throw new Error(`Service token verification failed: ${String(error)}`);
    }
  }
}

/**
 * Service Token Manager
 * Caches tokens to avoid regenerating frequently
 */
export class ServiceTokenManager {
  private authenticator: ServiceAuthenticator;
  private tokenCache: Map<string, { token: string; expiresAt: number }> =
    new Map();
  private cacheTTL = 240000; // 4 minutes (keep 1 min buffer)

  constructor(config: ServiceTokenConfig) {
    this.authenticator = new ServiceAuthenticator(config);
  }

  getServiceToken(serviceId: string): string {
    const cached = this.tokenCache.get(serviceId);

    // Return cached token if still valid
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    // Generate new token
    const token = this.authenticator.generateServiceToken(serviceId);
    this.tokenCache.set(serviceId, {
      token,
      expiresAt: Date.now() + this.cacheTTL,
    });

    return token;
  }

  verifyToken(token: string): ServiceTokenPayload {
    return this.authenticator.verifyServiceToken(token);
  }

  clearCache(serviceId?: string): void {
    if (serviceId) {
      this.tokenCache.delete(serviceId);
    } else {
      this.tokenCache.clear();
    }
  }
}
