import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

let queueRedis: Redis | null = null;

export function getQueueRedis(): Redis {
  if (!env.EXTERNAL_INTEGRATIONS_ENABLED) {
    throw new Error("Redis está desativado neste ambiente");
  }
  queueRedis ??= createQueueRedis();
  return queueRedis;
}

export function requireRedisUrl(): string {
  if (!env.REDIS_URL) throw new Error("REDIS_URL não configurada");
  return env.REDIS_URL;
}

export async function connectRedis(): Promise<void> {
  const redis = getQueueRedis();
  if (redis.status === "wait") {
    await redis.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (queueRedis && queueRedis.status !== "end") {
    await queueRedis.quit();
  }
}

function createQueueRedis(): Redis {
  const redis = new Redis(requireRedisUrl(), {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  redis.on("error", (error: Error) => {
    logger.error({ error }, "Redis producer connection error");
  });
  return redis;
}
