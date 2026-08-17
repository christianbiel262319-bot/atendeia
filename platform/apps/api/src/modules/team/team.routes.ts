import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireRoles, requireTenant } from "../tenants/tenant.middleware.js";
import { TeamController } from "./team.controller.js";

const controller = new TeamController();
export const teamRouter = Router();

teamRouter.use(asyncHandler(requireTenant));
teamRouter.get("/", asyncHandler(controller.list.bind(controller)));
teamRouter.post("/invitations/accept", asyncHandler(controller.accept.bind(controller)));
teamRouter.post(
  "/invitations",
  requireRoles("OWNER", "ADMIN"),
  asyncHandler(controller.invite.bind(controller)),
);
teamRouter.patch(
  "/members/:id",
  requireRoles("OWNER", "ADMIN"),
  asyncHandler(controller.updateMember.bind(controller)),
);
