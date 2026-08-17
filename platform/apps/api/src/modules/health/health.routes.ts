import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { prisma } from "../../infra/database/prisma.js";
import { queueRedis } from "../../infra/redis/redis.js";

export const healthRouter = Router();

healthRouter.get("/live", (_request, response) => {
  response.json({ status: "ok" });
});

healthRouter.get(
  "/ready",
  asyncHandler(async (_request, response) => {
    const checks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      queueRedis.ping(),
    ]);
    const database = checks[0]?.status === "fulfilled";
    const redis = checks[1]?.status === "fulfilled";
    response.status(database && redis ? 200 : 503).json({
      status: database && redis ? "ready" : "not_ready",
      checks: { database, redis },
    });
  }),
);
