import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireTenant } from "../tenants/tenant.middleware.js";
import { DashboardService } from "./dashboard.service.js";

const service = new DashboardService();
export const dashboardRouter = Router();

dashboardRouter.use(asyncHandler(requireTenant));
dashboardRouter.get(
  "/summary",
  asyncHandler(async (request, response) => {
    response.json({ data: await service.summary(request.tenant!) });
  }),
);
