import { createServer } from "node:http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createApp } from "./app.js";
import { disconnectDatabase, prisma } from "./infra/database/prisma.js";
import { closeQueues } from "./infra/queues/queues.js";
import { attachWebSocketServer } from "./infra/realtime/websocket.js";
import { connectRealtimeSubscriber, createRealtimeSubscriber } from "./infra/realtime/pubsub.js";
import { connectRedis, disconnectRedis } from "./infra/redis/redis.js";

const app = createApp();
const server = createServer(app);
const websocketServer = attachWebSocketServer(server);
const realtimeSubscriber = env.EXTERNAL_INTEGRATIONS_ENABLED
  ? createRealtimeSubscriber(websocketServer)
  : null;

async function start(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  if (realtimeSubscriber) {
    await connectRedis();
    await connectRealtimeSubscriber(realtimeSubscriber);
  }
  server.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT }, "AtendeIA API listening");
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Graceful shutdown started");
  server.close();
  websocketServer.close();
  if (realtimeSubscriber) {
    await realtimeSubscriber.quit();
    await closeQueues();
    await disconnectRedis();
  }
  await disconnectDatabase();
  logger.info("Graceful shutdown completed");
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

start().catch((error) => {
  logger.fatal({ error }, "API startup failed");
  process.exitCode = 1;
});
