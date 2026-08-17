import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireTenant } from "../tenants/tenant.middleware.js";
import { SuperAdminController } from "./super-admin.controller.js";
import { requireSuperAdmin } from "./super-admin.middleware.js";

const controller = new SuperAdminController();
export const superAdminRouter = Router();

superAdminRouter.use(asyncHandler(requireTenant));
superAdminRouter.use(asyncHandler(requireSuperAdmin));
superAdminRouter.get("/overview", asyncHandler(controller.overview.bind(controller)));
superAdminRouter.get("/tenants", asyncHandler(controller.tenants.bind(controller)));
superAdminRouter.patch("/tenants/:id/status", asyncHandler(controller.updateTenantStatus.bind(controller)));
superAdminRouter.get("/plans", asyncHandler(controller.plans.bind(controller)));
superAdminRouter.post("/plans", asyncHandler(controller.createPlan.bind(controller)));
superAdminRouter.patch("/plans/:id", asyncHandler(controller.updatePlan.bind(controller)));
