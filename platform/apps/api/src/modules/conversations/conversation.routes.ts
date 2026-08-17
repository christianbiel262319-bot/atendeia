import { Router } from "express";
import { asyncHandler } from "../../core/http/async-handler.js";
import { requireRoles, requireTenant } from "../tenants/tenant.middleware.js";
import { ConversationController } from "./conversation.controller.js";

const controller = new ConversationController();
export const conversationRouter = Router();

conversationRouter.use(asyncHandler(requireTenant));
conversationRouter.get("/", asyncHandler(controller.list.bind(controller)));
conversationRouter.get("/:id", asyncHandler(controller.get.bind(controller)));
conversationRouter.post("/:id/messages", asyncHandler(controller.send.bind(controller)));
conversationRouter.post("/:id/resolve", asyncHandler(controller.resolve.bind(controller)));
conversationRouter.put(
  "/:id/assignment",
  requireRoles("OWNER", "ADMIN", "MANAGER"),
  asyncHandler(controller.assign.bind(controller)),
);
