import express, { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireExternalIntegrations } from "../../core/http/external-integrations.js";
import { BillingWebhookController } from "./billing-webhook.controller.js";

const controller = new BillingWebhookController();
export const billingWebhookRouter = Router();

billingWebhookRouter.post(
  "/:provider",
  requireExternalIntegrations,
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(controller.receive.bind(controller)),
);
