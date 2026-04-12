import { createClient } from "redis";
import { env } from "./env.js";

export const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.on("connect", () => console.log("Redis connected"));

export async function publishNotification(
  channel: string,
  message: string,
): Promise<void> {
  try {
    await redisClient.publish(channel, message);
  } catch (error) {
    console.error("Failed to publish notification:", error);
  }
}

export async function subscribeToChannel(
  channel: string,
  handler: (message: string) => Promise<void>,
): Promise<void> {
  const subscriber = redisClient.duplicate();
  await subscriber.connect();

  await subscriber.subscribe(channel, async (message) => {
    try {
      await handler(message);
    } catch (error) {
      console.error("Error handling subscription message:", error);
    }
  });
}
