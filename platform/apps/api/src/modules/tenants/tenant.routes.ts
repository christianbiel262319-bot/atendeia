import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireTenant } from "./tenant.middleware.js";
import { TenantService } from "./tenant.service.js";

const service = new TenantService();
export const tenantRouter = Router();

tenantRouter.use(asyncHandler(requireTenant));
tenantRouter.get(
  "/onboarding",
  asyncHandler(async (request, response) => {
    response.json({ data: await service.onboardingStatus(request.tenant!) });
  }),
);
tenantRouter.get(
  "/members",
  asyncHandler(async (request, response) => {
    const members = await service.listMemberships(request.tenant!);
    response.json({ data: members });
  }),
);
