import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler, notFoundHandler } from "./core/http/error-handler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { aiRouter } from "./modules/ai/ai.routes.js";
import { billingRouter } from "./modules/billing/billing.routes.js";
import { billingWebhookRouter } from "./modules/billing/billing-webhook.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { conversationRouter } from "./modules/conversations/conversation.routes.js";
import { crmRouter } from "./modules/crm/crm.routes.js";
import { knowledgeRouter } from "./modules/knowledge/knowledge.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { mediaRouter } from "./modules/media/media.routes.js";
import { superAdminRouter } from "./modules/super-admin/super-admin.routes.js";
import { teamRouter } from "./modules/team/team.routes.js";
import { tenantRouter } from "./modules/tenants/tenant.routes.js";
import { whatsappRouter, whatsappWebhookRouter } from "./modules/whatsapp/whatsapp.routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY ? 1 : false);

  app.use(
    pinoHttp({
      logger,
      genReqId: (request, response) => {
        const requestId = request.headers["x-request-id"]?.toString() ?? randomUUID();
        response.setHeader("x-request-id", requestId);
        return requestId;
      },
    }),
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" },
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: env.APP_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["authorization", "content-type", "x-csrf-token", "x-tenant-id", "x-request-id"],
      maxAge: 600,
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/v1/webhooks/whatsapp", whatsappWebhookRouter);
  app.use("/v1/webhooks/billing", billingWebhookRouter);
  app.use(express.json({ limit: "256kb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "64kb" }));
  app.use(cookieParser());

  app.use("/health", healthRouter);
  app.use("/v1/auth", authRouter);
  app.use("/v1/ai", aiRouter);
  app.use("/v1/billing", billingRouter);
  app.use("/v1/dashboard", dashboardRouter);
  app.use("/v1/conversations", conversationRouter);
  app.use("/v1/crm", crmRouter);
  app.use("/v1/knowledge", knowledgeRouter);
  app.use("/v1/media", mediaRouter);
  app.use("/v1/super-admin", superAdminRouter);
  app.use("/v1/team", teamRouter);
  app.use("/v1/tenant", tenantRouter);
  app.use("/v1/whatsapp", whatsappRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
