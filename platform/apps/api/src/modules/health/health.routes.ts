import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { env } from "../../config/env.js";
import { prisma } from "../../infra/database/prisma.js";
import { getQueueRedis } from "../../infra/redis/redis.js";

export const healthRouter = Router();

export function livenessHandler(_request: unknown, response: { json: (body: unknown) => unknown }): void {
  response.json({ status: "ok" });
}

healthRouter.get("/", livenessHandler);
healthRouter.get("/live", livenessHandler);

export const readinessHandler = asyncHandler(async (_request, response) => {
  const databaseResult = await Promise.allSettled([prisma.$queryRaw`SELECT 1`]);
  const database = databaseResult[0]?.status === "fulfilled";
  let redis: boolean | "disabled" = "disabled";
  if (env.EXTERNAL_INTEGRATIONS_ENABLED) {
    const redisResult = await Promise.allSettled([getQueueRedis().ping()]);
    redis = redisResult[0]?.status === "fulfilled";
  }
  const readiness = readinessState(database, redis);
  response.status(readiness.statusCode).json({
    status: readiness.status,
    stage: env.ATENDEIA_DEPLOYMENT_STAGE,
    checks: { database, redis },
  });
});

healthRouter.get("/ready", readinessHandler);

export function readinessState(database: boolean, redis: boolean | "disabled") {
  const ready = database && redis !== false;
  return { statusCode: ready ? 200 : 503, status: ready ? "ready" : "not_ready" } as const;
}
