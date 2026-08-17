import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireRoles, requireTenant } from "../tenants/tenant.middleware.js";
import { AiController } from "./ai.controller.js";

const controller = new AiController();
export const aiRouter = Router();

aiRouter.use(asyncHandler(requireTenant));
aiRouter.get("/configuration", asyncHandler(controller.getConfiguration.bind(controller)));
aiRouter.put(
  "/configuration",
  requireRoles("OWNER", "ADMIN", "MANAGER"),
  asyncHandler(controller.updateConfiguration.bind(controller)),
);
