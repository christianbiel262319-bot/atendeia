import express, { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireExternalIntegrations } from "../../core/http/external-integrations.js";
import { requireRoles, requireTenant } from "../tenants/tenant.middleware.js";
import { WhatsAppController } from "./whatsapp.controller.js";

const controller = new WhatsAppController();

export const whatsappWebhookRouter = Router();
whatsappWebhookRouter.use(requireExternalIntegrations);
whatsappWebhookRouter.get("/", controller.verifyWebhook.bind(controller));
whatsappWebhookRouter.post(
  "/",
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(controller.receiveWebhook.bind(controller)),
);

export const whatsappRouter = Router();
whatsappRouter.use(asyncHandler(requireTenant));
whatsappRouter.get("/connection", asyncHandler(controller.getConnection.bind(controller)));
whatsappRouter.post(
  "/connection",
  requireRoles("OWNER", "ADMIN"),
  requireExternalIntegrations,
  asyncHandler(controller.connect.bind(controller)),
);
