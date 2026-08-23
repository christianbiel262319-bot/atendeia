import { Queue } from "bullmq";
import { env } from "../../config/env.js";
import { queueRedis } from "../redis/redis.js";

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2_000 },
  removeOnComplete: { age: 86_400, count: 10_000 },
  removeOnFail: { age: 604_800, count: 20_000 },
};

let webhookQueue: Queue | null = null;
let outboundMessageQueue: Queue | null = null;

export function getWebhookQueue(): Queue {
  assertQueuesEnabled();
  webhookQueue ??= new Queue("whatsapp-webhooks", {
    connection: queueRedis,
    defaultJobOptions,
  });
  return webhookQueue;
}

export function getOutboundMessageQueue(): Queue {
  assertQueuesEnabled();
  outboundMessageQueue ??= new Queue("whatsapp-outbound", {
    connection: queueRedis,
    defaultJobOptions,
  });
  return outboundMessageQueue;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    webhookQueue?.close() ?? Promise.resolve(),
    outboundMessageQueue?.close() ?? Promise.resolve(),
  ]);
}

function assertQueuesEnabled(): void {
  if (!env.EXTERNAL_INTEGRATIONS_ENABLED) {
    throw new Error("As filas estão desativadas neste ambiente");
  }
}
