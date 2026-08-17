import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

export const queueRedis = new Redis(env.REDIS_URL, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

queueRedis.on("error", (error: Error) => {
  logger.error({ error }, "Redis producer connection error");
});

export async function connectRedis(): Promise<void> {
  if (queueRedis.status === "wait") {
    await queueRedis.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (queueRedis.status !== "end") {
    await queueRedis.quit();
  }
}
