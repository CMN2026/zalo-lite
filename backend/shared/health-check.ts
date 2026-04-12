/**
 * Service Health Check System
 * Allows services to report health status and dependency health
 */

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

interface DependencyHealth {
  name: string;
  status: HealthStatus;
  responseTime?: number;
  error?: string;
}

interface ServiceHealth {
  service: string;
  status: HealthStatus;
  timestamp: number;
  uptime: number;
  dependencies: DependencyHealth[];
}

export class HealthCheckManager {
  private serviceName: string;
  private startTime = Date.now();
  private dependencies: Map<string, () => Promise<DependencyHealth>> =
    new Map();

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Register a dependency health check
   */
  registerDependency(
    name: string,
    checker: () => Promise<DependencyHealth>,
  ): void {
    this.dependencies.set(name, checker);
  }

  /**
   * Check health of all dependencies
   */
  async checkDependencies(): Promise<DependencyHealth[]> {
    const checks = Array.from(this.dependencies.values()).map((checker) =>
      checker().catch(
        (error) =>
          ({
            name: "unknown",
            status: "unhealthy" as const,
            error: String(error),
          }) as DependencyHealth,
      ),
    );

    return Promise.all(checks);
  }

  /**
   * Get overall service health
   */
  async getHealth(): Promise<ServiceHealth> {
    const dependencies = await this.checkDependencies();

    // Determine overall status
    let status: HealthStatus = "healthy";
    const hasUnhealthy = dependencies.some((d) => d.status === "unhealthy");
    const hasDegraded = dependencies.some((d) => d.status === "degraded");

    if (hasUnhealthy) {
      status = "unhealthy";
    } else if (hasDegraded) {
      status = "degraded";
    }

    return {
      service: this.serviceName,
      status,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      dependencies,
    };
  }
}

/**
 * Common dependency health checkers
 */
export const DependencyCheckers = {
  /**
   * HTTP endpoint health check
   */
  http:
    (name: string, url: string, timeout = 5000) =>
    async () => {
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        return {
          name,
          status: response.ok ? ("healthy" as const) : ("degraded" as const),
          responseTime,
          error: response.ok ? undefined : `HTTP ${response.status}`,
        };
      } catch (error) {
        return {
          name,
          status: "unhealthy" as const,
          responseTime: Date.now() - startTime,
          error: String(error),
        };
      }
    },

  /**
   * Database connection health check
   */
  database:
    (name: string, checkFn: () => Promise<void>, timeout = 5000) =>
    async () => {
      const startTime = Date.now();
      try {
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeout),
        );

        await Promise.race([checkFn(), timeoutPromise]);

        return {
          name,
          status: "healthy" as const,
          responseTime: Date.now() - startTime,
        };
      } catch (error) {
        return {
          name,
          status: "unhealthy" as const,
          responseTime: Date.now() - startTime,
          error: String(error),
        };
      }
    },

  /**
   * Redis connection health check
   */
  redis:
    (name: string, redisClient: any, timeout = 5000) =>
    async () => {
      const startTime = Date.now();
      try {
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeout),
        );

        await Promise.race([redisClient.ping(), timeoutPromise]);

        return {
          name,
          status: "healthy" as const,
          responseTime: Date.now() - startTime,
        };
      } catch (error) {
        return {
          name,
          status: "unhealthy" as const,
          responseTime: Date.now() - startTime,
          error: String(error),
        };
      }
    },
};
