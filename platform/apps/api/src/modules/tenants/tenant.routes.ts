import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireRoles, requireTenant } from "./tenant.middleware.js";
import { TenantService } from "./tenant.service.js";
import { tenantProfileUpdateSchema } from "./tenant.schemas.js";

const service = new TenantService();
export const tenantRouter = Router();

tenantRouter.use(asyncHandler(requireTenant));
tenantRouter.get(
  "/profile",
  asyncHandler(async (request, response) => {
    response.json({ data: await service.profile(request.tenant!) });
  }),
);
tenantRouter.patch(
  "/profile",
  requireRoles("OWNER", "ADMIN"),
  asyncHandler(async (request, response) => {
    response.json({
      data: await service.updateProfile(
        request.tenant!,
        tenantProfileUpdateSchema.parse(request.body),
      ),
    });
  }),
);
tenantRouter.get("/capabilities", (_request, response) => {
  response.json({ data: service.capabilities() });
});
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
