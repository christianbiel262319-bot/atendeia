import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireExternalIntegrations } from "../../core/http/external-integrations.js";
import { requireRoles, requireTenant } from "../tenants/tenant.middleware.js";
import { MediaController } from "./media.controller.js";

const controller = new MediaController();
export const mediaRouter = Router();

mediaRouter.use(asyncHandler(requireTenant));
mediaRouter.get("/", asyncHandler(controller.list.bind(controller)));
mediaRouter.get("/capabilities", controller.capabilities.bind(controller));
mediaRouter.use(requireRoles("OWNER", "ADMIN", "MANAGER"));
mediaRouter.use(requireExternalIntegrations);
mediaRouter.get("/upload-signature", controller.signature.bind(controller));
mediaRouter.post("/", asyncHandler(controller.register.bind(controller)));
mediaRouter.delete("/:id", asyncHandler(controller.remove.bind(controller)));
