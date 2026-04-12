/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping requests to failing services
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerConfig {
  failureThreshold?: number; // Number of failures before opening circuit
  successThreshold?: number; // Number of successes in half-open to close
  timeout?: number; // Time in ms before moving from open to half-open
  name?: string; // For logging
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private failureThreshold = 5;
  private successThreshold = 2;
  private timeout = 60000; // 1 minute
  private name: string;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.successThreshold = config.successThreshold ?? 2;
    this.timeout = config.timeout ?? 60000;
    this.name = config.name ?? "CircuitBreaker";
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
        console.log(`[${this.name}] Transitioning to HALF_OPEN`);
      } else {
        throw new Error(
          `[${this.name}] Circuit breaker is OPEN. Service unavailable.`,
        );
      }
    }

    try {
      const result = await fn();

      if (this.state === "HALF_OPEN") {
        this.successCount++;
        if (this.successCount >= this.successThreshold) {
          this.state = "CLOSED";
          this.failureCount = 0;
          console.log(`[${this.name}] Circuit breaker CLOSED`);
        }
      } else if (this.state === "CLOSED") {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN";
        console.error(
          `[${this.name}] Circuit breaker opened after ${this.failureCount} failures`,
        );
      }

      throw error;
    }
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    console.log(`[${this.name}] Circuit breaker reset`);
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
