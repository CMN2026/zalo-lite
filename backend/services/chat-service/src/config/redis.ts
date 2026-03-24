import { createClient } from "redis";
import { env } from "./env.js";

export const redisPublisher = createClient({ url: env.REDIS_URL });
export const redisSubscriber = redisPublisher.duplicate();

export async function connectRedis(): Promise<void> {
  if (!redisPublisher.isOpen) {
    await redisPublisher.connect();
  }
  if (!redisSubscriber.isOpen) {
    await redisSubscriber.connect();
  }
}
