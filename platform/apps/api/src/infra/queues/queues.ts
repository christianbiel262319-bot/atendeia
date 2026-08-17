import { Queue } from "bullmq";
import { queueRedis } from "../redis/redis.js";

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2_000 },
  removeOnComplete: { age: 86_400, count: 10_000 },
  removeOnFail: { age: 604_800, count: 20_000 },
};

export const webhookQueue = new Queue("whatsapp-webhooks", {
  connection: queueRedis,
  defaultJobOptions,
});

export const outboundMessageQueue = new Queue("whatsapp-outbound", {
  connection: queueRedis,
  defaultJobOptions,
});

export async function closeQueues(): Promise<void> {
  await Promise.all([webhookQueue.close(), outboundMessageQueue.close()]);
}
