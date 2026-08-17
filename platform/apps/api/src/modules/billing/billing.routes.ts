import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireRoles, requireTenant } from "../tenants/tenant.middleware.js";
import { BillingController } from "./billing.controller.js";

const controller = new BillingController();
export const billingRouter = Router();

billingRouter.use(asyncHandler(requireTenant));
billingRouter.get("/plans", asyncHandler(controller.plans.bind(controller)));
billingRouter.get("/subscription", asyncHandler(controller.current.bind(controller)));
billingRouter.post(
  "/checkout",
  requireRoles("OWNER", "ADMIN"),
  asyncHandler(controller.checkout.bind(controller)),
);
billingRouter.delete(
  "/subscription",
  requireRoles("OWNER", "ADMIN"),
  asyncHandler(controller.cancel.bind(controller)),
);
