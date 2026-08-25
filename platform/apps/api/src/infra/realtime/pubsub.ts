import { Redis } from "ioredis";
import { z } from "zod";
import { logger } from "../../config/logger.js";
import { requireRedisUrl } from "../redis/redis.js";
import type { WebSocketServer } from "ws";
import { broadcastToTenant } from "./websocket.js";

const channel = "atendeia:tenant-events";
const envelopeSchema = z.object({ tenantId: z.uuid(), event: z.unknown() });

export function createRealtimeSubscriber(websocketServer: WebSocketServer): Redis {
  const subscriber = new Redis(requireRedisUrl(), { lazyConnect: true, maxRetriesPerRequest: 1 });
  subscriber.on("message", (_channel, message) => {
    const parsed = envelopeSchema.safeParse(safeJson(message));
    if (parsed.success) broadcastToTenant(websocketServer, parsed.data.tenantId, parsed.data.event);
  });
  subscriber.on("error", (error) => logger.error({ error }, "Realtime subscriber error"));
  return subscriber;
}

export async function connectRealtimeSubscriber(subscriber: Redis): Promise<void> {
  if (subscriber.status === "wait") await subscriber.connect();
  await subscriber.subscribe(channel);
}

export async function publishTenantEvent(
  publisher: Redis,
  tenantId: string,
  event: unknown,
): Promise<void> {
  await publisher.publish(channel, JSON.stringify({ tenantId, event }));
}

function safeJson(value: string): unknown {
  try { return JSON.parse(value) as unknown; } catch { return null; }
}
