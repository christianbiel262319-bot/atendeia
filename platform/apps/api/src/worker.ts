import { logger } from "./config/logger.js";
import { disconnectDatabase } from "./infra/database/prisma.js";
import { createWhatsAppWebhookWorker } from "./workers/whatsapp-webhook.worker.js";

const { worker, connection, realtimePublisher } = createWhatsAppWebhookWorker();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Worker shutdown started");
  await worker.close();
  await connection.quit();
  await realtimePublisher.quit();
  await disconnectDatabase();
  logger.info("Worker shutdown completed");
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
